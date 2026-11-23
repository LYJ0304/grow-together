import { Tabs } from 'expo-router';
import { TabIcon } from '../../src/components/tab-icon';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import {
  FloatingTabBar,
  FLOATING_TAB_BAR_SPACE,
} from '../../src/components/floating-tab-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { useReduceMotion } from '../../src/theme/motion';
import { TabInteractionContext } from '../../src/components/tab-interaction';

export const unstable_settings = { initialRouteName: 'main' };
const tabs = [
  { name: 'main', title: '홈', icon: require('../../assets/images/calendar/home.svg') },
  { name: '(records)', title: '캘린더', icon: require('../../assets/images/main/calendar.svg') },
  { name: 'chat', title: '상담', icon: require('../../assets/images/main/chat.svg') },
  { name: 'mypage', title: '마이', icon: require('../../assets/images/main/user.svg') },
];
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const [interaction, setInteraction] = useState({
    blocked: false,
    keyboard: false,
  });
  const [nativeKeyboard, setNativeKeyboard] = useState(
    () => Platform.OS !== 'web' && Keyboard.isVisible(),
  );
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setNativeKeyboard(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setNativeKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <TabInteractionContext.Provider value={setInteraction}>
      <Tabs
        backBehavior="history"
        screenListeners={{
          tabPress: (event) => {
            if (interaction.blocked) event.preventDefault();
          },
        }}
        tabBar={(props) => (
          <FloatingTabBar
            {...props}
            blocked={interaction.blocked}
            hidden={interaction.keyboard || nativeKeyboard}
            reducedMotion={reduced}
          />
        )}
        screenOptions={{
          headerShown: false,
          // Initial height agrees with the custom bar before its layout effect.
          tabBarStyle: { height: FLOATING_TAB_BAR_SPACE + insets.bottom },
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarAccessibilityLabel: tab.title,
              tabBarIcon: ({ focused }) => (
                <TabIcon source={tab.icon} focused={focused} />
              ),
            }}
          />
        ))}
      </Tabs>
    </TabInteractionContext.Provider>
  );
}
