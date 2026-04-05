import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type FetchOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem('access_token', token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem('access_token');
}

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail;
    let message = 'Something went wrong';
    if (typeof detail === 'string') message = detail;
    else if (Array.isArray(detail)) message = detail.map((e: any) => e.msg || JSON.stringify(e)).join(' ');
    throw new Error(message);
  }
  return response.json();
}
