import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled,
  loading,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();

  const backgroundColor =
    variant === 'primary'
      ? '#007AFF'
      : variant === 'secondary'
      ? colors.surface
      : variant === 'danger'
      ? '#FF3B30'
      : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'outline'
      ? '#007AFF'
      : colors.text;

  const borderColor = variant === 'outline' ? '#007AFF' : 'transparent';

  const height = size === 'small' ? 36 : size === 'medium' ? 44 : 52;
  const fontSize = size === 'small' ? 14 : size === 'medium' ? 16 : 17;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          height,
          backgroundColor: disabled || loading ? colors.surfaceHighlight : backgroundColor,
          borderColor,
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: disabled ? colors.textSecondary : textColor, fontSize }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
});
