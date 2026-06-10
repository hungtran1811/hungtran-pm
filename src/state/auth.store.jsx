import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  watchAuth,
  logout as authLogout,
  getGoogleRedirectResult,
} from '../services/auth.service.js';
import { fetchAdminProfile } from '../services/admins.service.js';

const AuthContext = createContext({
  user: null,
  admin: null,
  isAdmin: false,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Complete any pending Google redirect sign-in (errors surface here, not popup).
    getGoogleRedirectResult().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = watchAuth(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        try {
          const profile = await fetchAdminProfile(firebaseUser.email);
          setAdmin(profile?.active ? profile : null);
        } catch {
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      admin,
      isAdmin: Boolean(admin?.active),
      loading,
      logout: async () => {
        await authLogout();
        setAdmin(null);
      },
    }),
    [user, admin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
