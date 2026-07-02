import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp }    from "../../utils/styles.js";
import { supabase } from "../../supabase.js";
import Field        from "../ui/Field.jsx";
import Btn          from "../ui/Btn.jsx";

export default function ClienteBuscadorField({ clientes, clienteId, onSelect, onDeselect, onCreated, refresh }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const [cliQuery, setCliQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [showNuevoCli, setShowNuevoCli] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre:"", telefono:"", email:"", direccion:"", dni:"", notas:"" });
  const [savingCli, setSavingCli] = useState(false);
  const cliRef = useRef();
  const voiceActiveRef = useRef(false);
  const [voiceActive, setVoiceActive] = useState(false);

  const clienteSeleccionado = clientes.find(c=>c.id===clienteId) || null;
  const cliResultados = cliQuery.trim().length > 0
    ? clientes.filter(c=>{ const q=cliQuery.toLowerCase(); return (c.nombre||"").toLowerCase().includes(q)||(c.telefono||"").toLowerCase().includes(q); }).slice(0,8)
    : [];

  useEffect(()=>{
    function onClickOut(e){ if(cliRef.current&&!cliRef.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener("mousedown",onClickOut);
    return ()=>document.removeEventListener("mousedown",onClickOut);
  },[]);

  function handleSelect(id) {
    const c=clientes.find(x=>x.id===id);
    onSelect(id,c);
    setCliQuery(""); setShowDrop(false);
  }
  function handleDeselect() { onDeselect(); setCliQuery(""); }

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

  async function crearCliente() {
    if(!cliForm.nombre.trim()||!cliForm.telefono.trim()){ alert("Nombre y teléfono son obligatorios."); return; }
    setSavingCli(true);
    const { data:nc, error }=await supabase.from("clientes").insert([{
      nombre:cliForm.nombre.trim(), telefono:cliForm.telefono.trim()||null, email:cliForm.email.trim()||null,
      direccion:cliForm.direccion.trim()||null, dni:cliForm.dni.trim()||null, notas:cliForm.notas.trim()||null,
    }]).select().single();
    if(!error&&nc){ await refresh?.(); onCreated(nc); setShowNuevoCli(false); setCliForm({nombre:"",telefono:"",email:"",direccion:"",dni:"",notas:""}); }
    else alert("Error: "+(error?.message||""));
    setSavingCli(false);
  }

  return (
    <>
      <Field label="Cliente *">
        <div style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
          <div ref={cliRef} style={{ position:"relative",flex:1 }}>
            {clienteSeleccionado ? (
              <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1.5px solid ${T.accent}`,borderRadius:8,background:T.accentLight }}>
                <span style={{ flex:1,fontSize:13,fontWeight:600,color:T.accent }}>{clienteSeleccionado.nombre}</span>
                {clienteSeleccionado.telefono&&<span style={{ fontSize:12,color:T.sub }}>{clienteSeleccionado.telefono}</span>}
                <button onClick={handleDeselect} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:16,lineHeight:1,padding:"0 2px" }}>×</button>
              </div>
            ) : (
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <input value={cliQuery} onChange={e=>{ setCliQuery(e.target.value); setShowDrop(true); }} onFocus={()=>setShowDrop(true)}
                  placeholder="Buscar por nombre o teléfono..." style={{...inp({fontSize:13}),flex:1}} autoComplete="off"/>
                <MicBtn onResult={t=>{ setCliQuery(t); setShowDrop(true); }}/>
              </div>
            )}
            {showDrop&&!clienteSeleccionado&&(
              <div style={{ position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:100,marginTop:4,maxHeight:240,overflowY:"auto" }}>
                {cliResultados.length>0 ? cliResultados.map(c=>(
                  <div key={c.id} onClick={()=>handleSelect(c.id)} style={{ padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${T.border}` }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.accentLight} onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                    <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{c.nombre}</div>
                    {c.telefono&&<div style={{ fontSize:11,color:T.muted }}>{c.telefono}</div>}
                  </div>
                )) : cliQuery.trim().length>0 ? (
                  <div style={{ padding:"12px 14px" }}>
                    <div style={{ fontSize:13,color:T.muted,marginBottom:8 }}>No se encontraron clientes</div>
                    <button onClick={()=>{ setShowDrop(false); setShowNuevoCli(true); }}
                      style={{ padding:"7px 14px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                      + Nuevo cliente
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <button onClick={()=>setShowNuevoCli(v=>!v)}
            style={{ padding:"8px 16px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>
            + Nuevo cliente
          </button>
        </div>
      </Field>
      {showNuevoCli&&(
        <div style={{ background:T.surface,border:`1.5px solid ${T.accent}`,borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10 }}>
          <div style={{ fontSize:12,fontWeight:700,color:T.accent,marginBottom:2 }}>Nuevo cliente</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <Field label="Nombre *"><input value={cliForm.nombre} onChange={e=>setCliForm(p=>({...p,nombre:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Nombre completo"/></Field>
            <Field label="Teléfono *"><input value={cliForm.telefono} onChange={e=>setCliForm(p=>({...p,telefono:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="600 000 000"/></Field>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <Field label="Email"><input value={cliForm.email} onChange={e=>setCliForm(p=>({...p,email:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="email@ejemplo.com"/></Field>
            <Field label="DNI / CIF"><input value={cliForm.dni} onChange={e=>setCliForm(p=>({...p,dni:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="12345678A"/></Field>
          </div>
          <Field label="Dirección"><input value={cliForm.direccion} onChange={e=>setCliForm(p=>({...p,direccion:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Calle, número, ciudad..."/></Field>
          <Field label="Notas"><input value={cliForm.notas} onChange={e=>setCliForm(p=>({...p,notas:e.target.value}))} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Observaciones del cliente..."/></Field>
          <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginTop:2 }}>
            <Btn ch="Cancelar" onClick={()=>setShowNuevoCli(false)} v="g" sm/>
            <Btn ch={savingCli?"Creando...":"Crear cliente"} onClick={crearCliente} disabled={savingCli||!cliForm.nombre.trim()||!cliForm.telefono.trim()} sm/>
          </div>
        </div>
      )}
    </>
  );
}
