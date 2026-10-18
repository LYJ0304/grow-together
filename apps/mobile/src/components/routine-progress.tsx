import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PROGRESS = 70;
export function RoutineProgress() {
  const focused = useIsFocused();
  const [reducedMotion, setReducedMotion] = useState(true);
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const offset = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        preferenceChanged = true;
        setReducedMotion(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted && !preferenceChanged) setReducedMotion(value);
      })
      .catch(() => {});
    const app = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);

  useEffect(() => {
    if (focused && appActive && !reducedMotion) {
      // The live accessibility subscription above owns motion; Reanimated caches its startup preference.
      offset.value = withRepeat(
        withTiming(-2, {
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
    } else {
      cancelAnimation(offset);
      offset.value = 0;
    }
    return () => cancelAnimation(offset);
  }, [focused, appActive, reducedMotion, offset]);

  const idle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View style={styles.container}>
      <View
        style={styles.art}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          source={require('../../assets/images/main/progress-ring.svg')}
          style={styles.ring}
          accessible={false}
        />
        <Image
          source={require('../../assets/images/main/progress-disc.svg')}
          style={styles.disc}
          accessible={false}
        />
        <Animated.View
          testID="routine-character"
          style={[styles.character, idle]}
        >
          <Image
            source={require('../../assets/images/main/character.png')}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessible={false}
          />
        </Animated.View>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="오늘의 루틴"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={PROGRESS}
        aria-valuetext={`${PROGRESS}퍼센트`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: PROGRESS,
          text: `${PROGRESS}퍼센트`,
        }}
        style={styles.metric}
      >
        <Text style={styles.label}>오늘의 루틴</Text>
        <Text style={styles.value}>
          {PROGRESS}
          <Text style={styles.percent}>%</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  art: { width: 240, height: 236, overflow: 'hidden' },
  ring: { position: 'absolute', width: 200, height: 200, left: 20, top: 32 },
  disc: { position: 'absolute', width: 132, height: 132, left: 54, top: 66 },
  // Original 1024×1536 PNG: opaque character bounds are (284, 738)–(739, 1339).
  character: {
    position: 'absolute',
    width: 307.2,
    height: 460.8,
    left: -33.6,
    top: -198,
  },
  metric: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  label: { fontSize: 14, lineHeight: 22, color: '#777574' },
  value: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    color: '#292929',
    fontVariant: ['tabular-nums'],
  },
  percent: { fontSize: 17, fontWeight: '400' },
});
