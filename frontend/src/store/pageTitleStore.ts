import { create } from 'zustand';

interface PageTitleState {
  subtitle: string | null;
  setSubtitle: (title: string | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  subtitle: null,
  setSubtitle: (subtitle) => set({ subtitle }),
}));
