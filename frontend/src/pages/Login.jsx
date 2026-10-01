import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, FileText, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' }); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setError(''); const email = form.email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; } if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; } setBusy(true); try { await login(email, form.password); navigate(location.state?.from || '/dashboard', { replace: true }); } catch (err) { setError(err.response?.data?.message || 'Unable to sign in. Please try again.'); } finally { setBusy(false); } };
  return <AuthLayout title="Welcome back" subtitle="Sign in to manage your recommendation workflow."><form className="auth-form" onSubmit={submit}>
    {error && <div className="alert error">{error}</div>}
    <label>Email<input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
    <label>Password<div className="password-wrap"><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
    <button className="btn primary full" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={18}/></>}</button>
    <p className="auth-footer">New to SmartLOR? <Link to="/register">Create an account</Link></p>
  </form></AuthLayout>;
}

export function AuthLayout({ title, subtitle, children }) { return <div className="auth-page"><div className="auth-visual"><div className="auth-brand"><div className="brand-mark"><FileText size={22}/></div><strong>SmartLOR</strong></div><div className="visual-copy"><span className="eyebrow">SMARTER RECOMMENDATIONS</span><h1>Make every recommendation request feel <em>organized.</em></h1><p>One place for students, professors and administrators to create, review and deliver Letters of Recommendation.</p><div className="visual-points"><span>✓ Clear request tracking</span><span>✓ Secure role-based access</span><span>✓ PDF delivery in one workflow</span></div></div></div><div className="auth-panel"><div className="auth-card"><div className="mobile-brand"><div className="brand-mark"><FileText size={20}/></div><strong>SmartLOR</strong></div><span className="eyebrow">SECURE SIGN IN</span><h2>{title}</h2><p>{subtitle}</p>{children}</div></div></div> }
