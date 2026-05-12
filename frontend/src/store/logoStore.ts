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
    // Load company name from localStorage (set at login)
    const name = localStorage.getItem(orgNameKey(orgId)) ?? 'ZIEOS';
    set({ companyName: name });

    // Fetch logo from backend so all users in the org see the same logo
    import('../api/settings').then(({ settingsApi, resolveLogoUrl }) => {
      settingsApi.getLogo()
        .then(rawUrl => set({ logoUrl: rawUrl ? resolveLogoUrl(rawUrl) : null }))
        .catch(() => set({ logoUrl: null }));
    });
  },

  saveForOrg: (orgId, url) => {
    // Keep a local cache so the logo is instant on next load before the API responds
    if (url) {
      localStorage.setItem(`org_logo_${orgId}`, url);
    } else {
      localStorage.removeItem(`org_logo_${orgId}`);
    }
    set({ logoUrl: url });
  },

  saveNameForOrg: (orgId, name) => {
    localStorage.setItem(orgNameKey(orgId), name);
    set({ companyName: name });
  },
}));
