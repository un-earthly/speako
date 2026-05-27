import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { HomeScreen } from '../screens/home/HomeScreen';
import { HistoryScreen } from '../screens/account/HistoryScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { useTheme } from '../contexts/ThemeContext';
import { Routes } from '../constants/routes';

const Tab = createBottomTabNavigator();
const { width: SCREEN_W } = Dimensions.get('window');

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs = [
  { name: Routes.Home, label: 'Home', icons: ['home', 'home-outline'] as [IoniconName, IoniconName] },
  { name: Routes.History, label: 'Chats', icons: ['chatbubbles', 'chatbubbles-outline'] as [IoniconName, IoniconName] },
  { name: Routes.Account, label: 'Account', icons: ['person', 'person-outline'] as [IoniconName, IoniconName] },
];

function GlassTabBar({ state, descriptors, navigation }: any) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <BlurView
        intensity={isDark ? 40 : 55}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.glassDock,
          {
            backgroundColor: isDark ? 'rgba(20,20,35,0.60)' : 'rgba(255,255,255,0.72)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.60)',
            shadowColor: isDark ? '#000' : '#000',
          },
        ]}
      >
        {tabs.map((tab, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: tab.name,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              {isFocused && (
                <View
                  style={[
                    styles.activePill,
                    { backgroundColor: isDark ? 'rgba(0,122,255,0.25)' : 'rgba(0,122,255,0.12)' },
                  ]}
                />
              )}
              <Ionicons
                name={isFocused ? tab.icons[0] : tab.icons[1]}
                size={22}
                color={isFocused ? '#007AFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? '#007AFF' : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name={Routes.Home} component={HomeScreen} />
      <Tab.Screen name={Routes.History} component={HistoryScreen} />
      <Tab.Screen name={Routes.Account} component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glassDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: Math.min(SCREEN_W - 40, 340),
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  activePill: {
    position: 'absolute',
    width: 56,
    height: 40,
    borderRadius: 20,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
