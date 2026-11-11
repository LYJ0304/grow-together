import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export const motion = {
  quick: 140,
  standard: 200,
  press: 120,
  state: 220,
  entrance: 240,
  stagger: 40,
  progress: 380,
  easeOut: Easing.out(Easing.cubic),
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 0.7,
    reduceMotion: ReduceMotion.System,
  },
};

// Conservative until known; live changes settle existing animations immediately.
function useMotionPreference() {
  const [preference, setPreference] = useState({ reduced: true, ready: false });
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (active && !receivedEvent) setPreference({ reduced, ready: true });
      })
      .catch(() => {
        if (active && !receivedEvent)
          setPreference({ reduced: true, ready: true });
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (reduced) => {
        receivedEvent = true;
        setPreference({ reduced, ready: true });
      },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return preference;
}

export function useReduceMotion() {
  return useMotionPreference().reduced;
}

// Capture eligibility at mount: refetch, reordering and preference changes never replay.
export function useEntranceOnce(animate = true, delay = 0) {
  const [eligible] = useState(animate);
  const played = useRef(false);
  const { reduced, ready } = useMotionPreference();
  const opacity = useSharedValue(eligible ? 0 : 1);
  const y = useSharedValue(eligible ? 8 : 0);
  useEffect(() => {
    if (!ready) return;
    if (reduced || !eligible) {
      played.current = true;
      opacity.value = 1;
      y.value = 0;
    } else if (!played.current) {
      played.current = true;
      const config = {
        duration: motion.entrance,
        easing: motion.easeOut,
        reduceMotion: ReduceMotion.System,
      };
      opacity.value = withDelay(delay, withTiming(1, config));
      y.value = withDelay(delay, withTiming(0, config));
    }
  }, [ready, reduced, eligible, delay, opacity, y]);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));
}
