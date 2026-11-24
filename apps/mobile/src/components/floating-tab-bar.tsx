import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from 'expo-router/js-tabs';
import { useLinkBuilder } from 'expo-router/react-navigation';
import { useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion } from '../theme/motion';
import { typography } from '../theme/typography';
import { selectionFeedback } from '../lib/haptics';
import { TabButton } from './tab-button';
import { safeAreaLength } from './safe-area-view';

// Reserve the capsule and safe bottom gap so no screen needs arbitrary overlay padding.
export const FLOATING_TAB_BAR_SPACE = 68;

export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  blocked,
  hidden,
  reducedMotion,
}: BottomTabBarProps & {
  blocked: boolean;
  hidden: boolean;
  reducedMotion: boolean;
}) {
  const { buildHref } = useLinkBuilder();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const [width, setWidth] = useState(0);
  const selected = useSharedValue(state.index);
  useEffect(() => {
    selected.value = reducedMotion
      ? state.index
      : withTiming(state.index, {
          duration: motion.state,
          easing: motion.easeOut,
          reduceMotion: ReduceMotion.System,
        });
  }, [state.index, reducedMotion, selected]);
  const height = hidden ? 0 : FLOATING_TAB_BAR_SPACE + insets.bottom;
  useEffect(() => {
    if (Platform.OS !== 'web' || hidden) onHeightChange?.(height);
  }, [height, hidden, onHeightChange]);
  const slotWidth = width / state.routes.length;
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: width > 0 ? 1 : 0,
    width: Math.max(0, slotWidth),
    transform: [{ translateX: selected.value * slotWidth }],
  }));

  if (hidden) return null;
  return (
    <View
      testID="floating-tab-bar-frame"
      pointerEvents="box-none"
      onLayout={(event) => {
        if (Platform.OS === 'web') {
          onHeightChange?.(event.nativeEvent.layout.height);
        }
      }}
      style={[
        styles.frame,
        {
          height: safeAreaLength(
            'bottom',
            insets.bottom,
            FLOATING_TAB_BAR_SPACE,
          ),
          paddingBottom: safeAreaLength('bottom', insets.bottom, 10),
          paddingLeft: safeAreaLength('left', insets.left, 20),
          paddingRight: safeAreaLength('right', insets.right, 20),
        },
      ]}
    >
      <View role="tablist" style={styles.pill}>
        <View
          style={styles.row}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          <Animated.View
            testID="floating-tab-highlight"
            pointerEvents="none"
            accessible={false}
            style={[styles.highlight, highlightStyle]}
          />
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const href =
              route.name === '(records)'
                ? '/calendar'
                : buildHref(route.name, route.params);
            return (
              <TabButton
                key={route.name}
                blocked={blocked}
                href={href}
                role={Platform.OS === 'ios' ? 'button' : 'tab'}
                aria-selected={focused}
                accessibilityLargeContentTitle={label}
                accessibilityShowsLargeContentViewer
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                accessibilityState={{ selected: focused }}
                testID={options.tabBarButtonTestID}
                style={styles.tab}
                onPress={() => {
                  if (blocked) return;
                  // Keep the navigator's repeated-press policy, including scroll/pop-to-top.
                  const event = emitter.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigateToTab(route.key);
                    selectionFeedback();
                  }
                }}
                onLongPress={() => {
                  emitter.emit({ type: 'tabLongPress', target: route.key });
                }}
              >
                {options.tabBarIcon?.({
                  focused,
                  color: focused ? colors.brand : colors.muted,
                  size: 22,
                })}
                <Text
                  maxFontSizeMultiplier={1.4}
                  numberOfLines={1}
                  style={[
                    styles.label,
                    { color: focused ? colors.onTint : colors.muted },
                  ]}
                >
                  {label}
                </Text>
              </TabButton>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    paddingTop: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 520,
    height: 58,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.navigationEdge,
    backgroundColor: colors.navigationSurface,
    shadowColor: colors.heading,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  row: { flex: 1, flexDirection: 'row' },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.tint,
  },
  tab: {
    flex: 1,
    minWidth: 44,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 0,
  },
  label: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
