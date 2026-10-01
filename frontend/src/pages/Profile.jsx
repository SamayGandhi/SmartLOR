import { useMemo, useState } from 'react';
import { Save, ShieldCheck, AlertTriangle, X, ArrowRight } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ToastHost';
import { useNavigate } from 'react-router-dom';

export default function Profile(){
  const {user,updateUser}=useAuth();
  const navigate=useNavigate();
  const [form,setForm]=useState({name:user.name,department:user.department||'',designation:user.designation||'',college:user.college||'',university:user.university||'',studentId:user.studentId||'',course:user.course||'',semester:user.semester||'',graduationYear:user.graduationYear||'',phone:user.phone||'',bio:user.bio||''});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);

  const institutionChanged=useMemo(()=>{
    if(user.role!=='professor' || user.professorVerification?.status!=='verified') return false;
    return ['college','university','department','designation'].some(k=>String(form[k]??'').trim()!==String(user[k]??'').trim());
  },[form,user]);

  const studentWorkflowChanged=useMemo(()=>{
    if(user.role!=='student') return false;
    return ['name','department','college','university','studentId','course','semester','graduationYear']
      .some(k=>String(form[k]??'').trim()!==String(user[k]??'').trim());
  },[form,user]);

  const confirmationNeeded=institutionChanged||studentWorkflowChanged;

  const saveProfile=async()=>{
    setBusy(true);setMessage('');
    try{
      const {data}=await api.patch('/auth/me',form);
      updateUser(data);
      setConfirmOpen(false);
      if(data.reverificationRequired){
        showToast('Profile saved. Fresh faculty documents are required for admin re-verification.');
        window.dispatchEvent(new Event('smartlor:notifications-refresh'));
        navigate('/professor-verification',{replace:true});
      }else if(data.studentDocumentsRequired){
        showToast('Profile saved. Upload fresh supporting documents before your professor is notified.');
        window.dispatchEvent(new Event('smartlor:notifications-refresh'));
        navigate('/request-documents',{replace:true});
      }else{
        setMessage('Profile updated successfully.');
        showToast(data.pendingRequestUpdates
          ? `Profile updated. ${data.pendingRequestUpdates} pending request${data.pendingRequestUpdates===1?'':'s'} will require fresh documents before the professor is notified.`
          : 'Profile updated successfully.');
        window.dispatchEvent(new Event('smartlor:notifications-refresh'));
      }
    }catch(err){
      const m=err.response?.data?.message||'Unable to update profile';
      setMessage(m);showToast(m,'error');
    }finally{setBusy(false);}
  };

  const save=async e=>{
    e.preventDefault();
    if(confirmationNeeded){setConfirmOpen(true);return;}
    await saveProfile();
  };

  return <><div className="page-heading"><div><span className="eyebrow">PROFILE & SETTINGS</span><h1>Your verified identity context.</h1><p>These details appear in recommendation workflows and help professors/admins distinguish students from similarly named applicants.</p></div></div>
    <div className="two-col">
      <section className="section-card form-card profile-wide">
        <div className="profile-header"><div className="avatar xl">{user.name?.charAt(0)}</div><div><h3>{user.name}</h3><p>{user.email}</p><span className="role-tag">{user.role}</span></div></div>
        {message&&<div className={`alert ${message.includes('success')?'success':'error'}`}>{message}</div>}
        {user.role==='professor'&&user.professorVerification?.status==='verified'&&<div className="reverification-notice"><ShieldCheck size={18}/><div><strong>Verified faculty account</strong><span>Changing college, university, department or designation will require fresh documents and administrator approval.</span></div></div>}
        <form className="form" onSubmit={save}>
          <div className="form-grid"><label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div>
          <div className="form-grid"><label>College / Institute<input value={form.college} onChange={e=>setForm({...form,college:e.target.value})} required/></label><label>University<input value={form.university} onChange={e=>setForm({...form,university:e.target.value})} required/></label></div>
          <div className="form-grid"><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})} required/></label><label>Designation<input value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}/></label></div>
          {user.role==='student'&&<><div className="form-grid"><label>Student / Enrollment ID<input value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}/></label><label>Course<input value={form.course} onChange={e=>setForm({...form,course:e.target.value})}/></label></div><div className="form-grid"><label>Semester<input value={form.semester} onChange={e=>setForm({...form,semester:e.target.value})}/></label><label>Graduation year<input type="number" value={form.graduationYear||''} onChange={e=>setForm({...form,graduationYear:e.target.value})}/></label></div></>}
          <label>Bio<textarea rows="5" maxLength="700" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
          <button className="btn primary" disabled={busy}><Save size={17}/>{busy?'Saving…':'Save changes'}</button>
        </form>
      </section>
      <section className="section-card info-card"><div className="security-card"><div className="security-icon"><ShieldCheck size={20}/></div><div><strong>Privacy-aware workflow</strong><p>Only information needed for this recommendation workflow should be submitted. Review the destination and purpose before sharing documents.</p></div></div><div className="info-list"><div><span>Email</span><strong>{user.email}</strong></div><div><span>Role</span><strong>{user.role}</strong></div><div><span>Authentication</span><strong>Password + JWT session</strong></div></div></section>
    </div>
    {confirmOpen&&<div className="modal-backdrop" onClick={()=>!busy&&setConfirmOpen(false)}><div className="confirm-modal" onClick={e=>e.stopPropagation()}>
      <div className="confirm-icon"><AlertTriangle size={22}/></div>
      <span className="eyebrow">{institutionChanged?'RE-VERIFICATION REQUIRED':'CONFIRM PROFILE CHANGE'}</span>
      <h2>{institutionChanged?'Confirm affiliation change':'Confirm profile changes'}</h2>
      <p>{institutionChanged
        ? 'You are changing verified faculty details. Saving will temporarily lock faculty access, remove the old verification evidence, notify administrators and require you to upload fresh documents for approval.'
        : 'You are changing information used in an active LOR workflow. Confirm that these changes are intentional. If you have a pending request, the existing supporting documents will be removed and you must upload a fresh four-document package before your professor is notified.'}</p>
      <div className="confirm-detail"><ShieldCheck size={17}/><span>{institutionChanged?'Admin approval is required before you can use the faculty dashboard again.':'Your professor will only be notified after you complete the required document upload.'}</span></div>
      <div className="form-actions"><button className="btn secondary" type="button" disabled={busy} onClick={()=>setConfirmOpen(false)}><X size={16}/> Cancel</button><button className="btn primary" type="button" disabled={busy} onClick={saveProfile}>{busy?'Saving…':<>{institutionChanged?'Save & re-verify':'Save & update request'} <ArrowRight size={16}/></>}</button></div>
    </div></div>}
  </>;
}
