import { StyleSheet, View } from 'react-native';
import type { ChatMessage } from '../../lib/features/chat/types';
import { ChatMessageBubble } from './chat-message';

// Pure rendering: updating content under a stable id also renders streamed text.
export function ChatMessageList({
  messages,
}: {
  messages: readonly ChatMessage[];
}) {
  return (
    <View style={styles.list}>
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: 14 } });
