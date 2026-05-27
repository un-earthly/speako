import React from 'react';
import { Text } from 'react-native';

function countryCodeToEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface FlagEmojiProps {
  countryCode: string;
  size?: number;
}

export function FlagEmoji({ countryCode, size = 24 }: FlagEmojiProps) {
  return (
    <Text style={{ fontSize: size, lineHeight: size + 6 }}>
      {countryCodeToEmoji(countryCode)}
    </Text>
  );
}
