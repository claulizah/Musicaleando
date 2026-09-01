import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, type } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  onMinDurationElapsed: () => void;
  minDurationMs?: number;
};

export function AnimatedSplash({ onMinDurationElapsed, minDurationMs = 1400 }: Props) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onMinDurationElapsed, minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs, onMinDurationElapsed]);

  return (
    <View style={styles.container}>
      {reducedMotion ? (
        <View style={styles.staticMark} />
      ) : (
        <LottieView
          source={require('../../assets/lottie/pulse.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
      )}
      <Text style={styles.wordmark}>Musicaleando</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 220,
    height: 220,
  },
  staticMark: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.accentSecondary,
    marginBottom: 8,
  },
  wordmark: {
    ...type.h1,
    color: colors.textPrimary,
    marginTop: 16,
    letterSpacing: 0.5,
  },
});
