import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  active: '오늘' | '일정' | '기록' | '질문' | null;
  onReselect: () => void;
  disabled?: boolean;
  onUnavailable?: (label: string) => void;
};

export function BottomNavigation({
  active,
  onReselect,
  onUnavailable,
  disabled = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const items: {
    label: string;
    icon: number;
    href: '/main' | '/calendar' | '/todo' | '/chat' | '/mypage';
  }[] = [
    {
      label: '오늘',
      icon: require('../../assets/images/calendar/home.svg'),
      href: '/main',
    },
    {
      label: '일정',
      icon: require('../../assets/images/main/todo.svg'),
      href: '/todo',
    },
    {
      label: '기록',
      icon: require('../../assets/images/main/calendar.svg'),
      href: '/calendar',
    },
    {
      label: '질문',
      icon: require('../../assets/images/main/search.svg'),
      href: '/chat',
    },
  ];

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(8, insets.bottom) }]}
    >
      <View accessibilityRole="tablist" style={styles.row}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            disabled={disabled}
            accessibilityState={{ selected: item.label === active, disabled }}
            aria-selected={item.label === active}
            onPress={() => {
              if (item.label === active) onReselect();
              else if (item.href) router.replace(item.href);
              else onUnavailable?.(item.label);
            }}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.icon,
                item.label === active && styles.selectedIcon,
              ]}
            >
              <Image
                source={item.icon}
                style={styles.image}
                tintColor={item.label === active ? '#D26A5C' : '#777574'}
                contentFit="contain"
                accessible={false}
              />
            </View>
            <Text
              style={[
                styles.label,
                item.label === active && styles.selectedLabel,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF9F9',
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EAE6E4',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 38,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 13, lineHeight: 20, color: '#625B57' },
  selectedLabel: { color: '#A84D40', fontWeight: '600' },
  image: { width: 24, height: 24 },
  selectedIcon: { backgroundColor: '#FDEDE8', borderRadius: 10 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
