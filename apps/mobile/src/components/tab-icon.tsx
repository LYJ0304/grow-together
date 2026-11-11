import { useEffect } from 'react';
import { Image, type ImageSource } from 'expo-image';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useReduceMotion } from '../theme/motion';

export function TabIcon({
  source,
  color,
  focused,
}: {
  source: ImageSource;
  color: string;
  focused: boolean;
}) {
  const reduced = useReduceMotion();
  const selected = useSharedValue(Number(focused));
  useEffect(() => {
    selected.value = withTiming(Number(focused), {
      duration: reduced ? 0 : motion.state,
      easing: motion.easeOut,
      reduceMotion: ReduceMotion.System,
    });
  }, [focused, reduced, selected]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selected.value,
      [0, 1],
      [colors.surface, colors.tint],
    ),
    transform: [{ scale: reduced ? 1 : 1 + selected.value * 0.04 }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: 48,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={source}
        tintColor={color}
        style={{ width: 24, height: 24 }}
        accessible={false}
      />
    </Animated.View>
  );
}
