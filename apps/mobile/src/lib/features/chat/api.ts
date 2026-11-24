import { createClient } from '../../api/client';
import type { AuthSession } from '../auth';
import type { ChatMessage } from './types';

export const CHAT_MESSAGE_LIMIT = 4000;
const CHAT_HISTORY_LIMIT = 20;

export function generateChatReply(
  session: Pick<AuthSession, 'request'>,
  message: string,
  messages: ChatMessage[],
) {
  const history = messages
    .slice(-CHAT_HISTORY_LIMIT)
    .map(({ role, content }) => ({
      role,
      content: content.slice(0, CHAT_MESSAGE_LIMIT).trim(),
    }));
  return createClient(session.request.bind(session)).post<{ content: string }>(
    '/api/v1/chat/generate',
    { message, history },
    { timeoutMs: 45000 },
  );
}
