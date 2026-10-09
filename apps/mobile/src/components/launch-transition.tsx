import { router, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

type LaunchRoute = '/' | '/app-name' | '/welcome';
type Position = { x: number; y: number; width: number };
type Transition = {
  source: string;
  destination: LaunchRoute;
  from: Position;
  origin: { x: number; y: number };
  to?: Position;
};

const TransitionContext = createContext<{
  transition: Transition | null;
  progress: Animated.Value;
  outgoingOpacity: Animated.Value;
  navigate: (destination: LaunchRoute, title: Text | null) => void;
  setDestination: (screen: LaunchRoute, position: Position) => void;
} | null>(null);

export function LaunchTransitionProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const root = useRef<View>(null);
  const viewport = useRef<{ width: number; height: number } | null>(null);
  const pending = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;
  const outgoingOpacity = useRef(new Animated.Value(1)).current;
  const [transition, setTransition] = useState<Transition | null>(null);

  const clear = useCallback(() => {
    progress.stopAnimation();
    outgoingOpacity.stopAnimation();
    outgoingOpacity.setValue(1);
    pending.current = false;
    setTransition(null);
  }, [progress, outgoingOpacity]);

  const onRootLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      if (
        viewport.current &&
        (viewport.current.width !== layout.width ||
          viewport.current.height !== layout.height)
      ) {
        clear();
      }
      viewport.current = { width: layout.width, height: layout.height };
    },
    [clear],
  );

  useEffect(() => {
    if (
      transition &&
      previousPath.current === transition.destination &&
      pathname !== transition.destination
    ) {
      clear();
    }
    previousPath.current = pathname;
  }, [pathname, transition, clear]);

  useEffect(() => {
    if (!transition?.to || pathname !== transition.destination) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished) clear();
    });
    return () => animation.stop();
  }, [transition, pathname, progress, clear]);

  const navigate = async (destination: LaunchRoute, title: Text | null) => {
    if (pending.current) return;
    pending.current = true;
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => true,
    );
    if (reduceMotion || !title || !root.current) {
      router.push(destination);
      pending.current = false;
      return;
    }
    root.current.measureInWindow((rootX, rootY) => {
      title.measureInWindow((x, y, width) => {
        if (width <= 0) {
          router.push(destination);
          pending.current = false;
          return;
        }
        progress.setValue(0);
        outgoingOpacity.setValue(1);
        setTransition({
          source: pathname,
          destination,
          from: { x: x - rootX, y: y - rootY, width },
          origin: { x: rootX, y: rootY },
        });
        requestAnimationFrame(() => {
          Animated.timing(outgoingOpacity, {
            toValue: 0,
            duration: 120,
            useNativeDriver: Platform.OS !== 'web',
          }).start(({ finished }) => {
            if (finished) router.push(destination);
          });
        });
      });
    });
  };

  const setDestination = useCallback(
    (screen: LaunchRoute, position: Position) => {
      setTransition((current) => {
        if (
          !current ||
          current.destination !== screen ||
          current.to ||
          position.width <= 0
        )
          return current;
        return {
          ...current,
          to: {
            ...position,
            x: position.x - current.origin.x,
            y: position.y - current.origin.y,
          },
        };
      });
    },
    [],
  );

  return (
    <TransitionContext.Provider
      value={{
        transition,
        progress,
        outgoingOpacity,
        navigate,
        setDestination,
      }}
    >
      <View ref={root} onLayout={onRootLayout} style={styles.container}>
        {children}
        {transition && (
          <View
            style={StyleSheet.absoluteFill}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="launch-transition"
          >
            <Animated.Text
              style={[
                styles.title,
                {
                  position: 'absolute',
                  width: transition.from.width + 2,
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          transition.from.x,
                          transition.to?.x ?? transition.from.x,
                        ],
                      }),
                    },
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          transition.from.y,
                          transition.to?.y ?? transition.from.y,
                        ],
                      }),
                    },
                  ],
                },
              ]}
              testID="launch-transition-title"
            >
              같이 키우기
            </Animated.Text>
          </View>
        )}
      </View>
    </TransitionContext.Provider>
  );
}

export function useLaunchTransition(screen: LaunchRoute) {
  const context = useContext(TransitionContext);
  if (!context) throw new Error('LaunchTransitionProvider is required');
  const titleRef = useRef<Text>(null);
  const pathname = usePathname();
  const { transition, setDestination } = context;

  const measureTitle = useCallback(() => {
    if (
      pathname !== screen ||
      transition?.destination !== screen ||
      transition.to
    )
      return;
    titleRef.current?.measureInWindow((x, y, width) => {
      setDestination(screen, { x, y, width });
    });
  }, [transition, pathname, screen, setDestination]);

  useEffect(() => {
    const frame = requestAnimationFrame(measureTitle);
    return () => cancelAnimationFrame(frame);
  }, [measureTitle]);

  return {
    titleRef,
    onTitleLayout: measureTitle,
    titleHidden:
      transition?.source === screen || transition?.destination === screen,
    busy: transition !== null,
    fadeStyle: {
      opacity:
        transition?.destination === screen
          ? context.progress.interpolate({
              inputRange: [0, 0.9, 1],
              outputRange: [0, 0, 1],
            })
          : transition?.source === screen
            ? context.outgoingOpacity
            : 1,
    },
    navigate: (destination: LaunchRoute) =>
      context.navigate(destination, titleRef.current),
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  title: {
    fontFamily: 'Jua',
    fontSize: 35,
    lineHeight: 44,
    letterSpacing: -0.7,
    color: '#D26A5C',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.08)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
