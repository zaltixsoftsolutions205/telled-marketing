import { create } from 'zustand';

interface LogoState {
  logoUrl: string | null;
  companyName: string;
  setLogoUrl: (url: string | null) => void;
  setCompanyName: (name: string) => void;
  loadForOrg: (orgId: string) => void;
  saveForOrg: (orgId: string, url: string | null) => void;
  saveNameForOrg: (orgId: string, name: string) => void;
}

export const orgNameKey = (orgId: string) => `org_name_${orgId}`;

export const useLogoStore = create<LogoState>((set) => ({
  logoUrl: null,
  companyName: 'ZIEOS',

  setLogoUrl: (url) => set({ logoUrl: url }),
  setCompanyName: (name) => set({ companyName: name }),

  loadForOrg: (orgId) => {
    const name = localStorage.getItem(orgNameKey(orgId)) ?? 'ZIEOS';
    set({ companyName: name });
    // Clear stale cache
    localStorage.removeItem(`org_logo_${orgId}`);

    // Fetch full URL from backend — no resolving needed, backend returns complete URL
    import('../api/settings').then(({ settingsApi }) => {
      settingsApi.getLogo()
        .then(logoUrl => set({ logoUrl }))
        .catch(() => set({ logoUrl: null }));
    });
  },

  saveForOrg: (_orgId, url) => {
    set({ logoUrl: url });
  },

  saveNameForOrg: (orgId, name) => {
    localStorage.setItem(orgNameKey(orgId), name);
    set({ companyName: name });
  },
}));
