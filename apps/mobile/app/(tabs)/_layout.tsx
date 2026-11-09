import { Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { TabButton } from '../../src/components/tab-button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { motion, useReduceMotion } from '../../src/theme/motion';
import { TabInteractionContext } from '../../src/components/tab-interaction';

export const unstable_settings = { initialRouteName: 'main' };
const tabs = [
  {
    name: 'main',
    title: '오늘',
    icon: require('../../assets/images/calendar/home.svg'),
  },
  {
    name: 'todo',
    title: '일정',
    icon: require('../../assets/images/main/todo.svg'),
  },
  {
    name: '(records)',
    title: '기록',
    icon: require('../../assets/images/main/calendar.svg'),
  },
  {
    name: 'chat',
    title: '질문',
    icon: require('../../assets/images/main/search.svg'),
  },
];
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reduced = useReduceMotion();
  const [interaction, setInteraction] = useState({
    blocked: false,
    keyboard: false,
  });
  return (
    <TabInteractionContext.Provider value={setInteraction}>
      <Tabs
        initialRouteName="main"
        backBehavior="history"
        screenListeners={{
          tabPress: (event) => {
            if (interaction.blocked) event.preventDefault();
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarButton: (props) => (
            <TabButton {...props} blocked={interaction.blocked} />
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarHideOnKeyboard: true,
          tabBarVisibilityAnimationConfig: {
            show: {
              animation: 'timing',
              config: { duration: reduced ? 0 : motion.quick },
            },
            hide: {
              animation: 'timing',
              config: { duration: reduced ? 0 : motion.quick },
            },
          },
          tabBarLabelStyle: { fontSize: 13, fontWeight: '500' },
          tabBarItemStyle: { minHeight: 48, paddingVertical: 4 },
          tabBarStyle: {
            height:
              Math.max(60, 32 + Math.ceil(20 * fontScale)) + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 0,
            display: interaction.keyboard ? 'none' : 'flex',
          },
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
              tabBarIcon: ({ color }) => (
                <Image
                  source={tab.icon}
                  tintColor={color}
                  style={{ width: 24, height: 24 }}
                  accessible={false}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </TabInteractionContext.Provider>
  );
}
