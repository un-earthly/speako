import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeToConversation } from '../../services/firestore';
import { Routes } from '../../constants/routes';

export function WaitingScreen({ route, navigation }: any) {
  const { conversationId, inviteCode } = route.params || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeToConversation(conversationId, (convo) => {
      if (convo?.status === 'active') {
        navigation.replace(Routes.Conversation, { conversationId });
      }
    });
    return unsubscribe;
  }, [conversationId]);

  const handleCopy = () => {
    Clipboard.setString(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Join my conversation on Speako!\n\nInvite code: ${inviteCode}`,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="chatbubbles-outline" size={40} color="#007AFF" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Waiting for someone to join</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Share this code with the person you want to chat with. They'll enter it in the app to join.
        </Text>

        <View style={[styles.codeCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>INVITE CODE</Text>
          <Text style={[styles.code, { color: colors.text }]}>{inviteCode}</Text>
          <TouchableOpacity
            style={[styles.copyBtn, { backgroundColor: copied ? '#34C759' : colors.surfaceHighlight }]}
            onPress={handleCopy}
          >
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? '#FFF' : colors.text} />
            <Text style={[styles.copyBtnText, { color: copied ? '#FFF' : colors.text }]}>
              {copied ? 'Copied!' : 'Copy Code'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FFF" />
          <Text style={styles.shareBtnText}>Share Code</Text>
        </TouchableOpacity>

        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
            Waiting for other person to join...
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { padding: 16 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
    marginTop: -48,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  codeCard: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    marginVertical: 4,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  code: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  waitingText: {
    fontSize: 14,
  },
});
