import React, { useState, useRef, useEffect } from "react";
import { useTheme }  from "../../ThemeContext.jsx";
import { mkInp }     from "../../utils/styles.js";
import { supabase }  from "../../supabase.js";
import { todayStr }  from "../../utils/dates.js";
import { MT }        from "../../constants/status.js";
import Modal         from "../ui/Modal.jsx";
import MHead         from "../ui/MHead.jsx";
import Btn           from "../ui/Btn.jsx";
import Field         from "../ui/Field.jsx";

export default function RevisionModal({ inst, eq, cliente, tipo, user, onSave, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const mt=MT[tipo]||{label:tipo,color:T.teal,freq:30}; const items=((eq||inst)?.["items_"+tipo])||[];
  const [checks,setChecks]=useState(()=>{ const c={}; items.forEach((_,i)=>{c[i]=false;}); return c; }); const [obs,setObs]=useState(""); const [firma,setFirma]=useState(null); const [saving,setSaving]=useState(false);
  const cRef=useRef(); const dr=useRef(false); const [hasFirma,setHasFirma]=useState(false);
  useEffect(()=>{ const c=cRef.current; if(!c)return; const ctx=c.getContext("2d"); ctx.fillStyle=T.card; ctx.fillRect(0,0,c.width,c.height); },[]);
  function pos(e,c){ const r=c.getBoundingClientRect(),s=e.touches?e.touches[0]:e; return{x:(s.clientX-r.left)*(c.width/r.width),y:(s.clientY-r.top)*(c.height/r.height)}; }
  function start(e){ e.preventDefault(); dr.current=true; const c=cRef.current,ctx=c.getContext("2d"),p=pos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(e){ e.preventDefault(); if(!dr.current)return; const c=cRef.current,ctx=c.getContext("2d"),p=pos(e,c); ctx.strokeStyle=T.accent; ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x,p.y); setHasFirma(true); }
  function end(e){ e.preventDefault(); dr.current=false; setFirma(cRef.current.toDataURL()); }
  function clearFirma(){ const c=cRef.current,ctx=c.getContext("2d"); ctx.fillStyle=T.card; ctx.fillRect(0,0,c.width,c.height); setHasFirma(false); setFirma(null); }
  const done=Object.values(checks).filter(Boolean).length; const pct=items.length?Math.round(done/items.length*100):0; const allOn=done===items.length&&items.length>0;
  function checkAll(){ const v=!allOn; const c={}; items.forEach((_,i)=>{c[i]=v;}); setChecks(c); }
  async function save(){
    setSaving(true);
    const { data:cnt }=await supabase.rpc("siguiente_parte");
    const rev={ instalacion_id:inst.id, instalacion_nombre:inst.nombre, equipo_id:eq?.id||null, equipo_nombre:eq?.nombre||inst.nombre, cliente_id:cliente.id, cliente_nombre:cliente.nombre, tecnico_id:user.id, tecnico_nombre:user.nombre, tipo, fecha:todayStr(), checks, observaciones:obs, firma_url:firma, num_parte:cnt||"00001" };
    await onSave(rev);
    setSaving(false);
  }
  return (<Modal onClose={onClose} w={620} zIndex={300}><MHead title={`Revisión ${mt.label}`} sub={`${inst.nombre} · ${cliente.nombre}`} onClose={onClose}/>
    <div style={{ padding:"18px 22px",display:"flex",flexDirection:"column",gap:14 }}>
      <div style={{ background:T.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}><span style={{ fontSize:12,fontWeight:600,color:T.text }}>{done} / {items.length} verificados</span><div style={{ display:"flex",alignItems:"center",gap:8 }}><span style={{ fontSize:13,fontWeight:700,color:mt.color }}>{pct}%</span><button onClick={checkAll} style={{ padding:"3px 10px",borderRadius:6,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer" }}>{allOn?"Desmarcar todo":"Marcar todo"}</button></div></div>
        <div style={{ height:6,background:T.border,borderRadius:4 }}><div style={{ height:"100%",width:`${pct}%`,background:mt.color,borderRadius:4,transition:"width 0.3s" }}/></div>
      </div>
      <div style={{ maxHeight:"40vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:4 }}>
        {items.map((item,i)=><div key={i} onClick={()=>setChecks(p=>({...p,[i]:!p[i]}))} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,cursor:"pointer",background:checks[i]?mt.color+"08":T.surface,border:`1px solid ${checks[i]?mt.color+"40":T.border}`,transition:"all 0.15s" }}><div style={{ width:20,height:20,borderRadius:5,flexShrink:0,border:`2px solid ${checks[i]?mt.color:T.border}`,background:checks[i]?mt.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>{checks[i]&&<svg width="11" height="11" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</div><span style={{ fontSize:13,color:checks[i]?T.text:T.sub,flex:1,lineHeight:1.4 }}>{item}</span></div>)}
      </div>
      <Field label="Observaciones"><textarea value={obs} onChange={e=>setObs(e.target.value)} style={{...inp(),minHeight:65,resize:"vertical"}} placeholder="Anomalías detectadas, recomendaciones..."/></Field>
      <div><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}><span style={{ fontSize:11,fontWeight:600,color:T.sub }}>Firma del cliente</span>{hasFirma&&<Btn ch="Borrar" onClick={clearFirma} v="d" sm/>}</div><canvas ref={cRef} width={560} height={120} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width:"100%",height:120,borderRadius:8,border:`1.5px solid ${hasFirma?mt.color:T.border}`,cursor:"crosshair",display:"block",touchAction:"none",background:T.card }}/>{!hasFirma&&<p style={{ fontSize:11,color:T.muted,margin:"4px 0 0",textAlign:"center" }}>Firma aquí</p>}</div>
      <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}><Btn ch="Cancelar" onClick={onClose} v="g"/><Btn ch={saving?"Guardando...":"Completar y guardar"} onClick={save} disabled={saving}/></div>
    </div>
  </Modal>);
}
