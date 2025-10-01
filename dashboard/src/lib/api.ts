import type { Campaign, CreateCampaignDto, UpdateCampaignStatusDto } from '@/types/campaign';
import type { Creative, UploadCreativeDto } from '@/types/creative';
import type { User, LoginDto, AuthResponse } from '@/types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
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
