import React, { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = PropsWithChildren<{
  stepKey: string | number;
  direction: 1 | -1;
  onSwipeBack?: () => void;
  canSwipeBack?: boolean;
}>;

const SWIPE_THRESHOLD = 90;

export function QuizCardStack({ stepKey, direction, onSwipeBack, canSwipeBack, children }: Props) {
  const reducedMotion = useReducedMotion();
  const dragX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(Boolean(canSwipeBack && onSwipeBack))
    .activeOffsetX([-1000, 15])
    .onUpdate((e) => {
      if (e.translationX > 0) dragX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD && onSwipeBack) {
        runOnJS(onSwipeBack)();
      }
      dragX.value = withSpring(0, { damping: 18 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, dragStyle]}>
        <AnimatePresence exitBeforeEnter>
          <MotiView
            key={stepKey}
            style={styles.fill}
            from={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, translateX: direction * 48, rotateZ: `${direction * 3}deg` }
            }
            animate={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, translateX: 0, rotateZ: '0deg' }
            }
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, translateX: direction * -48, rotateZ: `${direction * -3}deg` }
            }
            transition={{ type: 'timing', duration: reducedMotion ? 120 : 260 }}
          >
            {children}
          </MotiView>
        </AnimatePresence>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
