import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { setCurrentOrgId } from '@/mock/store';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  organizationId: string | null;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      organizationId: null,
      setAuth: (user, token, refreshToken) => {
        setCurrentOrgId(user.organizationId);
        set({ user, token, refreshToken: refreshToken ?? null, organizationId: user.organizationId });
      },
      setUser: (user) => {
        setCurrentOrgId(user.organizationId);
        set({ user, organizationId: user.organizationId });
      },
      setToken: (token) => set({ token }),
      logout: () => {
        setCurrentOrgId(null);
        set({ user: null, token: null, refreshToken: null, organizationId: null });
      },
    }),
    {
      name: 'auth-storage-v3',
      partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken, user: s.user, organizationId: s.organizationId }),
      onRehydrateStorage: () => (state) => {
        if (state?.user?.organizationId) {
          setCurrentOrgId(state.user.organizationId);
        }
      },
    }
  )
);
