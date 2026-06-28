import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { mkInp } from "../../utils/styles.js";
import { todayStr } from "../../utils/dates.js";
import { startVoiceSimple } from "../../hooks/useVoice.js";
import { generarParteCompleto } from "../../ai.js";
import { generarPartePDF } from "../../pdf/partePDF.js";
import { sendPushNotification } from "../../push.js";
import { supabase } from "../../supabase.js";
import Modal from "../ui/Modal.jsx";
import MHead from "../ui/MHead.jsx";
import Btn from "../ui/Btn.jsx";

export default function ParteModal({ averia, cliente, user, empresa, profiles, refresh, onClose, titulo="PARTE DE TRABAJO", materiales=[] }) {
  const { T } = useTheme();
  const inp = (x={}) => mkInp(T)(x);
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    trabajo: "", observaciones: "",
    horaInicio: "", horaFin: "", precioHora: 40,
    materiales: [{ desc:"", qty:1, precio:0 }],
    formaPago: "efectivo",
  });
  const [saving, setSaving] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [firmado, setFirmado] = useState(false);
  const firmaRef = useRef(null);
  const recognizerRef = useRef(null);
  const iaTranscriptRef = useRef("");
  const iaActivaRef = useRef(false);
  const [matDrop,setMatDrop]=useState(-1);
  const [showDatosCliente, setShowDatosCliente] = useState(false);
  const [datosCliente, setDatosCliente] = useState({
    nombre: cliente?.nombre||"",
    telefono: cliente?.telefono||"",
    direccion: cliente?.direccion||"",
    email: cliente?.email||"",
    dni: cliente?.dni||""
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const h = (form.horaInicio&&form.horaFin)?(()=>{ const [h1,m1]=form.horaInicio.split(":").map(Number),[h2,m2]=form.horaFin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0;
  const tMO = h*parseFloat(form.precioHora||0);
  const tMat = form.materiales.reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0);
  const base = tMO+tMat;
  const iva = base*0.21;
  const total = base+iva;

  function updMat(i,k,v){ const ms=[...form.materiales]; ms[i]={...ms[i],[k]:v}; upd("materiales",ms); }
  function addMat(){ upd("materiales",[...form.materiales,{desc:"",qty:1,precio:0}]); }
  function removeMat(i){ if(form.materiales.length===1) return; upd("materiales",form.materiales.filter((_,j)=>j!==i)); }

  // Firma setup on mount
  useEffect(()=>{
    if(!cliente) return;
    const falta = !cliente.nombre||!cliente.telefono||!cliente.direccion||!cliente.email||!cliente.dni;
    if(falta) setShowDatosCliente(true);
  },[]);

  useEffect(()=>{
    const canvas = firmaRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = T.card;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    let drawing = false;
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches?.[0] || e;
      return { x:(src.clientX-r.left)*(canvas.width/r.width), y:(src.clientY-r.top)*(canvas.height/r.height) };
    };
    const onDown = (e) => { e.preventDefault(); drawing=true; const p=getPos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
    const onMove = (e) => { e.preventDefault(); if(!drawing)return; const p=getPos(e); ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.strokeStyle=T.accent; ctx.lineTo(p.x,p.y); ctx.stroke(); setFirmado(true); };
    const onUp = () => { drawing=false; };
    canvas.addEventListener("mousedown",onDown);
    canvas.addEventListener("mousemove",onMove);
    canvas.addEventListener("mouseup",onUp);
    canvas.addEventListener("touchstart",onDown,{passive:false});
    canvas.addEventListener("touchmove",onMove,{passive:false});
    canvas.addEventListener("touchend",onUp);
    return () => {
      canvas.removeEventListener("mousedown",onDown);
      canvas.removeEventListener("mousemove",onMove);
      canvas.removeEventListener("mouseup",onUp);
      canvas.removeEventListener("touchstart",onDown);
      canvas.removeEventListener("touchmove",onMove);
      canvas.removeEventListener("touchend",onUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      iaActivaRef.current = false;
      recognizerRef.current = null;
      setIaActiva(false);
    };
  }, []);

  function limpiarFirma(){
    const c=firmaRef.current; if(!c)return;
    const ctx=c.getContext("2d"); ctx.fillStyle=T.card; ctx.fillRect(0,0,c.width,c.height);
    setFirmado(false);
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

  async function detenerIA() {
    iaActivaRef.current = false;
    setIaActiva(false);
    try { recognizerRef.current?.stop(); } catch(e) {}
    recognizerRef.current = null;
    const transcript = iaTranscriptRef.current;
    if(!transcript) return;
    setProcesando(true);
    try {
      const res = await generarParteCompleto(transcript, materiales||[]);
      if(!res){ alert("No se pudo procesar el dictado. Inténtalo de nuevo."); setProcesando(false); return; }
      setForm(prev => ({
        ...prev,
        horaInicio: res.horaInicio || prev.horaInicio,
        horaFin: res.horaFin || prev.horaFin,
        trabajo: res.trabajo || prev.trabajo,
        materiales: res.materiales?.length ? res.materiales.map(m=>({desc:m.desc||"",qty:m.qty||1,precio:m.price||0})) : prev.materiales,
        formaPago: res.formaPago || prev.formaPago,
      }));
    } catch(e){ alert("Error en IA: "+e.message); }
    setProcesando(false);
  }


  async function guardar() {
    if(!firmado){ alert("El cliente debe firmar antes de guardar."); return; }
    setSaving(true);
    const canvas = firmaRef.current;
    let firmaUrl = "";
    let firmaBase64 = "";
    try {
      // Guardar como base64 para PDF (siempre disponible sin CORS)
      firmaBase64 = canvas.toDataURL("image/png");
      // También subir a Storage para backup
      const blob = await new Promise(res=>canvas.toBlob(res,"image/png"));
      const path = `firmas/${averia.id}_${Date.now()}.png`;
      const {error:fErr} = await supabase.storage.from("fotos").upload(path,blob,{contentType:"image/png",upsert:false});
      if(!fErr){ const {data:ud}=supabase.storage.from("fotos").getPublicUrl(path); firmaUrl=ud?.publicUrl||""; }
    } catch(e){}

    const mats = form.materiales.filter(m=>m.desc);
    const id = String(averia.id);
    const isMant = id.startsWith("mant_");
    const isObra = id.startsWith("obra_");
    const payload = {
      averia_id: isMant||isObra ? null : averia.id,
      mantenimiento_id: isMant ? parseInt(id.replace("mant_","")) : null,
      instalacion_id: isObra ? parseInt(id.replace("obra_","")) : null,
      tecnico_id:user.id, tecnico_nombre:user.nombre,
      fecha:todayStr(), hora_inicio:form.horaInicio||null, hora_fin:form.horaFin||null,
      precio_hora:parseFloat(form.precioHora||0), materiales:mats,
      trabajo:form.trabajo, observaciones:form.observaciones,
      firma_url:firmaUrl, firma_base64:firmaBase64, forma_pago:form.formaPago,
      aplicar_iva:true, importe_mo:tMO, importe_materiales:tMat, importe_total:total,
    };

    const { error } = await supabase.from("partes").insert([payload]);
    if(error){ alert("Error al guardar: "+error.message); setSaving(false); return; }

    // Auto-cerrar avería o mantenimiento al guardar parte
    if(isMant){
      await supabase.from("mantenimientos").update({status:"pendiente_facturar"}).eq("id",parseInt(id.replace("mant_","")));
    } else if(isObra){
      await supabase.from("instalaciones_obras").update({status:"pendiente_facturar"}).eq("id",parseInt(id.replace("obra_","")));
    } else if(averia?.id){
      await supabase.from("averias").update({status:"pendiente_facturar"}).eq("id",averia.id);
    }
    sendPushNotification(profiles, "Pendiente de facturar", "Cliente: " + (cliente?.nombre||"cliente") + " - " + (averia?.descripcion||"Trabajo completado").slice(0,80), "admin");
    refresh?.();
    await generarPartePDF({...payload,tecnico_nombre:user.nombre}, averia, cliente, empresa, titulo);
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose} w={620}>
      <MHead title="Parte de trabajo" sub={`${averia.equipo||""} · ${cliente?.nombre||""}`} onClose={onClose}/>
      <div style={{ display:"flex",flexDirection:"column",gap:10,padding:isMobile?"12px 10px":"14px 20px" }}>

        {showDatosCliente && (
          <div style={{background:T.orangeLight, border:`1px solid ${T.orange}44`, borderRadius:10,
            padding:"14px 16px", marginBottom:16}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <div style={{fontSize:13, fontWeight:700, color:T.orange}}>
                Datos del cliente incompletos para facturación
              </div>
              <button onClick={()=>setShowDatosCliente(false)}
                style={{background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:16}}>✕</button>
            </div>
            {[
              {k:"nombre", l:"Nombre"},
              {k:"telefono", l:"Teléfono"},
              {k:"direccion", l:"Dirección"},
              {k:"email", l:"Email"},
              {k:"dni", l:"DNI/NIF"}
            ].map(f => (!cliente[f.k] &&
              <div key={f.k} style={{marginBottom:8}}>
                <div style={{fontSize:11, color:T.muted, marginBottom:3}}>{f.l}</div>
                <input
                  value={datosCliente[f.k]}
                  onChange={e=>setDatosCliente(p=>({...p,[f.k]:e.target.value}))}
                  placeholder={f.l}
                  style={{...inp(), fontSize:13}}
                />
              </div>
            ))}
            <button
              onClick={async()=>{
                const updates = {};
                ["nombre","telefono","direccion","email","dni"].forEach(k=>{
                  if(!cliente[k] && datosCliente[k]) updates[k]=datosCliente[k];
                });
                if(Object.keys(updates).length>0){
                  await supabase.from("clientes").update(updates).eq("id", cliente.id);
                  refresh?.();
                }
                setShowDatosCliente(false);
              }}
              style={{width:"100%", padding:"8px", borderRadius:8, background:T.orange,
                color:"#fff", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, marginTop:4}}>
              Guardar y continuar
            </button>
          </div>
        )}

        {/* Botón crear parte con IA */}
        {iaActiva
          ? <button type="button" onClick={detenerIA}
              style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:"#dc2626",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,animation:"pulse-red 1.5s infinite" }}>
              ⏹ Parar y procesar
            </button>
          : procesando
          ? <button disabled style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:T.muted,color:"#fff",fontSize:15,fontWeight:700,cursor:"not-allowed",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              Procesando con IA...
            </button>
          : <button type="button" onClick={iniciarIA}
              style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#3b82f6 0%,#7c3aed 100%)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:0.2 }}>
              ✦ Crear parte con IA
            </button>
        }
        {!iaActiva && !procesando && <p style={{ textAlign:"center",fontSize:11,color:T.muted,margin:"-6px 0 0" }}>Pulsa y describe el trabajo, horas, materiales y cobro de una vez</p>}

        {/* Horas + resumen en una fila */}
        <div style={{ background:T.surface,borderRadius:10,padding:"12px",border:`1px solid ${T.border}` }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:8,marginBottom:8 }}>
            <div><label style={{ fontSize:10,color:T.muted,display:"block",marginBottom:3 }}>Hora inicio</label><input type="time" step={900} value={form.horaInicio} onChange={e=>upd("horaInicio",e.target.value)} style={inp({padding:"6px 8px",fontSize:13})}/></div>
            <div><label style={{ fontSize:10,color:T.muted,display:"block",marginBottom:3 }}>Hora fin</label><input type="time" step={900} value={form.horaFin} onChange={e=>upd("horaFin",e.target.value)} style={inp({padding:"6px 8px",fontSize:13})}/></div>
            <div><label style={{ fontSize:10,color:T.muted,display:"block",marginBottom:3 }}>€/hora</label><input type="number" value={form.precioHora} onChange={e=>upd("precioHora",e.target.value)} style={inp({padding:"6px 8px",fontSize:13})}/></div>
          </div>
          <div style={{ display:"flex",gap:6 }}>
            <div style={{ flex:1,background:T.accentLight,borderRadius:7,padding:"5px 8px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:10,color:T.accent,fontWeight:600 }}>TIEMPO</span>
              <span style={{ fontSize:13,fontWeight:700,color:T.accent }}>{h.toFixed(1)}h</span>
            </div>
            <div style={{ flex:1,background:T.orangeLight,borderRadius:7,padding:"5px 8px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:10,color:T.orange,fontWeight:600 }}>M.O.</span>
              <span style={{ fontSize:13,fontWeight:700,color:T.orange }}>{tMO.toFixed(2)}€</span>
            </div>
            <div style={{ flex:1,background:T.purpleLight,borderRadius:7,padding:"5px 8px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:10,color:T.purple,fontWeight:600 }}>MAT.</span>
              <span style={{ fontSize:13,fontWeight:700,color:T.purple }}>{tMat.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* Trabajo */}
        <div>
          <div style={{ marginBottom:4 }}>
            <label style={{ fontSize:11,fontWeight:600,color:T.sub }}>Trabajo realizado</label>
          </div>
          <div style={{ display:"flex",gap:6 }}><textarea value={form.trabajo} onChange={e=>upd("trabajo",e.target.value)} placeholder="Describe el trabajo realizado..." style={{...inp(),flex:1,minHeight: isMobile?100:50,resize:"vertical",fontSize:13}}/><button type="button" onClick={()=>startVoiceSimple(t=>upd("trabajo",form.trabajo?form.trabajo+" "+t:t))} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg></button></div>
        </div>

        {/* Materiales */}
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <label style={{ fontSize:12,fontWeight:600,color:T.sub }}>Materiales</label>
            <Btn ch="+ Añadir" onClick={addMat} v="g" sm/>
          </div>
          <div style={{ background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"visible" }}>
            {!isMobile && (
              <div style={{padding:"6px 10px", borderBottom:`1px solid ${T.border}`, borderRadius:"10px 10px 0 0", background:T.surface}}>
                <div style={{display:"grid", gridTemplateColumns:"1fr 60px 75px 50px 34px 28px", gap:4}}>
                  {["Descripción","Cant.","Precio","Total","",""].map((h,i)=>(
                    <span key={i} style={{fontSize:9, fontWeight:600, color:T.muted, textTransform:"uppercase"}}>{h}</span>
                  ))}
                </div>
              </div>
            )}
            {form.materiales.map((m,i)=>(
              isMobile ? (
              <div key={i} style={{padding:"8px 10px", borderBottom:i<form.materiales.length-1?`1px solid ${T.border}`:"none"}}>
                {/* Fila 1: descripción + micrófono + eliminar */}
                <div style={{display:"flex", gap:4, alignItems:"center", marginBottom:6}}>
                  <div style={{position:"relative", flex:1, overflow:"visible"}}>
                    <div style={{fontSize:10, color:T.muted, fontWeight:600, marginBottom:2}}>DESCRIPCIÓN</div>
                    <input value={m.desc} onChange={e=>{ updMat(i,"desc",e.target.value); setMatDrop(e.target.value.length>=2?i:-1); }} onBlur={()=>setTimeout(()=>setMatDrop(-1),150)} placeholder="Material o pieza" style={inp({padding:"7px 10px", fontSize:14})}/>
                    {matDrop===i&&(()=>{ const sugs=(materiales||[]).filter(mat=>mat.activo!==false&&mat.nombre.toLowerCase().includes(m.desc.toLowerCase())).slice(0,6); if(!sugs.length) return null; return(<div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:200,boxShadow:"0 4px 12px #0002",maxHeight:160,overflowY:"auto"}}>{sugs.map((s,si)=>(<div key={si} onMouseDown={()=>{updMat(i,"desc",s.nombre);updMat(i,"precio",s.precio);setMatDrop(-1);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${T.border}`,color:T.text}} onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background=T.card}>{s.nombre} <span style={{color:T.muted,fontSize:11}}>{s.precio}€</span></div>))}</div>);})()}
                  </div>
                  <button type="button" onClick={()=>startVoiceSimple(t=>{updMat(i,"desc",m.desc?m.desc+" "+t:t);})} style={{width:34,height:34,borderRadius:7,border:`1px solid ${T.border}`,background:T.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
                  </button>
                  <button onClick={()=>removeMat(i)} style={{width:28,height:34,borderRadius:7,border:`1px solid ${T.red}40`,background:T.redLight,color:T.red,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                </div>
                {/* Fila 2: cantidad + precio + total */}
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6}}>
                  <div>
                    <div style={{fontSize:10,color:T.muted,marginBottom:2,fontWeight:600}}>CANTIDAD</div>
                    <input type="number" value={m.qty} onChange={e=>updMat(i,"qty",e.target.value)} style={inp({padding:"6px 8px",fontSize:13,textAlign:"center"})}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:T.muted,marginBottom:2,fontWeight:600}}>PRECIO</div>
                    <input type="number" value={m.precio} onChange={e=>updMat(i,"precio",e.target.value)} placeholder="0.00" style={inp({padding:"6px 8px",fontSize:13,textAlign:"center"})}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:T.muted,marginBottom:2,fontWeight:600}}>TOTAL</div>
                    <div style={{padding:"6px 8px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`,fontSize:13,fontWeight:700,color:"#7c3aed",textAlign:"center",height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {m.qty&&m.precio?(parseFloat(m.qty)*parseFloat(m.precio)).toFixed(2)+"€":"—"}
                    </div>
                  </div>
                </div>
              </div>
              ) : (
              <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 60px 75px 50px 34px 28px",gap:4,padding:"5px 10px",borderBottom:i<form.materiales.length-1?`1px solid ${T.border}`:"none",alignItems:"center",overflow:"visible" }}>
                <div style={{position:"relative",overflow:"visible"}}>
                  <input value={m.desc} onChange={e=>{ updMat(i,"desc",e.target.value); setMatDrop(e.target.value.length>=2?i:-1); }} onBlur={()=>setTimeout(()=>setMatDrop(-1),150)} placeholder="Material o pieza" style={inp({padding:"5px 8px",fontSize:12})}/>
                  {matDrop===i&&(()=>{ const sugs=(materiales||[]).filter(mat=>mat.activo!==false&&mat.nombre.toLowerCase().includes(m.desc.toLowerCase())).slice(0,6); if(!sugs.length) return null; return(<div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,zIndex:200,boxShadow:"0 4px 12px #0002",maxHeight:160,overflowY:"auto"}}>{sugs.map((s,si)=>(<div key={si} onMouseDown={()=>{updMat(i,"desc",s.nombre);updMat(i,"precio",s.precio);setMatDrop(-1);}} style={{padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${T.border}`,color:T.text}} onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background=T.card}>{s.nombre} <span style={{color:T.muted,fontSize:11}}>{s.precio}€</span></div>))}</div>);})()}
                </div>
                <input type="number" value={m.qty} onChange={e=>updMat(i,"qty",e.target.value)} style={inp({padding:"5px 8px",fontSize:12})}/>
                <input type="number" value={m.precio} onChange={e=>updMat(i,"precio",e.target.value)} placeholder="0.00" style={inp({padding:"5px 8px",fontSize:12})}/>
                <span style={{ fontSize:11,fontWeight:600,color:"#7c3aed",textAlign:"center" }}>{m.qty&&m.precio?(parseFloat(m.qty)*parseFloat(m.precio)).toFixed(0):"—"}</span>
                <button type="button" onClick={()=>startVoiceSimple(t=>{updMat(i,"desc",m.desc?m.desc+" "+t:t);})} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg></button>
                <button onClick={()=>removeMat(i)} style={{ width:24,height:24,borderRadius:5,border:`1px solid ${T.border}`,background:T.card,color:T.muted,cursor:"pointer",fontSize:13 }}>×</button>
              </div>
              )
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label style={{ fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:4 }}>Observaciones</label>
          <div style={{ display:"flex",gap:6 }}><textarea value={form.observaciones} onChange={e=>upd("observaciones",e.target.value)} placeholder="Recomendaciones al cliente..." style={{...inp(),flex:1,minHeight:40,resize:"vertical",fontSize:13}}/><button type="button" onClick={()=>micField(t=>upd("observaciones",form.observaciones?form.observaciones+" "+t:t))} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg></button></div>
        </div>

        {/* Total */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:T.accentLight,border:"2px solid "+T.accent+"40",borderRadius:10 }}>
          <span style={{ fontSize:12,color:T.sub }}>Base {base.toFixed(2)}€ · IVA {iva.toFixed(2)}€</span>
          <span style={{ fontSize:22,fontWeight:800,color:T.accent,fontFamily:"'Sora',sans-serif" }}>TOTAL {total.toFixed(2)} €</span>
        </div>

        {/* Forma de pago */}
        <div>
          <label style={{ fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:8 }}>Forma de pago</label>
          <div style={{ display:"flex",gap:8 }}>
            {[{k:"efectivo",l:"Efectivo"},{k:"tarjeta",l:"Tarjeta"},{k:"transferencia",l:"Transferencia"}].map(op=>(
              <button type="button" key={op.k} onClick={()=>upd("formaPago",op.k)}
                style={{ flex:1,padding:"10px",borderRadius:9,border:`2px solid ${form.formaPago===op.k?T.accent:T.border}`,background:form.formaPago===op.k?T.accent+"22":T.card,color:form.formaPago===op.k?T.accent:T.sub,fontSize:13,fontWeight:form.formaPago===op.k?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {op.l}
              </button>
            ))}
          </div>
        </div>

        {/* Firma */}
        <div style={{ border:`2px solid ${firmado?T.green:T.border}`,borderRadius:10,overflow:"hidden",background:T.card }}>
          <div style={{ padding:"8px 14px",background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:12,fontWeight:700,color:T.sub }}>Firma del cliente {firmado?<span style={{ color:T.green }}>Firmado</span>:<span style={{ color:T.red }}>* Obligatoria</span>}</span>
            <button onClick={limpiarFirma} style={{ fontSize:11,color:T.muted,background:"none",border:"none",cursor:"pointer",padding:"2px 8px" }}>Limpiar</button>
          </div>
          <canvas ref={firmaRef} width={580} height={160}
            style={{ width:"100%",height:160,display:"block",touchAction:"none",cursor:"crosshair" }}/>
          <div style={{ textAlign:"center",fontSize:11,color:T.muted,padding:"4px",background:T.surface }}>El cliente firma aquí con el dedo o ratón</div>
        </div>

        {/* Guardar */}
        <button onClick={guardar} disabled={saving||!firmado}
          style={{ padding:"15px",borderRadius:12,border:"none",background:saving||!firmado?T.muted:T.accent,color:"#fff",fontSize:15,fontWeight:700,cursor:saving||!firmado?"default":"pointer",fontFamily:"'DM Sans',sans-serif" }}>
          {saving?"Guardando y generando PDF...":"Guardar y descargar PDF"}
        </button>
      </div>
    </Modal>
  );
}
