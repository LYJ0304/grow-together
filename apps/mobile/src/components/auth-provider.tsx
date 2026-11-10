import { Text } from 'react-native';
import { onboardingDrafts } from '../lib/onboarding-draft-storage';
import { resetSessionState } from '../lib/session-state';
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
  const [draftNotice, setDraftNotice] = useState('');
  const [draft, setDraft] = useState('');
  const [client] = useState<AuthSession>(
    () =>
      new AuthSession(tokenStorage, () => {
        void onboardingDrafts
          .clearAll(client.getSnapshot().accountKey ?? undefined)
          .then(() => setDraftNotice(''))
          .catch(() =>
            setDraftNotice(
              '임시 입력을 삭제하지 못했어요. 이 기기에서 같은 계정으로 다시 확인해주세요.',
            ),
          );
        queryClient.clear();
        resetSessionState();
        setDraft('');
      }),
  );
  useEffect(() => {
    void client.restore();
  }, [client]);
  return (
    <AuthContext.Provider value={client}>
      <ChatDraftContext.Provider value={{ draft, setDraft }}>
        {draftNotice ? (
          <Text accessibilityRole="alert">{draftNotice}</Text>
        ) : null}
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
