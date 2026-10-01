import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, ClipboardCheck, Download, FileCheck2, FileText, FileUp, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import Loading from '../components/Loading';
import { PageHeading } from './Dashboard';
import { showToast } from '../components/ToastHost';

const emptyEditor={relationship:'',duration:'',comparisonGroup:'',comparisonCount:'',assessmentLevel:'',recommendationStrength:'',strengths:'',evidence:'',recommendationText:'',constructiveFeedback:'',additionalRemarks:'',letterLanguage:'English'};
const Help=({children})=><small className="field-hint">{children}</small>;
const countWords=(text='')=>text.trim()?text.trim().split(/\s+/).filter(Boolean).length:0;
const RequiredMark=({complete})=><span className={complete?'field-complete':'field-required'}>{complete?'Complete':'Required'}</span>;

export default function RecommendationWorkspace(){
  const {id}=useParams();
  const navigate=useNavigate();
  const [request,setRequest]=useState(null);
  const [editor,setEditor]=useState(emptyEditor);
  const [file,setFile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const {data}=await api.get(`/requests/${id}`);
      if(data.status!=='approved' || data.completedAt) throw new Error('This recommendation workspace is no longer active.');
      setRequest(data);
      setEditor({
        ...emptyEditor,
        relationship:data.relationship||'',duration:data.relationshipDuration||'',comparisonGroup:data.comparisonGroup||'',comparisonCount:data.comparisonCount??'',assessmentLevel:data.assessmentLevel||'',recommendationStrength:data.recommendationStrength||'',strengths:data.strengths||'',evidence:data.evidence||'',recommendationText:data.recommendationText||'',constructiveFeedback:data.constructiveFeedback||'',additionalRemarks:data.additionalRemarks||'',letterLanguage:data.letterLanguage||'English'
      });
    }catch(e){const m=e.response?.data?.message||e.message||'Unable to open recommendation workspace';setError(m);showToast(m,'error');}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[id]);

  const update=(key,value)=>setEditor(prev=>({...prev,[key]:value}));
  const words=useMemo(()=>countWords(editor.recommendationText),[editor.recommendationText]);
  const totalWords=useMemo(()=>countWords([editor.recommendationText,editor.strengths,editor.evidence,editor.constructiveFeedback,editor.additionalRemarks].filter(Boolean).join(' ')),[editor]);
  const complete={relationship:!!editor.relationship.trim(),strength:!!editor.recommendationStrength,strengths:!!editor.strengths.trim(),evidence:!!editor.evidence.trim(),narrative:!!editor.recommendationText.trim()};

  const generate=async()=>{
    if(!complete.relationship||!complete.strength||!complete.strengths||!complete.evidence||!complete.narrative){const m='Complete all 5 required recommendation fields before generating the PDF.';setError(m);showToast(m,'error');return;}
    if(words>750){const m=`Recommendation narrative is ${words} words. Please keep it to 750 words or fewer.`;setError(m);showToast(m,'error');return;}
    if(totalWords>1500){const m=`Total recommendation content is ${totalWords} words. Please keep the combined content to 1,500 words or fewer.`;setError(m);showToast(m,'error');return;}
    setBusy('generate');setError('');
    try{
      const {data}=await api.patch(`/requests/${id}/draft`,{recommendationText:editor.recommendationText,relationship:editor.relationship,relationshipDuration:editor.duration,comparisonGroup:editor.comparisonGroup,comparisonCount:editor.comparisonCount,assessmentLevel:editor.assessmentLevel,recommendationStrength:editor.recommendationStrength,strengths:editor.strengths,evidence:editor.evidence,constructiveFeedback:editor.constructiveFeedback,additionalRemarks:editor.additionalRemarks,letterLanguage:editor.letterLanguage});
      setRequest(data);showToast('PDF generated successfully. This request is no longer shown in the Request Inbox.');
    }catch(e){const m=e.response?.data?.message||'Unable to generate LOR PDF';setError(m);showToast(m,'error');}
    finally{setBusy('');}
  };

  const downloadDraft=async()=>{
    try{const res=await api.get(`/requests/${id}/draft`,{responseType:'blob'});const url=URL.createObjectURL(res.data);const a=document.createElement('a');a.href=url;a.download=request?.draftFileName||'SmartLOR-Recommendation.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);showToast('PDF downloaded.');}
    catch(e){showToast(e.response?.data?.message||'Unable to download PDF','error');}
  };

  const upload=async()=>{
    if(!file)return;
    setBusy('upload');setError('');
    try{
      const fd=new FormData();fd.append('lorFile',file);
      const {data}=await api.post(`/requests/${id}/file`,fd);
      showToast(data.message||'Final signed PDF uploaded.');
      window.dispatchEvent(new Event('smartlor:notifications-refresh'));
      navigate('/requests',{replace:true});
    }catch(e){const m=e.response?.data?.message||'Unable to upload final PDF';setError(m);showToast(m,'error');}
    finally{setBusy('');}
  };

  if(loading)return <Loading/>;
  if(!request)return <><PageHeading eyebrow="RECOMMENDATION WORKSPACE" title="Workspace unavailable" text={error||'This recommendation workspace is no longer active.'} action={<button className="btn secondary" onClick={()=>navigate('/requests')}><ArrowLeft size={16}/> Back to inbox</button>}/>{error&&<div className="alert error">{error}</div>}</>;

  return <>
    <PageHeading eyebrow="FACULTY / RECOMMENDATION WORKSPACE" title="Author the final LOR professionally" text="This approved request has left the pending Request Inbox. Complete the recommendation here, generate the PDF, then upload the signed final copy." action={<button className="btn secondary" onClick={()=>navigate('/requests')}><ArrowLeft size={16}/> Back to inbox</button>}/>
    <div className="workflow-banner compact"><div><Check size={18}/><div><strong>Approved recommendation workspace</strong><span>The request is intentionally not listed in the pending inbox. Your generated draft and signed final PDF remain available only for the short retention period.</span></div></div><span className="secure-chip"><ShieldCheck size={14}/> Verified faculty</span></div>
    <section className="active-recommendation-card">
      <div className="active-request-summary"><strong>{request.student?.name}</strong><span>{request.targetInstitution} · {request.targetProgram}</span><span>Needed by {new Date(request.deadline).toLocaleDateString()}</span><StatusBadge status={request.status}/></div>
      <div className="required-legend"><span><b>*</b> 5 fields are required to generate the PDF.</span><span>Recommendation narrative: <b>{words}/750</b> · Total recommendation content: <b>{totalWords}/1500</b></span></div>
      <div className="form-grid">
        <label className={`required-field ${complete.relationship?'is-complete':''}`}><span className="field-label-row">Relationship to student * <RequiredMark complete={complete.relationship}/></span><Help>How do you know the student?</Help><input aria-required="true" required placeholder="e.g. Course instructor and project guide" value={editor.relationship} onChange={e=>update('relationship',e.target.value)}/></label>
        <label>Known for<Help>Optional — approximate period of teaching/mentoring.</Help><input placeholder="e.g. 2 academic years" value={editor.duration} onChange={e=>update('duration',e.target.value)}/></label>
      </div>
      <div className="form-grid">
        <label>Comparison group<Help>Optional. Use only if you genuinely have a comparison basis.</Help><input placeholder="e.g. Computer Engineering students" value={editor.comparisonGroup} onChange={e=>update('comparisonGroup',e.target.value)}/></label>
        <label>Approx. group size<Help>Optional number used for comparison.</Help><input type="number" min="0" max="100000" placeholder="e.g. 80" value={editor.comparisonCount} onChange={e=>update('comparisonCount',e.target.value)}/></label>
      </div>
      <div className="form-grid">
        <label>Relative assessment<Help>Optional. Choose only if you can support it with genuine experience.</Help><select value={editor.assessmentLevel} onChange={e=>update('assessmentLevel',e.target.value)}><option value="">No comparative assessment</option><option value="top-1">Top 1%</option><option value="top-5">Top 5%</option><option value="top-10">Top 10%</option><option value="top-25">Top 25%</option><option value="above-average">Above average</option><option value="no-basis">No basis for judgment</option></select></label>
        <label className={`required-field ${complete.strength?'is-complete':''}`}><span className="field-label-row">Recommendation strength * <RequiredMark complete={complete.strength}/></span><Help>Select the strength you can honestly support.</Help><select aria-required="true" required value={editor.recommendationStrength} onChange={e=>update('recommendationStrength',e.target.value)}><option value="">Select recommendation strength</option><option value="strongly-recommend">Strongly recommend</option><option value="recommend">Recommend</option><option value="recommend-with-reservations">Recommend with reservations</option></select></label>
      </div>
      <label className={`required-field ${complete.strengths?'is-complete':''}`}><span className="field-label-row">Observed strengths * <RequiredMark complete={complete.strengths}/></span><Help>Required. Describe specific abilities you personally observed.</Help><textarea aria-required="true" required rows="4" maxLength="1800" placeholder="Describe 2–4 strengths with context." value={editor.strengths} onChange={e=>update('strengths',e.target.value)}/></label>
      <label className={`required-field ${complete.evidence?'is-complete':''}`}><span className="field-label-row">Specific evidence & examples * <RequiredMark complete={complete.evidence}/></span><Help>Required. Give concrete projects, research, coursework, leadership or other observed examples.</Help><textarea aria-required="true" required rows="5" maxLength="1800" placeholder="Example: During the Database Systems project, the student…" value={editor.evidence} onChange={e=>update('evidence',e.target.value)}/></label>
      <label className={`required-field ${complete.narrative?'is-complete':''}`}><span className="field-label-row">Recommendation narrative * <RequiredMark complete={complete.narrative}/></span><Help>Write the recommendation yourself. Keep this field at 750 words or fewer; 250–750 words is a practical target, but follow the destination’s rules.</Help><textarea aria-required="true" required rows="11" maxLength="6000" placeholder="Explain why you recommend the student, using specific observations and evidence. Tailor it to the stated program or opportunity." value={editor.recommendationText} onChange={e=>update('recommendationText',e.target.value)}/><div className={`word-counter ${words>750?'over':''}`}>{words}/750 words</div></label>
      <div className="form-grid"><label>Constructive perspective<Help>Optional. Mention a meaningful growth area only if relevant and appropriate.</Help><textarea rows="4" maxLength="1400" placeholder="Optional developmental observation." value={editor.constructiveFeedback} onChange={e=>update('constructiveFeedback',e.target.value)}/></label><label>Additional remarks<Help>Optional closing context or relevant note.</Help><textarea rows="4" maxLength="1400" placeholder="Optional final note." value={editor.additionalRemarks} onChange={e=>update('additionalRemarks',e.target.value)}/></label></div>
      <div className="form-grid"><label>Letter language<Help>The built-in PDF template is optimized for English.</Help><select value={editor.letterLanguage} onChange={e=>update('letterLanguage',e.target.value)}><option>English</option></select></label><div className="integrity-note"><ClipboardCheck size={16}/><span>The student provides context; the recommender remains the author of the recommendation.</span></div></div>
      {error&&<div className="alert error">{error}</div>}
      <div className="form-actions"><button className="btn primary" disabled={busy==='generate'} onClick={generate}>{busy==='generate'?'Generating…':<><FileText size={16}/> Generate PDF</>}</button>{request.draftFileUrl&&<button className="btn secondary" onClick={downloadDraft}><Download size={16}/> Download PDF</button>}</div>
      <div className="upload-box"><div><strong>{request.lorFileUrl?'Final signed PDF uploaded':'Final signed PDF required'}</strong><span>{request.lorFileName||'Review the generated PDF, sign it through the approved institutional process, then upload the final PDF.'}</span></div><input id="final-lor-file" type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/><label className="btn secondary small" htmlFor="final-lor-file"><FileUp size={16}/> Choose signed PDF</label>{file&&<button className="btn primary small" disabled={busy==='upload'} onClick={upload}>{busy==='upload'?'Uploading…':'Upload final'}</button>}</div>
      <div className="storage-note"><Clock3 size={15}/><span>Generated drafts and final signed PDFs are automatically removed from SmartLOR storage within 7 days. Save the final copy securely.</span></div>
    </section>
  </>;
}
