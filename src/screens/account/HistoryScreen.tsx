import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';
import {
  subscribeToConversations,
  getUserProfile,
  deleteConversation,
  type Conversation,
} from '../../services/firestore';
import { Routes } from '../../constants/routes';

const { width: SCREEN_W } = Dimensions.get('window');

function formatTime(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function DeleteAction() {
  return (
    <View style={styles.deleteAction}>
      <Ionicons name="trash-outline" size={22} color="#FFF" />
    </View>
  );
}

export function HistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, (convos) => {
      setConversations(convos);
      setLoading(false);

      const newUids = convos
        .flatMap((c) => c.participants)
        .filter((uid) => uid !== user.uid && !nameMap[uid]);
      const unique = [...new Set(newUids)];
      if (unique.length === 0) return;

      Promise.all(
        unique.map((uid) =>
          getUserProfile(uid).then((p) => ({ uid, name: p?.displayName ?? null })),
        ),
      )
        .then((results) => {
          setNameMap((prev) => {
            const next = { ...prev };
            results.forEach(({ uid, name }) => {
              next[uid] = name ?? 'Unknown';
            });
            return next;
          });
        })
        .catch(() => {});
    });
  }, [user?.uid]);

  const handleOpen = (convo: Conversation) => {
    const myLangCode = (user?.uid && convo.participantLanguages[user.uid]) || 'en';
    if (convo.status === 'waiting') {
      navigation.navigate(Routes.Waiting, {
        conversationId: convo.id,
        inviteCode: convo.inviteCode,
        myLanguage: myLangCode,
      });
    } else {
      navigation.navigate(Routes.Conversation, { conversationId: convo.id });
    }
  };

  const handleDelete = useCallback(
    (convo: Conversation) => {
      Alert.alert('Delete Conversation', 'Are you sure? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeableRefs.current.get(convo.id)?.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(convo.id);
            } catch (err) {
              console.error('Delete failed:', err);
            }
          },
        },
      ]);
    },
    [],
  );

  const renderRightActions = useCallback(
    () => <DeleteAction />,
    [],
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const otherUid = item.participants.find((p) => p !== user?.uid);
    const myLangCode = (user?.uid && item.participantLanguages[user.uid]) || 'en';
    const otherLangCode =
      (otherUid && item.participantLanguages[otherUid]) || item.expectedOtherLanguage || 'en';
    const myL = getLanguageByCode(myLangCode);
    const otherL = getLanguageByCode(otherLangCode);
    const isWaiting = item.status === 'waiting';

    const otherName = (otherUid && nameMap[otherUid]) || (otherUid ? '...' : 'Unknown');
    const myName = user?.displayName || 'You';
    const lastText = item.lastMessage?.text;

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => handleDelete(item)}
        friction={2}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={[
            styles.item,
            {
              backgroundColor: isDark ? colors.glass : colors.surface,
              borderColor: isDark ? colors.glassBorder : colors.border,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() => handleOpen(item)}
          activeOpacity={0.8}
        >
          {/* Avatar: other person's flag */}
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : colors.inputBackground,
                borderColor: isDark ? colors.glassBorder : colors.border,
              },
            ]}
          >
            <FlagEmoji countryCode={otherL?.countryCode ?? 'US'} size={22} />
          </View>

          <View style={styles.content}>
            {/* Names row */}
            <View style={styles.topRow}>
              <Text style={[styles.names, { color: colors.text }]} numberOfLines={1}>
                {myName}
                <Text style={{ color: colors.textSecondary }}> → </Text>
                {otherName}
              </Text>
              <Text style={[styles.time, { color: colors.textSecondary }]}>
                {formatTime(item.updatedAt)}
              </Text>
            </View>

            {/* Language pair */}
            <View style={styles.langRow}>
              <FlagEmoji countryCode={myL?.countryCode ?? 'US'} size={12} />
              <Text style={[styles.langText, { color: colors.textSecondary }]}>
                {myL?.name ?? myLangCode}
              </Text>
              <Ionicons name="arrow-forward" size={10} color={colors.textSecondary} />
              <FlagEmoji countryCode={otherL?.countryCode ?? 'US'} size={12} />
              <Text style={[styles.langText, { color: colors.textSecondary }]}>
                {otherL?.name ?? otherLangCode}
              </Text>
            </View>

            {/* Last message / status */}
            {isWaiting ? (
              <View style={styles.statusRow}>
                <Ionicons name="time-outline" size={12} color="#FF9500" />
                <Text style={[styles.statusText, { color: '#FF9500' }]}>
                  Waiting · Code: {item.inviteCode}
                </Text>
              </View>
            ) : lastText ? (
              <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                {lastText}
              </Text>
            ) : (
              <Text style={[styles.preview, { color: colors.textSecondary }]}>No messages yet</Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Conversations</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#007AFF" />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surface,
                borderColor: isDark ? colors.glassBorder : colors.border,
              },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={32} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No conversations yet.{'\n'}Start one from the Home tab.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  content: { flex: 1, gap: 4 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  names: { flex: 1, fontSize: 15, fontWeight: '700' },
  time: { fontSize: 12, fontWeight: '500', flexShrink: 0 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langText: { fontSize: 12, fontWeight: '500' },
  preview: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },

  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 20,
    marginRight: 16,
    marginVertical: 2,
  },
});
