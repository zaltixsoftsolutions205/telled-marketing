import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LogoState {
  logoUrl: string | null;
  companyName: string;
  setLogoUrl: (url: string | null) => void;
  setCompanyName: (name: string) => void;
}

export const useLogoStore = create<LogoState>()(
  persist(
    (set) => ({
      logoUrl: null,
      companyName: '',
      setLogoUrl: (url) => set({ logoUrl: url }),
      setCompanyName: (name) => set({ companyName: name }),
    }),
    { name: 'telled-logo' }
  )
);
