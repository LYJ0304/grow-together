import { useScrollToTop } from '@react-navigation/native';
import { useMemo, type RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { useReduceMotion } from '../theme/motion';

export function useTabScrollToTop(scroll: RefObject<ScrollView | null>) {
  const reduced = useReduceMotion();
  const adapter = useMemo(
    () => ({
      current: {
        scrollToTop: () =>
          scroll.current?.scrollTo({ y: 0, animated: !reduced }),
      },
    }),
    [scroll, reduced],
  );
  useScrollToTop(adapter);
}
