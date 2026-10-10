import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../api/types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  profileComplete: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (full_name: string, email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  loginAsDemo: () => Promise<void>;
  setProfileComplete: (complete: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('opportunityos_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('opportunityos_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [profileComplete, setProfileCompleteState] = useState<boolean>(() => {
    return localStorage.getItem('opportunityos_profile_complete') === 'true';
  });

  const setProfileComplete = (complete: boolean) => {
    setProfileCompleteState(complete);
    localStorage.setItem('opportunityos_profile_complete', String(complete));
  };

  const saveAuth = (authData: AuthResponse) => {
    setToken(authData.access_token);
    setUser(authData.user);
    setProfileCompleteState(authData.profile_complete);
    localStorage.setItem('opportunityos_token', authData.access_token);
    localStorage.setItem('opportunityos_user', JSON.stringify(authData.user));
    localStorage.setItem('opportunityos_profile_complete', String(authData.profile_complete));
  };

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    saveAuth(res.data);
    return res.data;
  };

  const register = async (full_name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register', { full_name, email, password });
    saveAuth(res.data);
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfileCompleteState(false);
    localStorage.removeItem('opportunityos_token');
    localStorage.removeItem('opportunityos_user');
    localStorage.removeItem('opportunityos_profile_complete');
  };

  useEffect(() => {
    const handleAuthExpired = (event: any) => {
      setToken(null);
      setUser(null);
      setProfileComplete(false);
      const redirectUrl = event?.detail?.redirect;
      if (redirectUrl && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
        window.location.href = `/login?redirect=${encodeURIComponent(redirectUrl)}`;
      }
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (token) {
      apiClient.get('/profile')
        .then((res) => {
          if (res.data?.profile_complete !== undefined) {
            setProfileComplete(Boolean(res.data.profile_complete));
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const loginAsDemo = async () => {
    try {
      await login('mitva@example.com', 'DemoPass123!');
    } catch (e) {
      try {
        await login('riya@example.com', 'DemoPass123!');
      } catch {
        const reg = await register('Mitva Satani', 'mitva@example.com', 'DemoPass123!');
        saveAuth(reg);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        profileComplete,
        login,
        register,
        logout,
        loginAsDemo,
        setProfileComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
