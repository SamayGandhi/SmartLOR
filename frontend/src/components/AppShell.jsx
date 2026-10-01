import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, FileCheck2, FileText, HelpCircle, LayoutDashboard, LogOut, Menu, MessageSquare, Settings, ShieldCheck, Users, X, ClipboardList, UserRoundCheck, Sun, Moon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import api from '../api';

const titles = {
  '/dashboard': ['Workspace', 'Dashboard'], '/request-lor': ['Requests', 'New LOR Request'], '/my-requests': ['Requests', 'My Requests'], '/request-documents': ['Requests', 'Update Supporting Documents'],
  '/requests': ['Requests', 'Request Inbox'], '/professor-verification': ['Account', 'Faculty Verification'], '/profile': ['Account', 'Profile & Settings'],
  '/feedback': ['Support', 'Feedback'], '/notifications': ['Workspace', 'Notifications'], '/admin': ['Administration', 'Admin Overview'], '/admin/users': ['Administration', 'Users & Verification'], '/admin/requests': ['Administration', 'All Requests'],
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('smartlor_theme') || 'dark');
  const navigate = useNavigate();
  const professorLocked = user.role === 'professor' && user.professorVerification?.status !== 'verified';
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme !== 'light');
    localStorage.setItem('smartlor_theme', theme);
  }, [theme]);
  useEffect(() => {
    let active = true;
    const loadUnread = async () => { try { const { data } = await api.get('/notifications?limit=1'); if (active) setUnreadNotifications(data.unreadCount || 0); } catch {} };
    loadUnread();
    const timer = window.setInterval(loadUnread, 30000);
    const handler = () => loadUnread();
    window.addEventListener('smartlor:notifications-refresh', handler);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('smartlor:notifications-refresh', handler); };
  }, []);
  const lockedPathAllowed = location.pathname.startsWith('/professor-verification') || location.pathname.startsWith('/profile');
  if (professorLocked && !lockedPathAllowed) return <Navigate to="/professor-verification" replace />;

  const groups = useMemo(() => {
    if (user.role === 'admin') return [
      { title: 'Overview', items: [{ to: '/admin', label: 'Admin Overview', icon: LayoutDashboard, end: true }] },
      { title: 'Operations', items: [{ to: '/admin/users', label: 'Users & Verification', icon: Users }, { to: '/admin/requests', label: 'All Requests', icon: ClipboardList }] },
      { title: 'Support', items: [{ to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications }, { to: '/feedback', label: 'Feedback', icon: MessageSquare }, { to: '/profile', label: 'Profile & Settings', icon: Settings }] },
    ];
    if (professorLocked) return [{ title: 'Account setup', items: [{ to: '/professor-verification', label: 'Faculty Verification', icon: UserRoundCheck }, { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications }, { to: '/profile', label: 'Profile & Settings', icon: Settings }] }];
    return [
      { title: 'Workspace', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
      { title: user.role === 'student' ? 'Recommendation' : 'Incoming work', items: user.role === 'student' ? [{ to: '/request-lor', label: 'New LOR Request', icon: FileText }, { to: '/my-requests', label: 'My Requests', icon: FileCheck2 }] : [{ to: '/requests', label: 'Request Inbox', icon: ClipboardList }] },
      { title: 'Account & support', items: [{ to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications }, { to: '/feedback', label: 'Feedback & Help', icon: HelpCircle }, { to: '/profile', label: 'Profile & Settings', icon: Settings }] },
    ];
  }, [user.role, professorLocked, unreadNotifications]);

  const doLogout = async () => { await logout(); navigate('/login'); };
  const [section, page] = titles[location.pathname] || ['SmartLOR', 'Workspace'];

  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><FileText size={20}/></div><div><strong>SmartLOR</strong><span>Recommendation workspace</span></div><button className="icon-btn mobile-only" onClick={() => setOpen(false)}><X size={20}/></button></div>
      <div className="workspace-card"><span className="workspace-status"/><div><strong>{user.role === 'admin' ? 'Control Center' : user.role === 'professor' ? (professorLocked ? 'Verification required' : 'Faculty Workspace') : 'Student Workspace'}</strong><span>{professorLocked ? 'Complete verification to continue' : 'Secure recommendation workflow'}</span></div></div>
      <nav className="nav-groups">{groups.map(group => <div className="nav-group" key={group.title}><span className="nav-group-title">{group.title}</span>{group.items.map(({ to, label, icon: Icon, end, badge }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={18}/><span className="nav-label">{label}</span>{badge>0&&<span className="nav-badge">{badge>99?'99+':badge}</span>}<ChevronRight className="nav-chevron" size={14}/></NavLink>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="mini-user"><div className="avatar">{user.name?.charAt(0)?.toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.role}</span></div></div><button className="logout-link" onClick={doLogout}><LogOut size={17}/> Sign out</button></div>
    </aside>
    {open && <button className="sidebar-overlay" onClick={() => setOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setOpen(true)}><Menu size={22}/></button><div className="breadcrumb"><span>{section}</span><ChevronRight size={13}/><strong>{page}</strong></div></div><div className="topbar-actions"><NotificationBell/><button type="button" className="theme-toggle" onClick={()=>setTheme(v=>v==='dark'?'light':'dark')} aria-label={`Switch to ${theme==='dark'?'light':'dark'} theme`} title={`Switch to ${theme==='dark'?'light':'dark'} theme`}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}<span>{theme==='dark'?'Light':'Dark'}</span></button><div className="role-pill"><ShieldCheck size={15}/> {professorLocked ? 'Verification pending' : 'Secure session'}</div><div className="avatar small">{user.name?.charAt(0)?.toUpperCase()}</div></div></header>
      <div className="mobile-page-title"><span>{section}</span><strong>{page}</strong></div>
      <section className="page-content"><Outlet/></section>
    </main>
  </div>;
}
