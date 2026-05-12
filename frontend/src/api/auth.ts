import api from './axios';

// Normalize backend user (id → _id)
const normalizeUser = (user: any) => ({ ...user, _id: user._id || user.id });

const deviceKey = (email: string) => `device_token_${email.toLowerCase()}`;

export const authApi = {
  login: async (
    email: string,
    password: string,
    appPassword?: string,
    smtpHost?: string,
    smtpPort?: number,
    smtpSecure?: boolean,
  ): Promise<
    { requiresOtp: true; userId: string; deviceToken?: string } |
    { requiresOtp: false; user: any; accessToken: string; refreshToken?: string; organizationName?: string }
  > => {
    const deviceToken = localStorage.getItem(deviceKey(email)) || undefined;
    const { data } = await api.post('/auth/login', {
      email, password, deviceToken,
      ...(appPassword ? { appPassword } : {}),
      ...(smtpHost ? { smtpHost, smtpPort, smtpSecure } : {}),
    });
    const d = data.data;
    if (d.userId) return { requiresOtp: true, userId: d.userId, deviceToken: d.deviceToken };
    return { requiresOtp: false, user: normalizeUser(d.user), accessToken: d.accessToken, refreshToken: d.refreshToken, organizationName: d.organizationName };
  },
  verifyLoginOtp: async (userId: string, otp: string, email: string, deviceToken?: string) => {
    const { data } = await api.post('/auth/verify-login-otp', { userId, otp, deviceToken });
    const d = data.data;
    if (d.requiresAppPassword) {
      return { requiresAppPassword: true as const, userId: d.userId, email: d.email, deviceToken: d.deviceToken, isPersonal: d.isPersonal, providerOnly: d.providerOnly };
    }
    if (d.deviceToken) localStorage.setItem(deviceKey(email), d.deviceToken);
    return { requiresAppPassword: false as const, user: normalizeUser(d.user), accessToken: d.accessToken, refreshToken: d.refreshToken, organizationName: d.organizationName };
  },
  saveAppPassword: async (userId: string, appPassword: string | undefined, email: string, deviceToken?: string, smtpHost?: string, smtpPort?: number, smtpSecure?: boolean) => {
    const { data } = await api.post('/auth/save-app-password', { userId, ...(appPassword ? { appPassword } : {}), deviceToken, smtpHost, smtpPort, smtpSecure });
    const d = data.data;
    if (d.deviceToken) localStorage.setItem(deviceKey(email), d.deviceToken);
    return { user: normalizeUser(d.user), accessToken: d.accessToken, refreshToken: d.refreshToken, organizationName: d.organizationName };
  },
  signup: async (orgName: string, name: string, email: string, password: string, otp: string) => {
    const { data } = await api.post('/auth/signup', { orgName, name, email, password, otp });
    const d = data.data;
    return { user: normalizeUser(d.user), accessToken: d.accessToken };
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore — token may already be expired */ }
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

export const microsoftOAuthApi = {
  getAuthUrl: async (userId: string): Promise<string> => {
    const { data } = await api.get(`/auth/microsoft/authorize?userId=${userId}`);
    return data.data.authUrl;
  },
  getStatus: async (): Promise<{ connected: boolean; email: string | null }> => {
    const { data } = await api.get('/auth/microsoft/status');
    return data.data;
  },
  disconnect: async (): Promise<void> => {
    await api.delete('/auth/microsoft/disconnect');
  },
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
