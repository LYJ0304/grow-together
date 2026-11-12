import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function successFeedback() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
  }
}

// Selection is distinct from successful persistence. Unsupported devices are a no-op.
export function selectionFeedback() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    void Haptics.selectionAsync().catch(() => {});
  }
}
