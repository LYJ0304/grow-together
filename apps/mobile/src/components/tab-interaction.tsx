import { createContext, useContext, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

type Interaction = { blocked: boolean; keyboard: boolean };
export const TabInteractionContext = createContext<
  (value: Interaction) => void
>(() => {});

// Only the focused route owns tab interaction state. Hidden mounted screens
// cannot hide the tab bar or clear another screen's submission guard.
export function useTabInteraction(blocked: boolean, keyboard = false) {
  const setInteraction = useContext(TabInteractionContext);
  useFocusEffect(
    useCallback(() => {
      setInteraction({ blocked, keyboard });
      return () => setInteraction({ blocked: false, keyboard: false });
    }, [blocked, keyboard, setInteraction]),
  );
}
