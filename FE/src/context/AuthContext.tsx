import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

// Định nghĩa kiểu dữ liệu cho User
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'customer' | 'admin';
}

// 1. Thêm 'register' vào interface này
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>; // Thêm dòng này
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Kiểm tra user đã đăng nhập chưa khi load trang
  useEffect(() => {
    const storedUser = localStorage.getItem('ticketrush_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // TODO: Gọi API đăng nhập thật
      // Mock data đăng nhập thành công
      const mockUser: User = { id: '1', email, name: 'Alex Voyager', role: 'customer' };
      setUser(mockUser);
      localStorage.setItem('ticketrush_user', JSON.stringify(mockUser));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Thêm hàm register vào đây
  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      // TODO: Gọi API đăng ký thật ở đây
      // await axios.post('/api/auth/register', { email, password, fullName });
      
      // Giả lập delay mạng
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Nếu đăng ký thành công, tự động đăng nhập
      const newUser: User = { id: '2', email, name: fullName, role: 'customer' };
      setUser(newUser);
      localStorage.setItem('ticketrush_user', JSON.stringify(newUser));
      
      alert('Account created successfully!');
    } catch (error) {
      alert('Registration failed. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ticketrush_user');
    window.location.href = '/';
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated,  // ✅ Truyền vào value
    login,
    logout,
    register,
  }), [user, isAuthenticated]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated }}>
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