import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { SettingsScreen } from '../src/components/settings/settings-screen';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';

const options = [
  {
    id: 'schedule',
    label: '일정 시작 알림',
    description: '계획한 활동을 시작할 시간을 알려드려요.',
  },
  {
    id: 'diary',
    label: '일기 작성 알림',
    description: '하루의 순간을 기록하도록 알려드려요.',
  },
  {
    id: 'report',
    label: '성장 리포트 알림',
    description: '새로운 리포트를 확인하도록 알려드려요.',
  },
] as const;
type NotificationKind = (typeof options)[number]['id'];
const initial = { schedule: false, diary: false, report: false };
export default function NotificationSettingsScreen() {
  const [settings, setSettings] =
    useState<Record<NotificationKind, boolean>>(initial);
  useFocusEffect(
    useCallback(() => {
      setSettings({ ...initial });
    }, []),
  );
  return (
    <SettingsScreen title="알림 설정">
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>알림 기능은 준비 중이에요.</Text>
        <Text style={styles.body}>
          설정 화면 미리보기이며 실제 알림은 발송되지 않아요. 변경값은 저장되지
          않고, 화면을 나가면 초기화돼요.
        </Text>
      </View>
      <View style={styles.list}>
        {options.map(({ id, label, description }, index) => {
          const checked = settings[id];
          const toggle = () =>
            setSettings((previous) => ({ ...previous, [id]: !previous[id] }));
          return (
            <Pressable
              key={id}
              accessibilityRole="switch"
              accessibilityLabel={label}
              accessibilityHint="저장하거나 실제 알림을 발송하지 않는 화면 미리보기예요."
              accessibilityState={{ checked }}
              aria-checked={checked}
              onPress={toggle}
              {...(Platform.OS === 'web'
                ? {
                    // RN Web activates Enter for switch roles, but reserves Space for buttons.
                    onKeyDownCapture: (
                      event: Parameters<
                        NonNullable<PressableProps['onKeyDownCapture']>
                      >[0],
                    ) => {
                      if (event.nativeEvent.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!(
                          'repeat' in event.nativeEvent &&
                          event.nativeEvent.repeat === true
                        ))
                          toggle();
                      }
                    },
                  }
                : {})}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.divider,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.copy}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.caption}>{description}</Text>
                <Text style={styles.caption}>{checked ? '켜짐' : '꺼짐'}</Text>
              </View>
              <View
                accessible={false}
                style={[styles.track, checked && styles.trackChecked]}
              >
                <View style={styles.thumb} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  notice: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.tint,
    gap: spacing.sm,
  },
  noticeTitle: { ...typography.label, color: colors.onTint },
  body: { ...typography.body, color: colors.text },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    minHeight: 76,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  label: { ...typography.label, color: colors.heading },
  caption: { ...typography.caption, color: colors.muted },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.tint },
  track: {
    width: 44,
    height: 28,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.controlBorder,
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  trackChecked: { backgroundColor: colors.primary, alignItems: 'flex-end' },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
