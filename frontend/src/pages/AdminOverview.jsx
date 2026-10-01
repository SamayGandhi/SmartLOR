import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, FileCheck2, FileText, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard';
import Loading from '../components/Loading';
import { PageHeading } from './Dashboard';
import { showToast } from '../components/ToastHost';

export default function AdminOverview() {
  const [stats, setStats] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/stats').then(r => setStats(r.data)).catch(e => { const m=e.response?.data?.message || 'Unable to load overview'; setError(m); showToast(m,'error'); }); }, []);
  if (error) return <div className="alert error">{error}</div>;
  if (!stats) return <Loading />;
  const total = stats.totalRequests || 0;
  const completion = total ? Math.round(stats.completed / total * 100) : 0;
  return <>
    <PageHeading eyebrow="ADMIN CONTROL CENTER" title="See the system, not just the numbers." text="A separate operational overview for users, verification, recommendation requests and final LOR delivery." action={<Link className="btn primary" to="/admin/requests"><FileText size={17}/> Review workflow</Link>} />
    <div className="overview-hero"><div><span className="eyebrow">WORKFLOW STATUS</span><h2>Every request has a clear verification trail.</h2><p>Documents are reviewed before a professor can approve the recommendation. Final completion requires the signed PDF.</p></div><div className="hero-ring"><strong>{completion}%</strong><span>completed</span></div></div>
    <div className="stats-grid"><StatCard icon={Users} label="Students" value={stats.students} hint="Registered accounts"/><StatCard icon={Users} label="Professors" value={stats.professors} hint="Faculty accounts"/><StatCard icon={Clock3} label="Verification queue" value={stats.verificationPending} hint="Needs document review" tone="warning"/><StatCard icon={FileCheck2} label="Completed LORs" value={stats.completed} hint="Signed PDF delivered" tone="success"/></div>
    <div className="stats-grid stats-grid-compact"><StatCard icon={FileText} label="Total requests" value={stats.totalRequests}/><StatCard icon={Clock3} label="Pending" value={stats.pending} tone="warning"/><StatCard icon={CheckCircle2} label="Approved" value={stats.approved} tone="success"/><StatCard icon={XCircle} label="Rejected" value={stats.rejected}/></div>
    <div className="two-col"><section className="section-card"><div className="section-head"><div><h3>Verification & delivery</h3><p>Operational checkpoints across the platform.</p></div><ShieldCheck size={22} className="muted-icon"/></div><div className="health-list"><Health label="Documents verified" value={stats.verified} total={total} /><Health label="Approved requests" value={stats.approved} total={total} /><Health label="Signed PDFs delivered" value={stats.completed} total={total} /></div></section><section className="section-card accent-card"><span className="eyebrow">ADMIN TOOLS</span><h3>Manage the workspace</h3><p>Use Users to manage accounts and All Requests to inspect the complete audit workflow.</p><div className="stack-actions"><Link className="btn primary" to="/admin/users">Manage users <ArrowUpRight size={16}/></Link><Link className="btn ghost-dark" to="/admin/requests">Open all requests <ArrowUpRight size={16}/></Link></div></section></div>
  </>;
}
function Health({label,value,total}) { const pct=total?Math.round(value/total*100):0; return <div className="health-row"><div className="health-label"><span>{label}</span><strong>{value}</strong></div><div className="progress"><span style={{width:`${pct}%`}}/></div><small>{pct}%</small></div>; }
