import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileUp, ShieldCheck, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading';
import { PageHeading } from './Dashboard';
import { showToast } from '../components/ToastHost';

const docs = [
  ['identityProof','Identity proof','Government/official identity document.'],
  ['enrollmentProof','Enrollment proof','Current enrollment/admission proof.'],
  ['academicProof','Academic record','Transcript, marksheet or official academic record.'],
  ['purposeProof','Application/purpose evidence','Offer, application, scholarship, internship or other relevant evidence.'],
];

export default function RequestDocuments(){
  const [requests,setRequests]=useState([]);
  const [files,setFiles]=useState({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const navigate=useNavigate();

  const load=async()=>{
    setLoading(true);
    try{
      const {data}=await api.get('/requests/mine');
      setRequests((data||[]).filter(r=>r.status==='pending' && (r.studentChangePending || (r.documents||[]).length<4)));
    }catch(e){
      showToast(e.response?.data?.message||'Unable to load requests','error');
    }finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);

  const upload=async r=>{
    const selected=files[r._id]||{};
    if(docs.some(([key])=>!selected[key])){
      showToast('Please choose all four required documents before submitting.','error');
      return;
    }
    const fd=new FormData();
    docs.forEach(([key])=>fd.append(key,selected[key]));
    setBusy(r._id);
    try{
      const {data}=await api.patch(`/requests/${r._id}/documents`,fd);
      showToast(data.message||'Supporting documents updated.');
      window.dispatchEvent(new Event('smartlor:notifications-refresh'));
      setRequests(prev=>prev.filter(x=>x._id!==r._id));
      setFiles(prev=>({...prev,[r._id]:{}}));
      navigate('/my-requests',{replace:true});
    }catch(e){
      showToast(e.response?.data?.message||'Unable to update documents','error');
    }finally{setBusy('');}
  };

  return <><PageHeading eyebrow="REQUEST / SUPPORTING DOCUMENTS" title="Update the evidence before your professor is notified." text="A profile change affecting a pending LOR request requires a fresh four-document package. Your professor will be notified only after the new documents are submitted." action={<button className="btn secondary" onClick={()=>navigate('/profile')}><ArrowLeft size={16}/> Back to profile</button>}/>
    <div className="workflow-banner"><div><ShieldCheck size={19}/><div><strong>Privacy-aware re-submission</strong><span>Upload only documents relevant to this recommendation. Each file is stored temporarily and automatically removed within 7 days.</span></div></div></div>
    {loading?<Loading/>:requests.length?<div className="request-doc-refresh-list">{requests.map(r=><section className="section-card request-doc-refresh-card" key={r._id}>
      <div className="request-doc-refresh-head"><div><span className="eyebrow">PENDING LOR REQUEST</span><h3>{r.professor?.name||'Professor'}</h3><p>{r.targetInstitution} · {r.targetProgram}</p></div><span className="field-required">4 required</span></div>
      {r.studentChangePending&&<div className="alert warning">Your profile changed. Fresh documents are required before this request returns to the professor.</div>}
      <div className="document-grid">{docs.map(([key,title,help])=><label className={`document-upload required-doc ${files[r._id]?.[key]?'selected':''}`} key={key}><div className="document-icon"><FileUp size={18}/></div><div><strong>{title} *</strong><span>{files[r._id]?.[key]?.name||help}</span><small>PDF, JPG or PNG · max 5 MB</small></div><input type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={e=>setFiles(prev=>({...prev,[r._id]:{...(prev[r._id]||{}),[key]:e.target.files?.[0]||null}}))} /></label>)}</div>
      <div className="form-actions"><button className="btn primary" disabled={busy===r._id} onClick={()=>upload(r)}><UploadCloud size={16}/>{busy===r._id?'Uploading…':'Upload documents & notify professor'}</button></div>
    </section>)}</div>:<div className="empty-state"><CheckCircle2 size={28}/><h3>No document refresh is waiting</h3><p>Your pending requests are ready for professor review, or you do not have a pending request.</p><button className="btn secondary" onClick={()=>navigate('/my-requests')}>Open My Requests</button></div>}
  </>;
}
