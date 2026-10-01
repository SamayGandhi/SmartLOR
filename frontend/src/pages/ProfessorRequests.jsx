import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Eye, FileText, Search, ShieldCheck, X, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';
import { PageHeading } from './Dashboard';
import { showToast } from '../components/ToastHost';

const Help=({children})=><small className="field-hint">{children}</small>;

export default function ProfessorRequests(){
  const navigate=useNavigate();
  const [requests,setRequests]=useState([]);
  const [search,setSearch]=useState('');
  const [college,setCollege]=useState('');
  const [university,setUniversity]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [response,setResponse]=useState({});
  const [verifyNote,setVerifyNote]=useState({});
  const [error,setError]=useState('');

  const load=()=>{
    setLoading(true); setError('');
    api.get('/requests/professor',{params:{...(college?{college}:{}),...(university?{university}:{})}})
      .then(r=>setRequests(Array.isArray(r.data)?r.data:[]))
      .catch(e=>{const m=e.response?.data?.message||'Unable to load requests';setError(m);showToast(m,'error');})
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[college,university]);

  const filtered=useMemo(()=>requests.filter(r=>`${r.student?.name||''} ${r.student?.email||''} ${r.student?.college||''} ${r.student?.university||''} ${r.purpose||''}`.toLowerCase().includes(search.toLowerCase())),[requests,search]);
  const colleges=[...new Set(requests.map(r=>r.student?.college).filter(Boolean))].sort();
  const universities=[...new Set(requests.map(r=>r.student?.university).filter(Boolean))].sort();

  const review=async(r,newStatus)=>{
    setBusy(r._id);setError('');
    try{
      const {data}=await api.patch(`/requests/${r._id}/status`,{status:newStatus,responseMessage:response[r._id]||''});
      window.dispatchEvent(new Event('smartlor:notifications-refresh'));
      setRequests(prev=>prev.filter(x=>x._id!==r._id));
      showToast(data.message||`Request ${newStatus}.`);
      if(newStatus==='approved'){
        // Approved work leaves the request inbox immediately and has its own protected workspace.
        navigate(`/recommendation-workspace/${r._id}`);
      }
    }catch(e){
      const m=e.response?.data?.message||'Unable to update request';setError(m);showToast(m,'error');
    }finally{setBusy('');}
  };

  const remove=async r=>{
    if(!window.confirm('Delete this pending request and its uploaded documents? This cannot be undone.'))return;
    setBusy(`delete-${r._id}`);
    try{
      const {data}=await api.delete(`/requests/${r._id}`);
      setRequests(prev=>prev.filter(x=>x._id!==r._id));
      showToast(data.message||'Pending request deleted.');
    }catch(e){showToast(e.response?.data?.message||'Unable to delete request','error');}
    finally{setBusy('');}
  };

  const verify=async(r,newStatus)=>{
    setBusy(`verify-${r._id}`);setError('');
    try{
      const {data}=await api.patch(`/requests/${r._id}/verification`,{status:newStatus,note:verifyNote[r._id]||''});
      setRequests(prev=>prev.map(x=>x._id===r._id?data.request:x));
      window.dispatchEvent(new Event('smartlor:notifications-refresh'));
      showToast(data.message||'Document verification updated.');
      if(newStatus==='verified'){
        window.setTimeout(()=>document.getElementById(`approval-${r._id}`)?.scrollIntoView({behavior:'smooth',block:'center'}),180);
      }
    }catch(e){
      const m=e.response?.data?.message||'Unable to update verification';setError(m);showToast(m,'error');
    }finally{setBusy('');}
  };

  const downloadDoc=async(r,doc)=>{
    try{
      const res=await api.get(`/requests/${r._id}/documents/${doc._id}`,{responseType:'blob'});
      const url=URL.createObjectURL(res.data);const a=document.createElement('a');a.href=url;a.download=doc.originalName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch(e){showToast(e.response?.data?.message||'Unable to download document','error');}
  };
  const viewDoc=async(r,doc)=>{
    const tab=window.open('about:blank','_blank');
    try{
      if(!tab)throw new Error('Please allow pop-ups to preview documents.');
      const res=await api.get(`/requests/${r._id}/documents/${doc._id}?inline=true`,{responseType:'blob'});
      const url=URL.createObjectURL(res.data);tab.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){if(tab&&!tab.closed)tab.close();showToast(e.response?.data?.message||e.message||'Unable to preview document','error');}
  };

  const renderRequest=r=><article id={`request-${r._id}`} className="request-card professor-request" key={r._id}>
    <div className="request-main">
      <div className="avatar large">{r.student?.name?.charAt(0)}</div>
      <div className="request-content">
        <div className="request-title"><h3>{r.student?.name}</h3><StatusBadge status={r.status}/><span className={`verification-pill ${r.verification?.status||'pending'}`}>{r.verification?.status||'pending'} verification</span></div>
        <p className="muted">{r.student?.email} · {r.student?.studentId||'ID not provided'}</p>
        <div className="identity-grid"><span><strong>College</strong>{r.student?.college||'—'}</span><span><strong>University</strong>{r.student?.university||'—'}</span><span><strong>Course</strong>{r.student?.course||'—'}</span><span><strong>Semester</strong>{r.student?.semester||'—'}</span></div>
        <div className="purpose-line"><strong>{r.purpose}</strong><span>Needed by {new Date(r.deadline).toLocaleDateString()}</span></div>
        <p>{r.message}</p>
      </div>
    </div>
    <div className="verification-panel">
      <div className="panel-heading"><div><span className="eyebrow">DOCUMENT VERIFICATION</span><h4>Evidence checklist</h4></div><ShieldCheck size={20}/></div>
      <div className="doc-list">{(r.documents||[]).map(doc=><div className="doc-row" key={doc._id}><FileText size={16}/><span>{doc.type}</span><small>{doc.originalName}</small>{r.verification?.status==='pending'?<><button className="icon-btn" type="button" title="View document" onClick={()=>viewDoc(r,doc)}><Eye size={14}/></button><button className="icon-btn" type="button" title="Download document" onClick={()=>downloadDoc(r,doc)}><Download size={14}/></button></>:<span className="reviewed-chip"><Check size={13}/> Reviewed</span>}</div>)}</div>
      {r.verification?.status==='pending'&&<><textarea className="compact-textarea" rows="2" placeholder="Verification note — explain what needs correction if rejecting." value={verifyNote[r._id]||''} onChange={e=>setVerifyNote({...verifyNote,[r._id]:e.target.value})}/><div className="form-actions left"><button className="btn danger small" disabled={busy===`verify-${r._id}`} onClick={()=>verify(r,'rejected')}><X size={15}/> Reject verification</button><button className="btn success small" disabled={busy===`verify-${r._id}`} onClick={()=>verify(r,'verified')}><Check size={15}/> Verify documents</button></div></>}
    </div>
    {r.verification?.status==='verified'&&<div id={`approval-${r._id}`} className="review-box verified-review">
      <div className="verified-next-step"><Check size={17}/><div><strong>Documents verified — request decision is next</strong><span>Approving opens the dedicated recommendation workspace. The request then leaves this inbox.</span></div></div>
      <label>Professor response<Help>Optional. Add a short note to the student about your decision or next steps.</Help><textarea rows="3" placeholder="e.g. I can prepare the letter. Please ensure the destination instructions are correct." value={response[r._id]||''} onChange={e=>setResponse({...response,[r._id]:e.target.value})}/></label>
      <div className="form-actions"><button className="btn danger" disabled={busy===r._id} onClick={()=>review(r,'rejected')}><X size={16}/> Reject request</button><button className="btn success" disabled={busy===r._id} onClick={()=>review(r,'approved')}><Check size={16}/> Approve & open PDF workspace</button><button className="btn danger small" disabled={busy===`delete-${r._id}`} onClick={()=>remove(r)}><Trash2 size={15}/> Delete pending</button></div>
    </div>}
    {r.verification?.status==='rejected'&&<div className="blocked-note"><AlertTriangle size={16}/><span>Document verification needs correction. The student can review the note and submit a new request if needed.</span></div>}
  </article>;

  return <><PageHeading eyebrow="FACULTY REQUEST INBOX" title="Verify, review, recommend." text="Only actionable pending requests appear here. Approved work moves to a dedicated recommendation workspace so this inbox stays clean."/>
    <div className="workflow-banner compact"><div><Sparkles size={18}/><div><strong>Recommendation integrity</strong><span>Write the assessment in your own words and use specific examples you personally observed. The student should provide context, not author the recommendation.</span></div></div><span className="secure-chip"><ShieldCheck size={14}/> Verified faculty</span></div>
    <div className="toolbar filter-toolbar"><div className="search-box wide"><Search size={17}/><input placeholder="Search student, college, university or purpose" value={search} onChange={e=>setSearch(e.target.value)}/></div><select className="toolbar-select" value={college} onChange={e=>setCollege(e.target.value)}><option value="">All colleges</option>{colleges.map(v=><option key={v}>{v}</option>)}</select><select className="toolbar-select" value={university} onChange={e=>setUniversity(e.target.value)}><option value="">All universities</option>{universities.map(v=><option key={v}>{v}</option>)}</select></div>
    {error&&<div className="alert error">{error}</div>}
    {loading?<Loading/>:filtered.length?<div className="request-list">{filtered.map(renderRequest)}</div>:<EmptyState title="No pending requests" text="New LOR requests will appear here after students submit their required supporting documents."/>}
  </>;
}
