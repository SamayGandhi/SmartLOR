import { useState } from 'react';
import { ShieldCheck, Clock3, XCircle, FileText, UploadCloud, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { PageHeading } from './Dashboard';
import { showToast } from '../components/ToastHost';

const labels = {
  governmentId: 'Government-issued ID', facultyId: 'Faculty / Institution ID', appointmentLetter: 'Appointment / Employment Letter',
  qualification: 'Highest Qualification Certificate', experience: 'Experience / Service Certificate', cv: 'CV / Faculty Profile',
};
const required = ['governmentId','facultyId','appointmentLetter','qualification'];
const uploadLabels = {
  governmentId: 'Government-issued ID', facultyId: 'Faculty / Institution ID', appointmentLetter: 'Appointment / Employment Letter',
  qualification: 'Highest Qualification Certificate', experience: 'Experience / Service Certificate (optional)', cv: 'CV / Faculty Profile (optional)',
};

export default function ProfessorVerification(){
  const { user, updateUser } = useAuth(); const status = user?.professorVerification?.status || 'pending'; const rejected = status === 'rejected';
  const [files,setFiles]=useState({}); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [success,setSuccess]=useState('');
  const submit=async()=>{setError('');setSuccess('');const missing=required.filter(k=>!files[k]&&!user?.professorVerification?.documents?.some(d=>d.type===k));if(missing.length){setError('Please upload all required documents before submitting.');return;}const fd=new FormData();Object.entries(files).forEach(([k,v])=>v&&fd.append(k,v));setBusy(true);try{const {data}=await api.patch('/auth/professor-verification',fd);updateUser(data.user);setSuccess('Verification package submitted. An administrator will review it.');showToast('Verification package submitted. Admin has been notified.');window.dispatchEvent(new Event('smartlor:notifications-refresh'));setFiles({});}catch(e){const m=e.response?.data?.message||'Unable to submit verification package';setError(m);showToast(m,'error');}finally{setBusy(false);}};
  return <div className="verification-gate">
    <div className={`verification-hero ${rejected ? 'rejected' : ''}`}><div className="verification-hero-icon">{rejected?<XCircle size={30}/>:status==='verified'?<ShieldCheck size={30}/>:<Clock3 size={30}/>}</div><div><span className="eyebrow">FACULTY VERIFICATION</span><h1>{status==='verified'?'Professor account verified':rejected?'Verification needs attention':'Verification is under review'}</h1><p>{rejected?'An administrator rejected the submitted verification package. Correct the documents or information requested below and resubmit.':status==='verified'?'Your institution and faculty credentials are verified. You can now access the LOR request workflow.':'Your account cannot receive or approve LOR requests until an administrator completes the verification review.'}</p></div></div>
    {user?.professorVerification?.note&&<div className="alert info"><strong>Administrator note:</strong> {user.professorVerification.note}</div>}
    {status!=='verified'&&<section className="section-card verification-checklist"><div className="section-card-header"><div><span className="eyebrow">DOCUMENT PACKAGE</span><h2>Submit faculty evidence</h2></div><UploadCloud size={20}/></div><p className="subsection-help">Upload clear PDF, JPG or PNG copies. Required evidence: government ID, current faculty/institution ID, appointment/employment evidence and highest qualification. Experience/service evidence and CV can be added when applicable.</p><div className="document-grid">{Object.entries(uploadLabels).map(([key,label])=><label className={`document-upload ${files[key]?'selected':''}`} key={key}><div className="document-icon"><FileText size={17}/></div><div><strong>{label}{required.includes(key)&&' *'}</strong><span>{files[key]?.name||'PDF, JPG, JPEG or PNG · max 5 MB'}</span></div><input type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" required={false} onChange={e=>setFiles(f=>({...f,[key]:e.target.files?.[0]||null}))}/></label>)}</div><div className="form-actions left"><button className="btn primary" disabled={busy} onClick={submit}>{busy?'Submitting…':<><Send size={16}/> Submit for admin review</>}</button></div></section>}
    <section className="section-card verification-checklist"><div className="section-card-header"><div><span className="eyebrow">SUBMITTED EVIDENCE</span><h2>Current verification package</h2></div><ShieldCheck size={20}/></div><div className="verification-doc-grid">{(user?.professorVerification?.documents||[]).map(doc=><div className="verification-doc-card" key={doc._id}><div className="document-icon"><FileText size={18}/></div><div><strong>{labels[doc.type]||doc.type}</strong><span>{doc.originalName}</span></div><span className="verification-pill pending">Submitted</span></div>)}</div><div className="info-strip"><ShieldCheck size={18}/><span>These checks are an application-level institutional verification workflow. Exact document requirements can vary by institution; an administrator remains responsible for the final verification decision.</span></div></section>
    {error&&<div className="alert error">{error}</div>}{success&&<div className="alert success">{success}</div>}
    <PageHeading eyebrow="WHAT HAPPENS NEXT" title="Admin review before faculty access." text="Once the affiliation and submitted evidence are confirmed, your professor account becomes eligible to receive and approve LOR requests."/>
  </div>;
}
