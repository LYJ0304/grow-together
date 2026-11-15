import { useScrollToTop } from '@react-navigation/native';
import { useMemo, type RefObject } from 'react';
import { useReduceMotion } from '../theme/motion';

type ScrollTarget = {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
};
export function useTabScrollToTop(scroll: RefObject<ScrollTarget | null>) {
  const reduced = useReduceMotion();
  const adapter = useMemo(
    () => ({
      current: {
        scrollToTop: () => {
          const target = scroll.current;
          if (target?.scrollToOffset)
            target.scrollToOffset({ offset: 0, animated: !reduced });
          else target?.scrollTo?.({ y: 0, animated: !reduced });
        },
      },
    }),
    [scroll, reduced],
  );
  useScrollToTop(adapter);
}
