import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function successFeedback() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }
}
