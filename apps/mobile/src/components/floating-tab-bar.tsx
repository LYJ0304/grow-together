import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { CommonActions, useLinkBuilder } from '@react-navigation/native';
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

// Reserve the capsule and safe bottom gap so no screen needs arbitrary overlay padding.
export const FLOATING_TAB_BAR_SPACE = 80;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
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
    onHeightChange?.(height);
  }, [height, onHeightChange]);
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
      style={[
        styles.frame,
        {
          height,
          paddingBottom: insets.bottom + 10,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
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
            return (
              <TabButton
                key={route.key}
                blocked={blocked}
                href={buildHref(route.name, route.params)}
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
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                    data: {
                      behavior: {
                        scrollToTop:
                          focused &&
                          options.tabBarRepeatedPressBehavior?.scrollToTop !==
                            false,
                        popToTop:
                          focused &&
                          options.tabBarRepeatedPressBehavior?.popToTop !==
                            false,
                      },
                    },
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.dispatch({
                      ...CommonActions.navigate(route.name, route.params),
                      target: state.key,
                    });
                    selectionFeedback();
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
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
    height: 70,
    padding: 6,
    borderRadius: 35,
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
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tint,
  },
  tab: {
    flex: 1,
    minWidth: 44,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  label: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
