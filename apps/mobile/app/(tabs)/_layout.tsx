import { Tabs } from 'expo-router';
import { TabIcon } from '../../src/components/tab-icon';
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
    name: 'report',
    title: '리포트',
    icon: require('../../assets/images/main/report.svg'),
  },
  {
    name: 'chat',
    title: '질문',
    icon: require('../../assets/images/main/chat.svg'),
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
          tabBarLabelPosition: 'below-icon',
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
          tabBarItemStyle: { minHeight: 56, paddingVertical: 4 },
          tabBarStyle: {
            height:
              Math.max(64, 40 + Math.ceil(20 * fontScale)) + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: colors.surface,
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
              tabBarIcon: ({ color, focused }) => (
                <TabIcon source={tab.icon} color={color} focused={focused} />
              ),
            }}
          />
        ))}
      </Tabs>
    </TabInteractionContext.Provider>
  );
}
