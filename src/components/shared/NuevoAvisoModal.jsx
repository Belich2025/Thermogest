import React, { useState, useRef, useEffect } from "react";
import { useTheme }        from "../../ThemeContext.jsx";
import { mkInp }           from "../../utils/styles.js";
import { useIsMobile }     from "../../hooks/useIsMobile.js";
import { supabase }        from "../../supabase.js";
import { detectarAveria }  from "../../ai.js";
import { startVoiceSimple } from "../../hooks/useVoice.js";
import Modal               from "../ui/Modal.jsx";
import MHead               from "../ui/MHead.jsx";
import Field               from "../ui/Field.jsx";
import Btn                 from "../ui/Btn.jsx";

export default function NuevoAvisoModal({ data, user, techs, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];
  const [form, setForm] = useState({
    tipo: "averia", clienteId: "", equipo: "", descripcion: "",
    direccion: "", tecnicoId: "", fechaVisita: "", notas: "",
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [showNuevoCli, setShowNuevoCli] = useState(false);
  const [cliForm, setCliForm] = useState({ nombre:"", telefono:"", email:"", direccion:"", dni:"", notas:"" });
  const updCli = (k,v) => setCliForm(p=>({...p,[k]:v}));
  const [savingCli, setSavingCli] = useState(false);
  const [cliQuery, setCliQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const cliRef = useRef();
  const recognizerRef = useRef(null);
  const iaTranscriptRef = useRef("");
  const iaActivaRef = useRef(false);
  const [iaActiva, setIaActiva] = useState(false);
  const voiceActiveRef = useRef(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [iaCandidatos, setIaCandidatos] = useState([]);

  const clienteSeleccionado = cls.find(c=>c.id===form.clienteId) || null;

  const cliResultados = cliQuery.trim().length > 0
    ? cls.filter(c=>{
        const q = cliQuery.toLowerCase();
        return (c.nombre||"").toLowerCase().includes(q) || (c.telefono||"").toLowerCase().includes(q);
      }).slice(0,8)
    : [];

  useEffect(()=>{
    function onClickOut(e){ if(cliRef.current && !cliRef.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener("mousedown", onClickOut);
    return ()=>document.removeEventListener("mousedown", onClickOut);
  },[]);

  useEffect(() => {
    return () => {
      iaActivaRef.current = false;
      recognizerRef.current = null;
      setIaActiva(false);
    };
  }, []);

  function handleClienteChange(id) {
    const c = cls.find(x=>x.id===id);
    setForm(p=>({...p, clienteId:id, direccion:c?.direccion||""}));
    setCliQuery("");
    setShowDrop(false);
  }

  function deseleccionarCliente() {
    setForm(p=>({...p, clienteId:"", direccion:""}));
    setCliQuery("");
  }

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
  const MicBtn = ({onResult}) => (
    <button type="button" onClick={()=>startVoiceSimple(onResult)}
      style={{ width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
      </svg>
    </button>
  );

  async function crearCliente() {
    if (!cliForm.nombre.trim() || !cliForm.telefono.trim()) { alert("Nombre y teléfono son obligatorios."); return; }
    setSavingCli(true);
    const { data:nc, error } = await supabase.from("clientes").insert([{
      nombre:    cliForm.nombre.trim(),
      telefono:  cliForm.telefono.trim() || null,
      email:     cliForm.email.trim() || null,
      direccion: cliForm.direccion.trim() || null,
      dni:       cliForm.dni.trim() || null,
      notas:     cliForm.notas.trim() || null,
    }]).select().single();
    if (!error && nc) {
      await refresh?.();
      setForm(p=>({...p, clienteId:nc.id, direccion:nc.direccion||""}));
      setShowNuevoCli(false);
      setCliForm({ nombre:"", telefono:"", email:"", direccion:"", dni:"", notas:"" });
    } else alert("Error: " + (error?.message||""));
    setSavingCli(false);
  }

  function iniciarIA() {
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado"); return; }
    iaTranscriptRef.current = "";
    iaActivaRef.current = true;
    setIaActiva(true);
    function crearReconocedor() {
      const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
      const r = new SR();
      r.lang = "es-ES"; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = e => {
        for(let i = e.resultIndex; i < e.results.length; i++) {
          if(e.results[i].isFinal) iaTranscriptRef.current += (iaTranscriptRef.current ? " " : "") + e.results[i][0].transcript;
        }
      };
      r.onend = () => {
        if(iaActivaRef.current && recognizerRef.current) recognizerRef.current = crearReconocedor();
      };
      r.onerror = () => {
        if(iaActivaRef.current && recognizerRef.current) setTimeout(() => { recognizerRef.current = crearReconocedor(); }, 200);
      };
      r.start();
      return r;
    }
    recognizerRef.current = crearReconocedor();
  }

  async function pararIA() {
    iaActivaRef.current = false;
    setIaActiva(false);
    setIaCandidatos([]);
    try { recognizerRef.current?.stop(); } catch(e) {}
    recognizerRef.current = null;
    const transcript = iaTranscriptRef.current;
    if(!transcript) return;
    setProcesando(true);
    try {
      const res = await detectarAveria(transcript, data.clientes||[], data.profiles||[], data.materiales||[]);
      if(!res){ alert("No se pudo procesar el dictado. Inténtalo de nuevo."); setProcesando(false); return; }
      const norm = s => (s||"").toLowerCase().trim();
      const updates = {};
      if(res.descripcion) updates.descripcion = res.descripcion;
      if(res.equipo) updates.equipo = res.equipo;
      if(res.clienteNombre) {
        const q = norm(res.clienteNombre);
        const candidatos = (data.clientes||[]).filter(c => {
          const n = norm(c.nombre);
          return n === q || n.includes(q) || q.includes(n);
        });
        if(candidatos.length === 1) {
          updates.clienteId = candidatos[0].id;
          updates.direccion = candidatos[0].direccion || "";
          setCliQuery("");
          setIaCandidatos([]);
        } else if(candidatos.length > 1) {
          setIaCandidatos(candidatos);
        }
      }
      if(res.direccion && !updates.direccion) updates.direccion = res.direccion;
      if(res.tecnicoNombre) {
        const tec = (data.profiles||[]).find(t => norm(t.nombre) === norm(res.tecnicoNombre) || norm(t.nombre).includes(norm(res.tecnicoNombre)));
        if(tec) updates.tecnicoId = tec.id;
      }
      setForm(p=>({...p,...updates}));
    } catch(e){ alert("Error en IA: "+e.message); }
    setProcesando(false);
  }

  async function save() {
    console.log("SAVE EJECUTADO");
    if (!form.descripcion.trim() || !form.clienteId) { alert("Selecciona un cliente y escribe la descripción."); return; }
    if(savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const esAveria = form.tipo === "averia";
    const equipoVal = form.equipo.trim() || "Por determinar";
    const payload = esAveria
      ? { cliente_id:form.clienteId, equipo:equipoVal, descripcion:form.descripcion.trim(), direccion:form.direccion||null, tecnico_id:form.tecnicoId||null, status:"nueva", from_form:false }
      : { cliente_id:form.clienteId, equipo:equipoVal, descripcion:form.descripcion.trim(), direccion:form.direccion||null, tecnico_id:form.tecnicoId||null, fecha_visita:form.fechaVisita||null, status:"nuevo", from_form:false };
    const { error } = await supabase.from(esAveria?"averias":"mantenimientos").insert([payload]);
    if (!error) {
      const clNombre = (data.clientes||[]).find(c=>c.id===form.clienteId)?.nombre || "cliente";
      console.log("DATA PROFILES AL GUARDAR:", data?.profiles?.length, data?.profiles?.map(p=>({nombre:p.nombre, role:p.role, fcm_token:p.fcm_token?.slice(0,20)})));
      refresh?.(); onClose();
    } else alert("Error: " + error.message);
    setSaving(false);
    savingRef.current = false;
  }

  return (
    <Modal onClose={onClose} w={560}>
      <MHead title="Nuevo aviso" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* 1. Tipo */}
        <Field label="Tipo">
          <div style={{ display:"flex", gap:8 }}>
            {[["averia","Avería"],["mantenimiento","Mantenimiento"]].map(([k,l])=>(
              <button key={k} onClick={()=>upd("tipo",k)}
                style={{ flex:1, padding:"9px 0", borderRadius:8, border:`2px solid ${form.tipo===k?T.accent:T.border}`, background:form.tipo===k?T.accent+"22":T.card, color:form.tipo===k?T.accent:T.sub, fontWeight:form.tipo===k?700:400, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                {l}
              </button>
            ))}
          </div>
        </Field>

        {iaActiva
          ? <button type="button" onClick={pararIA}
              style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:"#dc2626",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,animation:"pulse-red 1.5s infinite" }}>
              ⏹ Parar y procesar
            </button>
          : procesando
          ? <button disabled style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:T.muted,color:"#fff",fontSize:15,fontWeight:700,cursor:"not-allowed",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              Procesando con IA...
            </button>
          : <button type="button" onClick={iniciarIA}
              style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#3b82f6 0%,#7c3aed 100%)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:0.2 }}>
              ✦ Crear aviso con IA
            </button>
        }

        {iaCandidatos.length > 1 && (
          <div style={{ background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 14px" }}>
            <div style={{ fontSize:12,fontWeight:600,color:"#92400e",marginBottom:8 }}>La IA detectó varios clientes con ese nombre — elige el correcto:</div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {iaCandidatos.map(c=>(
                <button key={c.id} type="button" onClick={()=>{ handleClienteChange(c.id); setIaCandidatos([]); }}
                  style={{ padding:"8px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ fontSize:13,fontWeight:600,color:T.text }}>{c.nombre}</span>
                  {c.telefono && <span style={{ fontSize:12,color:T.muted }}>{c.telefono}</span>}
                </button>
              ))}
              <button type="button" onClick={()=>setIaCandidatos([])}
                style={{ padding:"5px 10px",borderRadius:8,border:"none",background:"none",cursor:"pointer",fontSize:12,color:T.muted,textAlign:"left" }}>
                × Ninguno, buscaré manualmente
              </button>
            </div>
          </div>
        )}

        {/* 2. Cliente */}
        <Field label="Cliente *">
          <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <div ref={cliRef} style={{ position:"relative", flex:1 }}>
              {clienteSeleccionado ? (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:`1.5px solid ${T.accent}`, borderRadius:8, background:T.accentLight }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:T.accent }}>{clienteSeleccionado.nombre}</span>
                  {clienteSeleccionado.telefono && <span style={{ fontSize:12, color:T.sub }}>{clienteSeleccionado.telefono}</span>}
                  <button onClick={deseleccionarCliente} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:16, lineHeight:1, padding:"0 2px" }}>×</button>
                </div>
              ) : (
                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                  <input
                    value={cliQuery}
                    onChange={e=>{ setCliQuery(e.target.value); setShowDrop(true); }}
                    onFocus={()=>setShowDrop(true)}
                    placeholder="Buscar por nombre o teléfono..."
                    style={{...inp({fontSize:13}),flex:1}}
                    autoComplete="off"
                  />
                  <MicBtn onResult={t=>{ setCliQuery(t); setShowDrop(true); }}/>
                </div>
              )}
              {showDrop && !clienteSeleccionado && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:100, marginTop:4, maxHeight:240, overflowY:"auto" }}>
                  {cliResultados.length > 0 ? cliResultados.map(c=>(
                    <div key={c.id} onClick={()=>handleClienteChange(c.id)}
                      style={{ padding:"8px 12px", cursor:"pointer", borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=T.accentLight}
                      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{c.nombre}</div>
                      {c.telefono && <div style={{ fontSize:11, color:T.muted }}>{c.telefono}</div>}
                    </div>
                  )) : cliQuery.trim().length > 0 ? (
                    <div style={{ padding:"12px 14px" }}>
                      <div style={{ fontSize:13, color:T.muted, marginBottom:8 }}>No se encontraron clientes</div>
                      <button onClick={()=>{ setShowDrop(false); setShowNuevoCli(true); }}
                        style={{ padding:"7px 14px", borderRadius:8, border:"none", background:T.accent, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                        + Nuevo cliente
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <button onClick={()=>setShowNuevoCli(v=>!v)}
              style={{ padding:"8px 16px", borderRadius:8, border:"none", background:T.accent, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
              + Nuevo cliente
            </button>
          </div>
        </Field>

        {/* Formulario nuevo cliente inline */}
        {showNuevoCli && (
          <div style={{ background:T.surface, border:`1.5px solid ${T.accent}`, borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.accent, marginBottom:2 }}>Nuevo cliente</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Nombre *">
                <input value={cliForm.nombre} onChange={e=>updCli("nombre",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Nombre completo"/>
              </Field>
              <Field label="Teléfono *">
                <input value={cliForm.telefono} onChange={e=>updCli("telefono",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="600 000 000"/>
              </Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Email">
                <input value={cliForm.email} onChange={e=>updCli("email",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="email@ejemplo.com"/>
              </Field>
              <Field label="DNI / CIF">
                <input value={cliForm.dni} onChange={e=>updCli("dni",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="12345678A"/>
              </Field>
            </div>
            <Field label="Dirección">
              <input value={cliForm.direccion} onChange={e=>updCli("direccion",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Calle, número, ciudad..."/>
            </Field>
            <Field label="Notas">
              <input value={cliForm.notas} onChange={e=>updCli("notas",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Observaciones del cliente..."/>
            </Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:2 }}>
              <Btn ch="Cancelar" onClick={()=>setShowNuevoCli(false)} v="g" sm/>
              <Btn ch={savingCli?"Creando...":"Crear cliente"} onClick={crearCliente} disabled={savingCli||!cliForm.nombre.trim()||!cliForm.telefono.trim()} sm/>
            </div>
          </div>
        )}

        {/* 3. Equipo */}
        {(() => {
          const eqCliente = form.clienteId ? (data.equipos||[]).filter(e=>e.cliente_id===form.clienteId) : [];
          return (
            <Field label="Equipo / aparato">
              {eqCliente.length > 0 ? (
                <select value={form.equipo} onChange={e=>upd("equipo",e.target.value)} style={inp()}>
                  <option value="">Sin especificar / Por determinar</option>
                  {eqCliente.map(e=><option key={e.id} value={e.nombre}>{e.nombre}{e.marca?" — "+e.marca:""}{e.modelo?" "+e.modelo:""}</option>)}
                </select>
              ) : (
                <input value={form.equipo} onChange={e=>upd("equipo",e.target.value)} style={inp()} placeholder="Ej: Caldera, Split A/C, Bomba de calor... (opcional)"/>
              )}
            </Field>
          );
        })()}

        {/* 4. Descripción */}
        <Field label={form.tipo==="averia"?"Descripción del problema *":"Descripción del trabajo *"}>
          <div style={{ display:"flex",gap:6,alignItems:"flex-start" }}>
            <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
              placeholder={form.tipo==="averia"?"Describe brevemente el problema...":"Describe el mantenimiento a realizar..."}
              style={{...inp(),minHeight:75,resize:"vertical",flex:1}}/>
            <MicBtn onResult={t=>setForm(p=>({...p,descripcion:p.descripcion?p.descripcion+" "+t:t}))}/>
          </div>
        </Field>

        {/* 5. Dirección */}
        <Field label="Dirección de la visita">
          <input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Dirección donde realizar la visita"/>
        </Field>

        {/* 6. Técnico */}
        {isAdmin && (
          <Field label="Técnico asignado">
            <select value={form.tecnicoId} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}

        {/* 7. Fecha visita (solo mantenimiento) */}
        {form.tipo==="mantenimiento" && (
          <Field label="Fecha visita">
            <input type="date" value={form.fechaVisita} onChange={e=>upd("fechaVisita",e.target.value)} style={inp()}/>
          </Field>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={()=>{ if(iaActiva) pararIA(); onClose(); }} v="g"/>
          <Btn ch={saving?"Creando...":"Crear aviso"} onClick={save} disabled={saving||!form.descripcion.trim()||!form.clienteId}/>
        </div>
      </div>
    </Modal>
  );
}
