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
    size: number;
    href: '/main' | '/calendar' | '/todo' | '/persona' | '/mypage';
  }[] = [
    {
      label: '캘린더',
      icon:
        active === '캘린더'
          ? require('../../assets/images/calendar/calendar-selected.svg')
          : require('../../assets/images/main/calendar.svg'),
      size: active === '캘린더' ? 48 : 24,
      href: '/calendar',
    },
    {
      label: '투두',
      icon: require('../../assets/images/main/todo.svg'),
      size: 44,
      href: '/todo',
    },
    {
      label: '홈',
      icon:
        active === '홈'
          ? require('../../assets/images/main/home.svg')
          : require('../../assets/images/calendar/home.svg'),
      size: 24,
      href: '/main',
    },
    {
      label: '질문',
      icon: require('../../assets/images/main/search.svg'),
      size: 24,
      href: '/persona',
    },
    {
      label: '마이',
      icon:
        active === '마이'
          ? require('../../assets/images/calendar/user-selected.svg')
          : active === '캘린더'
            ? require('../../assets/images/calendar/user.svg')
            : require('../../assets/images/main/user.svg'),
      size: active === '마이' ? 48 : 24,
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
                item.label === '홈' && active === '홈' && styles.selectedHome,
                item.label === '투두' &&
                  active === '투두' &&
                  styles.selectedTodo,
              ]}
            >
              <Image
                source={item.icon}
                style={{ width: item.size, height: item.size }}
                tintColor={
                  item.label === '투두' && active === '투두'
                    ? '#FFFFFF'
                    : undefined
                }
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
    boxShadow: '2px -5px 17px rgba(84, 87, 92, 0.1)',
  },
  row: {
    flexDirection: 'row',
    height: 56,
    paddingTop: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  button: { flex: 1, alignItems: 'center' },
  icon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedHome: { backgroundColor: '#D26A5C', borderRadius: 18 },
  selectedTodo: {
    width: 44,
    height: 44,
    backgroundColor: '#D26A5C',
    borderRadius: 12,
  },
  pressed: { opacity: 0.8 },
});
