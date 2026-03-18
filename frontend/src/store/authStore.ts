import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

const setCurrentOrgId = (_id: string | null) => {}; // no-op — using real backend now

interface AuthState {
  user: User | null;
  token: string | null;
  organizationId: string | null;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      organizationId: null,
      setAuth: (user, token) => {
        setCurrentOrgId(user.organizationId);
        set({ user, token, organizationId: user.organizationId });
      },
      setUser: (user) => {
        setCurrentOrgId(user.organizationId);
        set({ user, organizationId: user.organizationId });
      },
      setToken: (token) => set({ token }),
      logout: () => {
        setCurrentOrgId(null);
        set({ user: null, token: null, organizationId: null });
      },
    }),
    {
      name: 'auth-storage-v2',   // bumped version clears stale cached demo data
      partialize: (s) => ({ token: s.token, user: s.user, organizationId: s.organizationId }),
      // Re-initialize the in-memory org context from persisted state on page reload
      onRehydrateStorage: () => (state) => {
        if (state?.user?.organizationId) {
          setCurrentOrgId(state.user.organizationId);
        }
      },
    }
  )
);
