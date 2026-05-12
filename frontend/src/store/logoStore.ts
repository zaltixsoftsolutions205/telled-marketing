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
    // Load company name from localStorage
    const name = localStorage.getItem(orgNameKey(orgId)) ?? 'ZIEOS';
    set({ companyName: name });
    // Clear any stale logo cache (old base64 or relative paths)
    localStorage.removeItem(`org_logo_${orgId}`);

    // Always fetch from backend so all org users see the same logo
    import('../api/settings').then(({ settingsApi, resolveLogoUrl }) => {
      settingsApi.getLogo()
        .then(rawUrl => set({ logoUrl: rawUrl ? resolveLogoUrl(rawUrl) : null }))
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
