import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'seller';
  kiosk_id?: number;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 AuthProvider: Checking authentication...');
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log('👤 Found cached user:', parsedUser.username);
        setUser(parsedUser);
      } catch (e) {
        console.error('❌ Failed to parse saved user:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setLoading(false);
        return;
      }
      
      // Verify token with timeout
      const timeoutId = setTimeout(() => {
        setLoading(false);
        console.warn('⏱️ API request timeout - using cached user');
      }, 10000); // 10 second timeout (increased for production)
      
      console.log('🔄 Verifying token with API...');
      api.get('/auth/me')
        .then((res) => {
          clearTimeout(timeoutId);
          console.log('✅ Token verified, user:', res.data.username);
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          console.error('❌ Token verification failed:', err.message || err);
          if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
          }
          // Don't clear user immediately - let them try to use the app
          // If API fails, they'll be redirected to login on next request
          if (err.response?.status === 401) {
            console.log('🔓 401 Unauthorized - clearing auth data');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
          setLoading(false);
        });
    } else {
      console.log('ℹ️ No token found, user not authenticated');
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const { token, user: userData } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

