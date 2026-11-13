import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../../lib/features/chat/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const user = message.role === 'user';
  return (
    <View style={[styles.row, user ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, user ? styles.user : styles.assistant]}>
        <Text
          testID={`chat-message-${message.role}`}
          accessibilityLabel={`${user ? '나' : '육아 도우미'}: ${message.content}`}
          selectable
          style={[styles.content, user && styles.userContent]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '86%',
    minWidth: 0,
    flexShrink: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  user: { backgroundColor: colors.tint, borderBottomRightRadius: 6 },
  assistant: { backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  content: { ...typography.body, color: colors.text, flexShrink: 1 },
  userContent: { color: colors.onTint },
});
