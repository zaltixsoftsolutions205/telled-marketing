import api from './axios';
import { useLogoStore } from '@/store/logoStore';
import { useAuthStore } from '@/store/authStore';

export const DEFAULT_LOGO = `${import.meta.env.BASE_URL}zaltix-logo.png`;

function currentOrgId(): string | null {
  return useAuthStore.getState().organizationId;
}

export const settingsApi = {
  getLogo: async (): Promise<string | null> => {
    const { data } = await api.get('/settings/logo');
    return data.data?.logoUrl ?? null;
  },

  uploadLogo: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await api.post('/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const logoUrl: string = data.data?.logoUrl ?? null;
    const orgId = currentOrgId();
    if (orgId) useLogoStore.getState().saveForOrg(orgId, logoUrl);
    else useLogoStore.getState().setLogoUrl(logoUrl);
    return logoUrl;
  },

  deleteLogo: async (): Promise<void> => {
    await api.delete('/settings/logo');
    const orgId = currentOrgId();
    if (orgId) useLogoStore.getState().saveForOrg(orgId, null);
    else useLogoStore.getState().setLogoUrl(null);
  },
};

export function resolveLogoUrl(logoUrl: string | null): string {
  if (!logoUrl) return DEFAULT_LOGO;
  if (logoUrl.startsWith('data:') || logoUrl.startsWith('http') || logoUrl.startsWith('/zieos')) return logoUrl;
  // Backend returns paths like /uploads/filename.png — prefix with API base
  const base = (import.meta.env.VITE_API_URL || '').replace('/api', '');
  return `${base}${logoUrl}`;
}
