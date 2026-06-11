import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

/**
 * Renders a streaming transcript with Google-Translate-style "editing" feel.
 *
 * Streaming recognizers don't append text — each interim update REPLACES the
 * current hypothesis ("I scream" → "ice cream"). We diff the new text against
 * the old at the word level: the unchanged prefix is locked (solid colour) and
 * the changed tail is shown lighter and briefly fades/slides in, so corrections
 * read as the text re-writing itself rather than flickering.
 */
export function LiveCaption({
  text,
  color,
  tailColor,
  size = 16,
}: {
  text: string;
  color: string;
  tailColor: string;
  size?: number;
}) {
  const [stable, setStable] = useState('');
  const [tail, setTail] = useState('');
  const prevWords = useRef<string[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const words = text.length ? text.split(/(\s+)/) : [];
    // Longest common prefix (token-wise) between the previous and new hypothesis.
    let i = 0;
    while (i < words.length && i < prevWords.current.length && words[i] === prevWords.current[i]) {
      i++;
    }
    const lockedPrefix = words.slice(0, i).join('');
    const changedTail = words.slice(i).join('');
    prevWords.current = words;

    setStable(lockedPrefix);
    setTail(changedTail);

    // Animate the changed tail in.
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [text, fade]);

  if (!text) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.3 }]}>
        <Text style={{ color }}>{stable}</Text>
        <Animated.Text style={{ color: tailColor, opacity: fade }}>{tail}</Animated.Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 4 },
  text: { textAlign: 'center', fontWeight: '500' },
});
