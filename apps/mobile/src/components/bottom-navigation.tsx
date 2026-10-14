import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  active: '홈' | '캘린더' | '투두' | '질문' | '마이';
  onReselect: () => void;
  onUnavailable?: (label: string) => void;
};

export function BottomNavigation({ active, onReselect, onUnavailable }: Props) {
  const insets = useSafeAreaInsets();
  const items: {
    label: string;
    icon: number;
    href: '/main' | '/calendar' | '/todo' | '/persona' | '/mypage';
  }[] = [
    {
      label: '캘린더',
      icon: require('../../assets/images/main/calendar.svg'),
      href: '/calendar',
    },
    {
      label: '투두',
      icon: require('../../assets/images/main/todo.svg'),
      href: '/todo',
    },
    {
      label: '홈',
      icon: require('../../assets/images/calendar/home.svg'),
      href: '/main',
    },
    {
      label: '질문',
      icon: require('../../assets/images/main/search.svg'),
      href: '/persona',
    },
    {
      label: '마이',
      icon: require('../../assets/images/main/user.svg'),
      href: '/mypage',
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
            accessibilityState={{ selected: item.label === active }}
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
                tintColor={item.label === active ? '#D26A5C' : '#858895'}
                contentFit="contain"
                accessible={false}
              />
            </View>
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
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 38,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: 24, height: 24 },
  selectedIcon: { backgroundColor: '#FDEDE8', borderRadius: 10 },
  pressed: { opacity: 0.8 },
});
