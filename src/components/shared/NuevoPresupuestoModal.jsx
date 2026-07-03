import React, { useState, useRef, useEffect } from "react";
import { useTheme }                              from "../../ThemeContext.jsx";
import { mkInp }                                 from "../../utils/styles.js";
import { useIsMobile }                           from "../../hooks/useIsMobile.js";
import { supabase }                              from "../../supabase.js";
import { generarPresupuestoCompleto, asistirPresupuesto } from "../../ai.js";
import { sendPushNotification }                  from "../../push.js";
import Modal                                     from "../ui/Modal.jsx";
import MHead                                     from "../ui/MHead.jsx";
import Field                                     from "../ui/Field.jsx";
import Btn                                       from "../ui/Btn.jsx";
import ClienteBuscadorField                      from "./ClienteBuscadorField.jsx";

export default function NuevoPresupuestoModal({ data, user, techs, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isAdmin  = user?.role === "admin";
  const cls      = data.clientes || [];

  const [clienteId, setClienteId] = useState("");
  const [form, setForm] = useState({
    descripcion: "", direccion: "", tecnicoId: "", notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLineas, setAiLineas] = useState([]);
  const [crearState, setCrearState] = useState(null);
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const [averiaId, setAveriaId]         = useState(null);
  const [averiaQuery, setAveriaQuery]   = useState("");
  const [showAvDrop, setShowAvDrop]     = useState(false);
  const averiaRef = useRef();

  useEffect(()=>{
    function onOut(e){ if(averiaRef.current&&!averiaRef.current.contains(e.target)) setShowAvDrop(false); }
    document.addEventListener("mousedown",onOut);
    return ()=>document.removeEventListener("mousedown",onOut);
  },[]);

  const averiasSrc = (data.averias||[]).filter(a=>a.status!=="facturado");
  const averiaSelec = averiaId ? (data.averias||[]).find(a=>a.id===averiaId) : null;
  const averiaResults = averiaQuery.trim().length>0
    ? averiasSrc.filter(a=>{
        const q=averiaQuery.toLowerCase();
        const cn=(cls.find(c=>c.id===a.cliente_id)?.nombre||"").toLowerCase();
        return (a.descripcion||"").toLowerCase().includes(q)||cn.includes(q);
      }).slice(0,8)
    : [];

  const voiceActiveRef = useRef(false);
  const [voiceActive, setVoiceActive] = useState(false);
  function startVoice(cb) {
    if(voiceActiveRef.current) return;
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado"); return; }
    voiceActiveRef.current = true;
    setVoiceActive(true);
    let transcript = ""; let active = true; let currentR = null;
    function finish() {
      active = false; voiceActiveRef.current = false; setVoiceActive(false);
      if(currentR) { try { currentR.stop(); } catch(e){} }
      if(transcript) cb(transcript);
    }
    window.__stopVoice = finish;
    function startRecognizer() {
      if(!active) return;
      const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
      const r = new SR(); currentR = r;
      r.lang = "es-ES"; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = e => {
        for(let i = e.resultIndex; i < e.results.length; i++) {
          if(e.results[i].isFinal) transcript += (transcript ? " " : "") + e.results[i][0].transcript;
        }
      };
      r.onend = () => { if(active) setTimeout(() => startRecognizer(), 100); };
      r.onerror = (e) => { if(active && e.error === "no-speech") setTimeout(() => startRecognizer(), 100); };
      r.start();
    }
    startRecognizer();
  }
  const MicBtn = ({onResult}) => voiceActive
    ? <button type="button" onClick={()=>window.__stopVoice&&window.__stopVoice()}
        style={{ padding:"0 10px",height:34,borderRadius:8,border:"none",background:"#dc2626",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap",animation:"pulse-red 1.5s infinite" }}>
        ⏹ Parar IA
      </button>
    : <button type="button" onClick={()=>startVoice(onResult)}
        style={{ width:34,height:34,borderRadius:8,border:"none",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700 }}>
        ✦ IA
      </button>;

  async function crearConIA() {
    if(crearState) return;
    setCrearState("escuchando");
    startVoice(async (transcript) => {
      setCrearState("procesando");
      try {
        const averias = data.averias || [];
        const res = await generarPresupuestoCompleto(transcript, cls, data.profiles||[], averias);
        if(!res){ alert("No se pudo procesar el dictado. Inténtalo de nuevo."); setCrearState(null); return; }
        if(res.clienteNombre) {
          const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
          const match = cls.find(c => norm(c.nombre).includes(norm(res.clienteNombre)) || norm(res.clienteNombre).includes(norm(c.nombre)));
          if(match){ setClienteId(match.id); upd("direccion", match.direccion||""); }
        }
        if(res.descripcion) upd("descripcion", res.descripcion);
        if(res.notas) upd("notas", res.notas);
        if(res.averiaDescripcion) {
          const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
          const q = norm(res.averiaDescripcion);
          const match = averias.find(a => norm(a.descripcion||"").includes(q) || q.includes(norm(a.descripcion||"").slice(0,20)));
          if(match) setAveriaId(match.id);
        }
      } catch(e){ alert("Error en IA: "+e.message); }
      setCrearState(null);
    });
  }

  async function asistirConIA() {
    if(!form.descripcion.trim()){ alert("Escribe primero una descripción del trabajo."); return; }
    setAiLoading(true);
    try {
      const res = await asistirPresupuesto(form.descripcion, data.materiales||[]);
      if(res) {
        if(res.descripcionMejorada) upd("descripcion", res.descripcionMejorada);
        if(res.lineas && res.lineas.length)
          setAiLineas(res.lineas.map(l=>({ concepto:l.concepto, cantidad:l.cantidad||1, precio:l.precioSugerido||0 })));
      }
    } catch(e){ alert("Error en IA: "+e.message); }
    setAiLoading(false);
  }

  async function save() {
    if(!form.descripcion.trim()||!clienteId){ alert("Selecciona un cliente y añade descripción."); return; }
    setSaving(true);
    const payload = {
      cliente_id:  clienteId,
      descripcion: form.descripcion.trim(),
      status:      "nuevo",
      averia_id:   averiaId || null,
    };
    if(aiLineas.length) payload.lineas = aiLineas;
    const { error } = await supabase.from("presupuestos").insert([payload]);
    if(!error){
      if(averiaId) await supabase.from("averias").update({status:"presupuesto_enviado"}).eq("id",averiaId);
      const clNombre = cls.find(c=>c.id===clienteId)?.nombre || "cliente";
      sendPushNotification(data.profiles, "Nuevo presupuesto - " + clNombre, form.descripcion?.slice(0,100) || "Sin descripción", "admin");
      refresh?.(); onClose();
    } else alert("Error: "+error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={580}>
      <MHead title="Nuevo presupuesto" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Botón crear presupuesto con IA */}
        <button type="button" onClick={crearConIA} disabled={!!crearState}
          style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:crearState?T.muted:"linear-gradient(135deg,#3b82f6 0%,#7c3aed 100%)",color:"#fff",fontSize:15,fontWeight:700,cursor:crearState?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity 0.15s",opacity:crearState?0.85:1,letterSpacing:0.2 }}>
          {crearState==="escuchando"
            ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:"aiSpin 1s linear infinite",flexShrink:0}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 🎤 Escuchando... habla ahora</>
            : crearState==="procesando"
            ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:"aiSpin 0.8s linear infinite",flexShrink:0}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Procesando con IA...</>
            : <>✦ Crear presupuesto con IA</>}
        </button>
        {!crearState && <p style={{ textAlign:"center",fontSize:11,color:T.muted,margin:"-10px 0 0" }}>Pulsa y describe cliente, trabajo, condiciones y avería vinculada de una vez</p>}

        <ClienteBuscadorField clientes={cls} clienteId={clienteId}
          onSelect={(id,c)=>{ setClienteId(id); upd("direccion",c?.direccion||""); }}
          onDeselect={()=>{ setClienteId(""); upd("direccion",""); }}
          onCreated={(nc)=>{ setClienteId(nc.id); upd("direccion",nc.direccion||""); }}
          refresh={refresh}/>

        <div>
          <div style={{ marginBottom:4 }}>
            <label style={{ fontSize:11,fontWeight:600,color:T.sub }}>Descripción del trabajo *</label>
          </div>
          <div style={{ display:"flex",gap:6,alignItems:"flex-start" }}>
            <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)} style={{...inp(),minHeight:70,resize:"vertical",flex:1}} placeholder="Describe el trabajo o servicio a presupuestar..."/>
            <MicBtn onResult={t=>setForm(p=>({...p,descripcion:p.descripcion?p.descripcion+" "+t:t}))}/>
          </div>
          {aiLineas.length>0&&<div style={{ marginTop:6,fontSize:11,color:"#7c3aed",fontWeight:500 }}>✦ IA generó {aiLineas.length} línea{aiLineas.length>1?"s":""} — se añadirán al presupuesto al crear</div>}
        </div>

        <Field label="Vincular a avería (opcional)">
          <div ref={averiaRef} style={{ position:"relative" }}>
            {averiaSelec ? (
              <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1.5px solid ${T.border}`,borderRadius:8,background:T.surface }}>
                <span style={{ flex:1,fontSize:13,fontWeight:600,color:T.text }}>#{averiaSelec.id} — {averiaSelec.descripcion?.slice(0,55)}</span>
                <button onClick={()=>{ setAveriaId(null); setAveriaQuery(""); }} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:17,lineHeight:1,padding:"0 2px" }}>×</button>
              </div>
            ) : (
              <input value={averiaQuery} onChange={e=>{ setAveriaQuery(e.target.value); setShowAvDrop(true); }} onFocus={()=>setShowAvDrop(true)}
                placeholder="Buscar por descripción o cliente..."
                style={{...inp({fontSize:13}),width:"100%"}} autoComplete="off"/>
            )}
            {showAvDrop&&!averiaSelec&&(
              <div style={{ position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,marginTop:4,maxHeight:220,overflowY:"auto" }}>
                {averiaResults.length>0 ? averiaResults.map(a=>{
                  const cn=cls.find(c=>c.id===a.cliente_id)?.nombre||"";
                  return (
                    <div key={a.id} onClick={()=>{ setAveriaId(a.id); setAveriaQuery(""); setShowAvDrop(false); }}
                      style={{ padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                      <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{a.descripcion?.slice(0,60)}</div>
                      <div style={{ fontSize:11,color:T.muted }}>{cn}{cn&&" · "}#{a.id}</div>
                    </div>
                  );
                }) : averiaQuery.trim().length>0 ? (
                  <div style={{ padding:"12px 14px",fontSize:13,color:T.muted }}>No se encontraron averías</div>
                ) : null}
              </div>
            )}
          </div>
        </Field>

        <Field label="Dirección">
          <input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Dirección del trabajo"/>
        </Field>

        {isAdmin&&(
          <Field label="Técnico responsable">
            <select value={form.tecnicoId||""} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}

        <Field label="Notas">
          <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Observaciones adicionales..."/>
        </Field>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear presupuesto"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>
    </Modal>
  );
}
