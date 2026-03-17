import { mockAuth, setCurrentOrgId } from '@/mock/store';

export const authApi = {
  login: async (email: string, password: string) => {
    const result = await mockAuth.login(email, password);
    setCurrentOrgId(result.user.organizationId);
    return result;
  },
  signup: async (orgName: string, adminName: string, email: string, password: string) => {
    const result = await mockAuth.signup(orgName, adminName, email, password);
    setCurrentOrgId(result.user.organizationId);
    return result;
  },
  logout: async () => {
    await mockAuth.logout();
    setCurrentOrgId(null);
  },
  getMe: (userId: string) => mockAuth.getMe(userId),
};
