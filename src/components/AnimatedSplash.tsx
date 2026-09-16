import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, type } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  onMinDurationElapsed: () => void;
  minDurationMs?: number;
};

const FADE_MS = 250;

type NoteConfig = {
  top: number;
  left: number;
  size: number;
  delay: number;
  bob: number;
};

// Six notes arranged in a ring around the mark, matching the approved
// artwork's layout (top row + two side pairs + bottom pair).
const NOTES: NoteConfig[] = [
  { top: 18, left: 22, size: 26, delay: 0, bob: 8 },
  { top: 6, left: 48, size: 22, delay: 150, bob: 7 },
  { top: 18, left: 76, size: 26, delay: 300, bob: 9 },
  { top: 46, left: 10, size: 24, delay: 450, bob: 8 },
  { top: 46, left: 90, size: 28, delay: 600, bob: 7 },
  { top: 72, left: 28, size: 22, delay: 750, bob: 8 },
];

function Note({ config }: { config: NoteConfig }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(-config.bob, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(config.bob, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [bob, config.bob, config.delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { rotate: `${bob.value / 2}deg` },
    ],
  }));

  return (
    <Animated.Image
      source={require('../../assets/note-particle.png')}
      style={[
        styles.note,
        {
          top: `${config.top}%`,
          left: `${config.left}%`,
          width: config.size,
          height: config.size,
        },
        animatedStyle,
      ]}
    />
  );
}

export function AnimatedSplash({ onMinDurationElapsed, minDurationMs = 1500 }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
    }, Math.max(minDurationMs - FADE_MS, 0));
    const doneTimer = setTimeout(onMinDurationElapsed, minDurationMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [minDurationMs, onMinDurationElapsed, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, fadeStyle]}>
        {!reducedMotion && NOTES.map((note, i) => <Note key={i} config={note} />)}
        <Image source={require('../../assets/splash-icon.png')} style={styles.mark} resizeMode="contain" />
        <Text style={styles.wordmark}>Musicaleando</Text>
      </Animated.View>
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
  content: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 140,
    height: 140,
  },
  note: {
    position: 'absolute',
  },
  wordmark: {
    ...type.h1,
    color: colors.textPrimary,
    marginTop: 16,
    letterSpacing: 0.5,
    position: 'absolute',
    bottom: -40,
  },
});
