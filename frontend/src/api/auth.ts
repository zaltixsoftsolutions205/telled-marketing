import api from './axios';

// Normalize backend user (id → _id)
const normalizeUser = (user: any) => ({ ...user, _id: user._id || user.id });

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const d = data.data;
    return { user: normalizeUser(d.user), accessToken: d.accessToken };
  },
  signup: async (orgName: string, adminName: string, email: string, password: string) => {
    const { data } = await api.post('/auth/signup', { orgName, name: adminName, email, password });
    const d = data.data;
    return { user: normalizeUser(d.user), accessToken: d.accessToken };
  },
  logout: async () => {
    await api.post('/auth/logout');
  },
  getMe: async (_userId: string) => {
    const { data } = await api.get('/auth/me');
    return normalizeUser(data.data);
  },
};
