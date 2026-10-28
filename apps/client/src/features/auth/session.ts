import { useEffect, useState } from 'react';
import { firebaseEnabled, testAuth } from '../leagues/api';

export function useSession() {
  const [session, setSession] = useState<{
    loading: boolean;
    user: { uid: string; name: string } | null;
    error: string;
  }>({
    loading: !testAuth,
    user: testAuth
      ? {
          uid: localStorage.getItem('football.guest') ?? 'test-session',
          name: 'Treinador de teste',
        }
      : null,
    error: '',
  });
  useEffect(() => {
    if (testAuth) return;
    if (!firebaseEnabled) return;
    let active = true;
    let stop: (() => void) | undefined;
    void import('./firebase')
      .then((firebase) => {
        if (!active) return;
        stop = firebase.observeUser((user) =>
          setSession({
            loading: false,
            user:
              user && user.providerData.some((provider) => provider.providerId === 'google.com')
                ? { uid: user.uid, name: user.displayName ?? 'Treinador' }
                : null,
            error: '',
          }),
        );
      })
      .catch(() => {
        if (active)
          setSession({
            loading: false,
            user: null,
            error: 'Não foi possível conectar ao login Google.',
          });
      });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  return !firebaseEnabled && !testAuth ? { ...session, loading: false } : session;
}
