import { randomUUID } from 'expo-crypto';
import { fetch as streamFetch } from 'expo/fetch';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ChatSession } from '../lib/chat-session';
import { AuthSession } from '../lib/features/auth';
import { tokenStorage } from '../lib/auth-storage';

const ChatContext = createContext<ChatSession | null>(null);
const AuthContext = createContext<AuthSession | null>(null);
const ChatDraftContext = createContext<{
  draft: string;
  setDraft: (value: string) => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [{ client, chat }] = useState(() => {
    let chat: ChatSession;
    const client = new AuthSession(tokenStorage, () => {
      queryClient.clear();
      setDraft('');
      chat?.clear();
    });
    chat = new ChatSession(client, streamFetch as typeof fetch, randomUUID);
    return { client, chat };
  });
  useEffect(() => {
    void client.restore();
  }, [client]);
  return (
    <AuthContext.Provider value={client}>
      <ChatContext.Provider value={chat}>
        <ChatDraftContext.Provider value={{ draft, setDraft }}>
          {children}
        </ChatDraftContext.Provider>
      </ChatContext.Provider>
    </AuthContext.Provider>
  );
}

export function useChatDraft() {
  const draft = useContext(ChatDraftContext);
  if (!draft) throw new Error('AuthProvider is required');
  return draft;
}

export function useAuth() {
  const client = useContext(AuthContext);
  if (!client) throw new Error('AuthProvider is required');
  const session = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );
  return { client, ...session };
}

export function useChat() {
  const client = useContext(ChatContext);
  if (!client) throw new Error('AuthProvider is required');
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );
  return { client, ...snapshot };
}
