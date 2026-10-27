import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { api, errorMessage } from '../services/api';

interface AuthState { user: User | null; loading: boolean; endingSession: boolean; error: string; login: (identificador: string, password: string) => Promise<void>; register: (data: Record<string, string>) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endingSession, setEndingSession] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { if (endingSession && location.pathname === '/') setEndingSession(false); }, [endingSession, location.pathname]);
  useEffect(() => {
    const controller = new AbortController();
    api<{ usuario: User | null }>('/auth/me', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setUser(result.usuario); }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function login(identificador: string, password: string) { const result = await api<{ usuario: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ identificador, password }) }); setUser(result.usuario); setError(''); }
  async function register(data: Record<string, string>) { const result = await api<{ usuario: User }>('/auth/registro', { method: 'POST', body: JSON.stringify(data) }); setUser(result.usuario); setError(''); }
  async function logout() {
    setEndingSession(true);
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); navigate('/', { replace: true }); }
    catch (error) { setEndingSession(false); throw error; }
  }
  return <AuthContext.Provider value={{ user, loading, endingSession, error, login, register, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider requerido'); return context; }
