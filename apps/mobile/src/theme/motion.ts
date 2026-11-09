import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const motion = { quick: 140, standard: 200 };

// Start conservatively until the system preference is known; listen for changes.
export function useReduceMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
