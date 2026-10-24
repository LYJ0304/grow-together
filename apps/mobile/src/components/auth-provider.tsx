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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [client] = useState(
    () => new AuthSession(tokenStorage, () => queryClient.clear()),
  );
  useEffect(() => {
    void client.restore();
  }, [client]);
  return <AuthContext.Provider value={client}>{children}</AuthContext.Provider>;
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
