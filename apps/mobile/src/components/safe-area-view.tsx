import {
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type ViewProps,
} from 'react-native';
import {
  SafeAreaView as NativeSafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

// Expo Router no longer measures browser insets. CSS keeps them current without
// a provider update during hydration.
export function safeAreaLength(
  edge: Edge,
  inset: number,
  base: DimensionValue = 0,
): DimensionValue {
  if (Platform.OS !== 'web') {
    return typeof base === 'number' ? base + inset : base;
  }

  const length = typeof base === 'number' ? `${base}px` : base;
  return `calc(${length} + env(safe-area-inset-${edge}, 0px))` as DimensionValue;
}

const allEdges: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export function SafeAreaView({
  edges = allEdges,
  style,
  ...props
}: ViewProps & { edges?: readonly Edge[] }) {
  if (Platform.OS !== 'web') {
    return <NativeSafeAreaView {...props} edges={edges} style={style} />;
  }

  const {
    padding = 0,
    paddingVertical = padding,
    paddingHorizontal = padding,
    paddingTop = paddingVertical,
    paddingRight = paddingHorizontal,
    paddingBottom = paddingVertical,
    paddingLeft = paddingHorizontal,
  } = StyleSheet.flatten(style) ?? {};

  return (
    <View
      {...props}
      style={[
        style,
        {
          paddingTop: edges.includes('top')
            ? safeAreaLength('top', 0, paddingTop)
            : paddingTop,
          paddingRight: edges.includes('right')
            ? safeAreaLength('right', 0, paddingRight)
            : paddingRight,
          paddingBottom: edges.includes('bottom')
            ? safeAreaLength('bottom', 0, paddingBottom)
            : paddingBottom,
          paddingLeft: edges.includes('left')
            ? safeAreaLength('left', 0, paddingLeft)
            : paddingLeft,
        },
      ]}
    />
  );
}
