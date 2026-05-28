import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { Routes } from '../constants/routes';
import { VoiceVerificationScreen } from '../screens/home/VoiceVerificationScreen';
import { ConversationScreen } from '../screens/conversation/ConversationScreen';
import { FaceToFaceScreen } from '../screens/conversation/FaceToFaceScreen';
import { WaitingScreen } from '../screens/conversation/WaitingScreen';
import { JoinScreen } from '../screens/conversation/JoinScreen';
import { FindPersonScreen } from '../screens/home/FindPersonScreen';
import { EditProfileScreen } from '../screens/account/EditProfileScreen';
import { ChangePasswordScreen } from '../screens/account/ChangePasswordScreen';
import { ChangeLanguageScreen } from '../screens/account/ChangeLanguageScreen';
import { ChangeThemeScreen } from '../screens/account/ChangeThemeScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Tab bar root — Home, Conversations, Account */}
      <Stack.Screen name="Tabs" component={TabNavigator} />

      {/* Full-screen screens pushed over the tab bar */}
      <Stack.Screen
        name="VoiceVerification"
        component={VoiceVerificationScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name={Routes.Waiting} component={WaitingScreen} />
      <Stack.Screen name={Routes.Join} component={JoinScreen} />
      <Stack.Screen name={Routes.FindPerson} component={FindPersonScreen} />
      <Stack.Screen name={Routes.Conversation} component={ConversationScreen} />
      <Stack.Screen name={Routes.FaceToFace} component={FaceToFaceScreen} />
      <Stack.Screen name={Routes.PersonalInfo} component={EditProfileScreen} />
      <Stack.Screen name={Routes.ChangePassword} component={ChangePasswordScreen} />
      <Stack.Screen name={Routes.ChangeLanguage} component={ChangeLanguageScreen} />
      <Stack.Screen name={Routes.ChangeTheme} component={ChangeThemeScreen} />
    </Stack.Navigator>
  );
}
