import { MotionPressable } from './motion-pressable';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { Ref } from 'react';
import { Platform, type View } from 'react-native';

// Keep the navigator's semantics and href, while making submission guards
// genuinely disabled on web as well as native (including assistive technology).
export function TabButton({
  blocked,
  ...props
}: BottomTabBarButtonProps & { blocked: boolean }) {
  return (
    <MotionPressable
      {...props}
      ref={props.ref as Ref<View>}
      {...{ href: blocked ? undefined : props.href }}
      disabled={blocked}
      accessibilityState={{ ...props.accessibilityState, disabled: blocked }}
      style={props.style}
      onPress={(event) => {
        if (Platform.OS === 'web') {
          const pointer = event.nativeEvent as unknown as MouseEvent;
          if (
            pointer.metaKey ||
            pointer.ctrlKey ||
            pointer.altKey ||
            pointer.shiftKey ||
            pointer.button > 0
          )
            return;
          event.preventDefault();
        }
        props.onPress?.(event);
      }}
    />
  );
}
