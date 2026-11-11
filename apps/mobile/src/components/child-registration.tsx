import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from './auth-provider';
import { createChildApi } from '../lib/features/child/childApi';
import { useSessionValue } from '../lib/session-state';
import { ChildRegistrationModal } from './child-registration-modal';

const RegistrationContext = createContext<
  ((onReady: () => void) => Promise<void>) | null
>(null);

export function ChildRegistrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { client, status, accountKey, epoch } = useAuth();
  const pathname = usePathname();
  const profile = useQuery({
    queryKey: ['childProfile', accountKey, epoch],
    queryFn: () => createChildApi(client).getProfile(),
    enabled: status === 'authenticated',
    retry: false,
  });
  const [seen, setSeen] = useSessionValue('childRegistrationPromptSeen', false);
  const [dialog, setDialog] = useState<'missing' | 'error' | null>(null);
  const [checking, setChecking] = useState(false);
  const pending = useRef(false),
    alive = useRef(true),
    attempt = useRef(0);
  const action = useRef<(() => void) | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      status === 'authenticated' &&
      pathname === '/main' &&
      profile.isSuccess &&
      !profile.isFetching &&
      profile.data === null &&
      !seen
    ) {
      setSeen(true);
      setDialog('missing');
    }
  }, [
    status,
    pathname,
    profile.isSuccess,
    profile.isFetching,
    profile.data,
    seen,
    setSeen,
  ]);
  useEffect(() => {
    if (profile.isSuccess && profile.data) setDialog(null);
  }, [profile.isSuccess, profile.data]);
  const close = () => {
    attempt.current++;
    action.current = null;
    setDialog(null);
  };
  const requestChild = async (onReady: () => void) => {
    if (status === 'preview') {
      onReady();
      return;
    }
    if (status !== 'authenticated' || pending.current) return;
    const ticket = ++attempt.current;
    const current = () =>
      alive.current &&
      ticket === attempt.current &&
      client.getSnapshot().epoch === epoch &&
      client.getSnapshot().accountKey === accountKey;
    action.current = onReady;
    let result = profile;
    if (!profile.isSuccess || profile.isFetching) {
      pending.current = true;
      setChecking(true);
      const refreshed = await profile.refetch({ cancelRefetch: false });
      pending.current = false;
      if (alive.current) setChecking(false);
      if (!current()) return;
      result = refreshed;
    }
    if (!current()) return;
    if (result.isSuccess && result.data) {
      setDialog(null);
      action.current = null;
      onReady();
    } else if (result.isSuccess && result.data === null) {
      setSeen(true);
      setDialog('missing');
    } else {
      setDialog('error');
    }
  };
  const visible =
    status === 'authenticated' &&
    (dialog === 'error' ||
      (dialog === 'missing' && profile.isSuccess && profile.data === null));
  return (
    <RegistrationContext.Provider value={requestChild}>
      <View
        style={{ flex: 1 }}
        pointerEvents={visible ? 'none' : 'auto'}
        aria-hidden={visible}
        accessibilityElementsHidden={visible}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {visible ? (
        <ChildRegistrationModal
          error={dialog === 'error'}
          checking={checking}
          onClose={close}
          onRetry={() => {
            if (action.current) void requestChild(action.current);
          }}
          onRegister={() => {
            close();
            router.push('/onboarding');
          }}
        />
      ) : null}
    </RegistrationContext.Provider>
  );
}

export function useChildRegistration() {
  const requestChild = useContext(RegistrationContext);
  if (!requestChild) throw new Error('ChildRegistrationProvider is required');
  return requestChild;
}
