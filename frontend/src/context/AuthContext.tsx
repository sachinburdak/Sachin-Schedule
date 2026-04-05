import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setToken, clearToken } from '../utils/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await apiFetch('/api/auth/me');
      setUser({ id: data._id || data.id, email: data.email, name: data.name, role: data.role });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (data.access_token) {
      await setToken(data.access_token);
    }
    setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    if (data.access_token) {
      await setToken(data.access_token);
    }
    setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
