import { useLogoStore } from '@/store/logoStore';
import { useAuthStore } from '@/store/authStore';

// Use import.meta.env.BASE_URL so it works under any base path (e.g. /zieos/)
export const DEFAULT_LOGO = `${import.meta.env.BASE_URL}zaltix-logo.png`;

function currentOrgId(): string | null {
  return useAuthStore.getState().organizationId;
}

export const settingsApi = {
  getLogo: async (): Promise<string | null> => {
    return useLogoStore.getState().logoUrl;
  },
  uploadLogo: async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        const orgId = currentOrgId();
        if (orgId) {
          useLogoStore.getState().saveForOrg(orgId, url);
        } else {
          useLogoStore.getState().setLogoUrl(url);
        }
        resolve(url);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  deleteLogo: async (): Promise<void> => {
    const orgId = currentOrgId();
    if (orgId) {
      useLogoStore.getState().saveForOrg(orgId, null);
    } else {
      useLogoStore.getState().setLogoUrl(null);
    }
  },
};

export function resolveLogoUrl(logoUrl: string | null): string {
  if (logoUrl) return logoUrl;
  return DEFAULT_LOGO;
}
