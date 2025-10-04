import type { Campaign, CreateCampaignDto, UpdateCampaignStatusDto } from '@/types/campaign';
import type { Creative, UploadCreativeDto } from '@/types/creative';
import type { User, LoginDto, AuthResponse } from '@/types/auth';
import type { SummaryAnalytics, CampaignAnalytics } from '@/types/analytics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// Token management
export const tokenStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },
  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  },
};

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = tokenStorage.getToken();
  console.log('[fetchWithAuth] URL:', url, 'Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || error.error?.message || 'Request failed', error);
  }

  return response.json();
}

async function fetchWithAuthMultipart(url: string, options: RequestInit = {}) {
  const token = tokenStorage.getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || error.error?.message || 'Request failed', error);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: async (): Promise<void> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
    });
  },

  getProfile: async (): Promise<{ user: User }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/auth/profile`);
  },

  register: async (data: { email: string; password: string; name: string }): Promise<AuthResponse> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Campaign API
export const campaignApi = {
  getAll: async (): Promise<{ campaigns: Campaign[] }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns`);
  },

  getById: async (id: string): Promise<{ campaign: Campaign }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns/${id}`);
  },

  create: async (data: CreateCampaignDto): Promise<{ campaign: Campaign }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStatus: async (id: string, data: UpdateCampaignStatusDto): Promise<{ campaign: Campaign }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns/${id}`, {
      method: 'DELETE',
    });
  },
};

// Creative API
export const creativeApi = {
  getByCampaign: async (campaignId: string): Promise<{ creatives: Creative[] }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/creatives`);
  },

  getById: async (id: string): Promise<{ creative: Creative }> => {
    return fetchWithAuth(`${API_BASE_URL}/api/v1/creatives/${id}`);
  },

  upload: async (campaignId: string, data: UploadCreativeDto): Promise<{ creative: Creative }> => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('video', data.video);

    return fetchWithAuthMultipart(`${API_BASE_URL}/api/v1/campaigns/${campaignId}/creatives`, {
      method: 'POST',
      body: formData,
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchWithAuth(`${API_BASE_URL}/api/v1/creatives/${id}`, {
      method: 'DELETE',
    });
  },
};

// Analytics API
export const analyticsApi = {
  getSummary: async (params?: { start_date?: string; end_date?: string }): Promise<SummaryAnalytics> => {
    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const queryString = query.toString();
    return fetchWithAuth(`${API_BASE_URL}/api/v1/analytics/summary${queryString ? `?${queryString}` : ''}`);
  },

  getCampaignAnalytics: async (
    campaignId: string,
    params?: { start_date?: string; end_date?: string }
  ): Promise<CampaignAnalytics> => {
    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const queryString = query.toString();
    return fetchWithAuth(`${API_BASE_URL}/api/v1/analytics/campaigns/${campaignId}${queryString ? `?${queryString}` : ''}`);
  },
};
