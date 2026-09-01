import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Mirrors the OS "reduce motion" setting so screens can skip/shorten
// non-essential animation (splash pulse, card-stack swipes, confetti, etc).
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
