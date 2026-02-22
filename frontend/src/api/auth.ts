import { mockAuth } from '@/mock/store';
export const authApi = {
  login: (email: string, password: string) => mockAuth.login(email, password),
  logout: () => mockAuth.logout(),
  getMe: (userId: string) => mockAuth.getMe(userId),
};
