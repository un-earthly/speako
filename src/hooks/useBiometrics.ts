import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@speako_biometric_enabled';

export function useBiometrics() {
  const isAvailable = async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return LocalAuthentication.isEnrolledAsync();
  };

  const isEnabled = async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    return val === 'true';
  };

  const setEnabled = async (enabled: boolean): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  };

  const authenticate = async (prompt = 'Authenticate to continue'): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  };

  const getBiometricLabel = async (): Promise<string> => {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
    return 'Biometrics';
  };

  return { isAvailable, isEnabled, setEnabled, authenticate, getBiometricLabel };
}
