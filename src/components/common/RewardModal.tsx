import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';

interface RewardModalProps {
  visible: boolean;
  points: number;
  streak?: number;
  message?: string;
  onClose: () => void;
}

export function RewardModal({ visible, points, streak = 1, message, onClose }: RewardModalProps) {
  const scaleAnim = React.useRef(new Animated.Value(0.5)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const pointsAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);
      pointsAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pointsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🎉</Text>
          </View>

          <Text style={styles.congrats}>Congratulations!</Text>
          <Text style={styles.subtitle}>{message || 'You earned a reward!'}</Text>

          {streak > 1 && (
            <View style={styles.streakBox}>
              <Text style={styles.streakText}>🔥 Streak x{streak}</Text>
            </View>
          )}

          <View style={styles.pointsBox}>
            <Animated.Text
              style={[
                styles.pointsText,
                {
                  transform: [
                    {
                      scale: pointsAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.5, 1.3, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              +{points}
            </Animated.Text>
            <Text style={styles.pointsLabel}>points</Text>
          </View>

          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 32 },
  congrats: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  pointsBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pointsText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FF9500',
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  streakBox: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF9500',
  },
  btn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
