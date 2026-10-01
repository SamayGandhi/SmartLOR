import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);
const IDLE_TIMEOUT_MS = Math.max(Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 30, 5) * 60 * 1000;
const LAST_ACTIVITY_KEY = 'smartlor_last_activity';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartlor_user')) || null; } catch { return null; }
  });
  const logoutTimer = useRef(null);
  const activityThrottle = useRef(null);

  const logout = async () => {
    try { if (localStorage.getItem('smartlor_token')) await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('smartlor_token');
    localStorage.removeItem('smartlor_user');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setUser(null);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  };

  useEffect(() => {
    if (!localStorage.getItem('smartlor_token')) return;
    api.get('/auth/me').then(({ data }) => {
      localStorage.setItem('smartlor_user', JSON.stringify(data));
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      setUser(data);
    }).catch(() => logout());
  }, []);

  useEffect(() => {
    if (!user || !localStorage.getItem('smartlor_token')) return undefined;
    const markActivity = () => {
      if (activityThrottle.current) return;
      activityThrottle.current = window.setTimeout(() => {
        activityThrottle.current = null;
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }, 1000);
    };
    const checkIdle = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= IDLE_TIMEOUT_MS) logout();
    };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    const interval = window.setInterval(checkIdle, 15000);
    return () => {
      events.forEach(event => window.removeEventListener(event, markActivity));
      window.clearInterval(interval);
      if (activityThrottle.current) window.clearTimeout(activityThrottle.current);
    };
  }, [user]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('smartlor_token', data.token);
    localStorage.setItem('smartlor_user', JSON.stringify(data.user));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('smartlor_token', data.token);
    localStorage.setItem('smartlor_user', JSON.stringify(data.user));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setUser(data.user);
    return data.user;
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('smartlor_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const updateUser = (next) => {
    localStorage.setItem('smartlor_user', JSON.stringify(next));
    setUser(next);
  };

  const value = useMemo(() => ({ user, login, register, logout, refreshUser, updateUser }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
