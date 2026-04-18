import api from './axios';
import { mockAuth } from '../mock/store';

// Normalize backend user (id → _id)
const normalizeUser = (user: any) => ({ ...user, _id: user._id || user.id });

const deviceKey = (email: string) => `device_token_${email.toLowerCase()}`;

export const authApi = {
  login: async (email: string, password: string): Promise<
    { requiresOtp: true; userId: string } |
    { requiresOtp: false; user: any; accessToken: string; refreshToken?: string; organizationName?: string }
  > => {
    const deviceToken = localStorage.getItem(deviceKey(email)) || undefined;
    const { data } = await api.post('/auth/login', { email, password, deviceToken });
    const d = data.data;
    if (d.userId) return { requiresOtp: true, userId: d.userId };
    return { requiresOtp: false, user: normalizeUser(d.user), accessToken: d.accessToken, refreshToken: d.refreshToken, organizationName: d.organizationName };
  },
  verifyLoginOtp: async (userId: string, otp: string, email: string) => {
    const { data } = await api.post('/auth/verify-login-otp', { userId, otp });
    const d = data.data;
    if (d.deviceToken) localStorage.setItem(deviceKey(email), d.deviceToken);
    return { user: normalizeUser(d.user), accessToken: d.accessToken, refreshToken: d.refreshToken, organizationName: d.organizationName };
  },
  signup: async (orgName: string, name: string, email: string, password: string, otp: string) => {
    const { data } = await api.post('/auth/signup', {
      orgName,
      name,
      email,
      password,
      otp
    });

    const d = data.data;
    return { user: normalizeUser(d.user), accessToken: d.accessToken };
  },
  logout: async () => {
    await mockAuth.logout();
  },
  getMe: async (_userId: string) => {
    const { data } = await api.get('/auth/me');
    return normalizeUser(data.data);
  },
};

export const otpApi = {
  send: async (email: string) => {
    const { data } = await api.post('/otp/send', { email });
    return data;
  }
};

export const authPasswordApi = {
  forgotPassword: async (email: string) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },
  resetPassword: async (token: string, password: string) => {
    const { data } = await api.post('/auth/reset-password', { token, password });
    return data;
  },
};
