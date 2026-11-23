import { Button, Host, Image, Menu } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  disabled,
  frame,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import type { ScheduleAddMenuProps } from './schedule-add-menu';

export function ScheduleAddMenu({
  canAdd,
  onAdd,
  onRecommend,
}: ScheduleAddMenuProps) {
  return (
    <Host style={styles.host}>
      <Menu
        label={
          <Image
            systemName="plus"
            size={20}
            color={colors.onTint}
            modifiers={[
              frame({ width: 48, height: 48 }),
              contentShape(shapes.circle()),
            ]}
          />
        }
        modifiers={[buttonStyle('plain'), accessibilityLabel('일정 추가 메뉴')]}
      >
        <Button
          label="직접 추가"
          systemImage="calendar.badge.plus"
          modifiers={[disabled(!canAdd)]}
          onPress={onAdd}
        />
        <Button
          label="AI 활동 추천"
          systemImage="sparkles"
          onPress={onRecommend}
        />
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tint,
  },
});
