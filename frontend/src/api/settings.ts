import { useLogoStore } from '@/store/logoStore';

export const settingsApi = {
  getLogo: async (): Promise<string | null> => {
    return useLogoStore.getState().logoUrl;
  },
  uploadLogo: async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        useLogoStore.getState().setLogoUrl(url);
        resolve(url);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  deleteLogo: async (): Promise<void> => {
    useLogoStore.getState().setLogoUrl(null);
  },
};

export function resolveLogoUrl(logoUrl: string | null): string | null {
  return logoUrl; // DataURLs are self-contained
}
