import { useEffect } from 'react';
import {
  Pressable,
  type PressableProps,
  type View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Ref } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion, useReduceMotion } from '../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  ref?: Ref<View>;
};

// Transform the existing target; keep navigator refs, semantics, and event handlers intact.
export function MotionPressable({
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced || disabled) scale.value = 1;
  }, [reduced, disabled, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      {...props}
      hitSlop={props.hitSlop ?? 4}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.value =
          reduced || disabled
            ? 1
            : withTiming(0.96, {
                duration: motion.press,
                easing: motion.easeOut,
              });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = reduced ? 1 : withSpring(1, motion.spring);
        onPressOut?.(event);
      }}
    />
  );
}
