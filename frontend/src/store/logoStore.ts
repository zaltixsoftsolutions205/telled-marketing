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

export const orgLogoKey = (orgId: string) => `org_logo_${orgId}`;
export const orgNameKey = (orgId: string) => `org_name_${orgId}`;

export const useLogoStore = create<LogoState>((set) => ({
  logoUrl: null,
  companyName: 'ZIEOS',

  setLogoUrl: (url) => set({ logoUrl: url }),
  setCompanyName: (name) => set({ companyName: name }),

  loadForOrg: (orgId) => {
    const url = localStorage.getItem(orgLogoKey(orgId)) ?? null;
    const name = localStorage.getItem(orgNameKey(orgId)) ?? 'ZIEOS';
    set({ logoUrl: url, companyName: name });
  },

  saveForOrg: (orgId, url) => {
    if (url) {
      localStorage.setItem(orgLogoKey(orgId), url);
    } else {
      localStorage.removeItem(orgLogoKey(orgId));
    }
    set({ logoUrl: url });
  },

  saveNameForOrg: (orgId, name) => {
    localStorage.setItem(orgNameKey(orgId), name);
    set({ companyName: name });
  },
}));
