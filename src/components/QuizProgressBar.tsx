import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';

type Props = {
  count: number;
  activeIndex: number; // 0-based index of the question currently on screen
};

export function QuizProgressBar({ count, activeIndex }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Segment key={i} filled={i <= activeIndex} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? colors.accentSecondary : colors.bgElevatedHigh, {
      duration: 220,
    }),
  }));

  return <Animated.View style={[styles.segment, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
});
