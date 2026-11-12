import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useReduceMotion } from '../theme/motion';

// Crossfade fixed tints rather than relying on platform-specific SVG tint animation.
export function TabIcon({
  source,
  focused,
}: {
  source: ImageSource;
  focused: boolean;
}) {
  const reduced = useReduceMotion();
  const selected = useSharedValue(Number(focused));
  useEffect(() => {
    selected.value = reduced
      ? Number(focused)
      : withTiming(Number(focused), {
          duration: motion.state,
          easing: motion.easeOut,
          reduceMotion: ReduceMotion.System,
        });
  }, [focused, reduced, selected]);
  const inactive = useAnimatedStyle(() => ({ opacity: 1 - selected.value }));
  const active = useAnimatedStyle(() => ({ opacity: selected.value }));
  return (
    <View style={styles.icon} pointerEvents="none" accessible={false}>
      <Animated.View style={[StyleSheet.absoluteFill, inactive]}>
        <Image
          source={source}
          tintColor={colors.muted}
          style={styles.icon}
          accessible={false}
        />
      </Animated.View>
      <Animated.View
        testID="tab-icon-selected"
        style={[StyleSheet.absoluteFill, active]}
      >
        <Image
          source={source}
          tintColor={colors.brand}
          style={styles.icon}
          accessible={false}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ icon: { width: 22, height: 22 } });
