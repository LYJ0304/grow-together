import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AuthSession } from '../lib/features/auth';
import { tokenStorage } from '../lib/auth-storage';

const AuthContext = createContext<AuthSession | null>(null);
const ChatDraftContext = createContext<{
  draft: string;
  setDraft: (value: string) => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [client] = useState(
    () =>
      new AuthSession(tokenStorage, () => {
        queryClient.clear();
        setDraft('');
      }),
  );
  useEffect(() => {
    void client.restore();
  }, [client]);
  return (
    <AuthContext.Provider value={client}>
      <ChatDraftContext.Provider value={{ draft, setDraft }}>
        {children}
      </ChatDraftContext.Provider>
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
