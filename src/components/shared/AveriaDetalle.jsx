import React, { useState, useEffect, useRef } from "react";
import { useTheme }          from "../../ThemeContext.jsx";
import { mkInp }             from "../../utils/styles.js";
import { supabase }         from "../../supabase.js";
import { useIsMobile }      from "../../hooks/useIsMobile.js";
import { openMaps }         from "../../utils/links.js";
import { generarPartePDF }  from "../../pdf/partePDF.js";
import { SO_B }             from "../../constants/status.js";
import Modal                from "../ui/Modal.jsx";
import Field                from "../ui/Field.jsx";
import Btn                  from "../ui/Btn.jsx";
import BtnContacto          from "./BtnContacto.jsx";
import ProgramarVisitaModal from "./ProgramarVisitaModal.jsx";
import ParteModal           from "./ParteModal.jsx";
import EquipoDetalle        from "./EquipoDetalle.jsx";

export default function AveriaDetalle({ averia:initA, data, user, techs, empresa, refresh, onClose }) {
  const { T, BS } = useTheme();
  const inp = mkInp(T);
  const isMobile  = useIsMobile();
  const isAdmin   = user.role === "admin";
  const [tab, setTab]         = useState("info");
  const [averia, setAveria]   = useState(initA);
  const [notas, setNotas]     = useState([]);
  const [partes, setPartes]   = useState([]);
  const [fotos, setFotos]     = useState([]);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [nota, setNota]       = useState("");
  const [showParte, setShowParte] = useState(false);
  const [showEquipoHistorial, setShowEquipoHistorial] = useState(false);
  const fileRef = useRef();
  const galleryRef = useRef();
  const notaRef = useRef();
  const [voiceActive, setVoiceActive] = useState(false);

  const cl = (data.clientes||[]).find(c=>c.id===averia.cliente_id);
  const tc = (techs||[]).find(t=>t.id===averia.tecnico_id);
  const s  = BS[averia.status];
  const equipoVinculado = averia.equipo_id ? (data.equipos||[]).find(eq=>eq.id===averia.equipo_id) : null;

  useEffect(()=>{ loadNotas(); loadPartes(); loadFotos(); },[averia.id]);

  async function loadNotas()  { const {data:d}=await supabase.from("notas_averias").select("*").eq("averia_id",averia.id).order("created_at",{ascending:true}); setNotas(d||[]); }
  async function loadPartes() { const {data:d}=await supabase.from("partes").select("*").eq("averia_id",averia.id).order("created_at",{ascending:false}); setPartes(d||[]); }
  async function loadFotos()  { const {data:d}=await supabase.from("fotos_averias").select("*").eq("averia_id",averia.id); setFotos(d||[]); }

  async function updStatus(newStatus) {
    const updates = { status: newStatus };
    if(newStatus==="cerrada") updates.status="pendiente_facturar";
    const {error}=await supabase.from("averias").update(updates).eq("id",averia.id);
    if(!error){ setAveria(p=>({...p,...updates})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function addNota(txt) {
    const texto = txt || nota.trim();
    if(!texto) return;
    await supabase.from("notas_averias").insert([{averia_id:averia.id,autor_id:user.id,autor_nombre:user.nombre,texto}]);
    setNota(""); loadNotas();
  }

  async function subirFoto(e) {
    const files = Array.from(e.target.files).slice(0, 4 - fotos.length);
    for(const file of files) {
      // Comprimir imagen antes de subir
      const compressed = await new Promise(resolve => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => { URL.revokeObjectURL(url); resolve(blob); }, "image/jpeg", 0.7);
        };
        img.src = url;
      });
      const ext = "jpg";
      const path = `averias/${averia.id}/${Date.now()}.${ext}`;
      const {error} = await supabase.storage.from("fotos").upload(path, compressed, {
        upsert:false, contentType:"image/jpeg"
      });
      if(!error) await supabase.from("fotos_averias").insert([{averia_id:averia.id, storage_path:path}]);
    }
    loadFotos(); e.target.value="";
  }

  function getFotoUrl(path){ const {data}=supabase.storage.from("fotos").getPublicUrl(path); return data?.publicUrl||""; }

  // Dictado por voz
  function startVoice() {
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado por voz"); return; }
    setVoiceActive(true);
    let transcript = ""; let active = true; let currentR = null;
    function finish() {
      active = false; setVoiceActive(false);
      if(currentR) { try { currentR.stop(); } catch(e){} }
      if(transcript) { setNota(p=>(p?p+" "+transcript:transcript)); notaRef.current?.focus(); }
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

  // Respuestas rápidas
  const RAPIDAS = ["Mantenimiento correcto","Falta gas refrigerante","Filtros sucios","Sustitución de pieza","Sin suministro eléctrico","Termostato defectuoso","Bomba de calor averiada","Revisión anual completada","Pendiente de pieza","Cliente no disponible"];

  const ESTADOS_FLOW = ["nueva","en_reparacion","pendiente_piezas","presupuesto_enviado","pendiente_facturar"];
  const ESTADO_LABELS = { nueva:"Nueva",en_reparacion:"En proceso",pendiente_piezas:"Pend. piezas",presupuesto_enviado:"Presup. enviado",pendiente_facturar:"Pend. facturar",facturado:"Facturado" };

  const isPendFacturar = averia.status==="pendiente_facturar";
  const isFacturado    = averia.status==="facturado";

  return (
    <Modal onClose={onClose} w={720}>
      {/* ── BARRA OPERATIVA FIJA ── */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.card,borderBottom:`1px solid ${T.border}` }}>

        {/* Fila 1: Cliente + dirección + equipo */}
        <div style={{ padding:"12px 14px 8px" }}>
          <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:2 }}>{cl?.nombre||"Cliente"}</div>
          <div style={{ fontSize:12,color:T.muted }}>{averia.equipo}{averia.direccion?` · ${averia.direccion}`:""}</div>
        </div>

        {/* Fila 2: Botones de acción — todos pequeños */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6,alignItems:"center" }}>
          {cl?.telefono&&<a href={`tel:${cl.telefono}`} style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
          {cl?.telefono&&<a href={`https://wa.me/34${cl.telefono.replace(/\s/g,"")}`} target="_blank" rel="noreferrer" style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
          {averia.direccion&&<button onClick={()=>openMaps(averia.direccion)} style={{ width:36,height:36,borderRadius:9,background:T.accentLight,border:"1.5px solid "+T.accent+"40",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></button>}
          <BtnContacto cliente={cl}/>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ width:36,height:36,borderRadius:9,background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
        </div>

        {/* Fila 3: Workflow estados */}
        <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4,overflowX:"auto" }}>
          {ESTADOS_FLOW.map((k,i)=>{
            const activo = averia.status===k;
            const pasado = SO_B[averia.status]>SO_B[k];
            const sc = BS[k];
            return (
              <React.Fragment key={k}>
                <button onClick={()=>!isFacturado&&updStatus(k)} disabled={isFacturado}
                  style={{ padding:"5px 10px",borderRadius:20,border:`1.5px solid ${activo?sc.color:pasado?sc.color+"60":T.border}`,background:activo?sc.color:pasado?sc.color+"15":T.card,color:activo?"#fff":pasado?sc.color:T.muted,fontSize:11,fontWeight:activo?700:500,cursor:isFacturado?"default":"pointer",whiteSpace:"nowrap",flexShrink:0 }}>
                  {activo&&"● "}{ESTADO_LABELS[k]}
                </button>
                {i<ESTADOS_FLOW.length-1&&<span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span>}
              </React.Fragment>
            );
          })}
          {isPendFacturar&&<><span style={{ color:T.border,fontSize:12 }}>›</span><button onClick={async()=>{ const {error}=await supabase.from("averias").update({status:"facturado"}).eq("id",averia.id); if(!error){setAveria(p=>({...p,status:"facturado"}));refresh?.();} }} style={{ padding:"5px 10px",borderRadius:20,border:`1px solid ${T.orange}`,background:T.orange+"22",color:T.orange,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0 }}>Facturar</button></>}
          {isFacturado&&<><span style={{ color:T.border,fontSize:12 }}>›</span><span style={{ padding:"5px 10px",borderRadius:20,background:T.surface,color:T.muted,fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>Facturado</span></>}
        </div>

        {/* Fila 4: Técnico + Parte + Programar */}
        <div style={{ padding:"0 14px 8px",borderTop:`1px solid ${T.border}`,paddingTop:8,display:"flex",gap:6,alignItems:"center" }}>
          {isAdmin&&(
            <select defaultValue={averia.tecnico_id||""} onChange={async e=>{ const {error}=await supabase.from("averias").update({tecnico_id:e.target.value||null}).eq("id",averia.id); if(!error){setAveria(p=>({...p,tecnico_id:e.target.value||null}));refresh?.();} }} style={{...inp({padding:"6px 8px",fontSize:12,width:"auto",borderRadius:8,flex:1,maxWidth:160})}}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
          <button onClick={()=>{ setTab("partes"); setShowParte(true); }} style={{ padding:"7px 14px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>+ Parte</button>
          <ProgramarVisitaModal averia={averia} cliente={cl} data={data}/>

        </div>

        {/* Fila 5: Tabs */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6 }}>
          {["info","fotos","notas"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"8px 4px",borderRadius:8,border:`1px solid ${tab===t?T.accent:T.border}`,background:tab===t?T.accentLight:T.card,color:tab===t?T.accent:T.sub,fontSize:12,fontWeight:tab===t?700:400,cursor:"pointer",textAlign:"center",fontFamily:"'DM Sans',sans-serif" }}>
              {{info:"Info",fotos:`Fotos (${fotos.length})`,notas:`Notas (${notas.length})`}[t]}
            </button>
          ))}
        </div>

      </div>
      {/* ── CONTENIDO ── */}
      <div style={{ padding:"14px 16px",overflowY:"auto",maxHeight:"60vh" }}>

        {/* Aviso pendiente facturar */}
        {isPendFacturar&&(
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:T.orange+"18",border:`1px solid ${T.orange}`,borderRadius:8,marginBottom:12 }}>
            <span style={{ flex:1,fontSize:13,color:T.orange,fontWeight:500 }}>Avería cerrada — recuerda enviar la factura</span>
            {partes.length>0&&<button onClick={()=>generarPartePDF(partes[0],averia,cl,empresa)} style={{ padding:"6px 12px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card,color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer" }}>Ver PDF</button>}
          </div>
        )}

        {/* ── TAB INFO ── */}
        {tab==="info"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {/* Descripción */}
            <div style={{ padding:"10px 12px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,fontSize:13,color:T.text,lineHeight:1.6 }}>{averia.descripcion}</div>

            {isAdmin&&(
              <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4 }}>
                <button onClick={async()=>{
                  if(!window.confirm("¿Eliminar esta avería y todos sus datos (partes, fotos, notas)?")) return;
                  await supabase.from("partes").delete().eq("averia_id",averia.id);
                  await supabase.from("notas_averias").delete().eq("averia_id",averia.id);
                  await supabase.from("fotos_averias").delete().eq("averia_id",averia.id);
                  const {error}=await supabase.from("averias").delete().eq("id",averia.id);
                  if(!error){ refresh?.(); onClose(); } else alert("Error: "+error.message);
                }} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid "+T.red+"40",background:T.redLight,color:T.red,fontSize:12,fontWeight:600,cursor:"pointer" }}>
                  Eliminar avería
                </button>
              </div>
            )}

            {/* Equipo vinculado */}
            {isAdmin&&(data.equipos||[]).filter(eq=>eq.cliente_id===averia.cliente_id).length>0&&(
              <Field label="Equipo vinculado">
                <select value={averia.equipo_id||""} onChange={async e=>{ const val=e.target.value||null; const {error}=await supabase.from("averias").update({equipo_id:val}).eq("id",averia.id); if(!error){setAveria(p=>({...p,equipo_id:val}));refresh?.();} }} style={inp()}>
                  <option value="">Sin vincular</option>
                  {(data.equipos||[]).filter(eq=>eq.cliente_id===averia.cliente_id).map(eq=><option key={eq.id} value={eq.id}>{eq.nombre}{eq.marca?" — "+eq.marca:""}</option>)}
                </select>
              </Field>
            )}

            {equipoVinculado && (
              <button
                onClick={()=>setShowEquipoHistorial(true)}
                style={{
                  marginTop:8, padding:"7px 14px", borderRadius:8,
                  border:"1.5px solid "+T.accent+"40",
                  background:T.accentLight, color:T.accent,
                  fontSize:12, fontWeight:600, cursor:"pointer",
                  width:"100%", textAlign:"center"
                }}>
                Ver historial técnico — {equipoVinculado.nombre}
              </button>
            )}

            {/* Partes compactos */}
            {partes.map(p=>{
              const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0;
              return (
                <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:T.text }}>{p.tecnico_nombre} {h>0?`· ${h.toFixed(1)}h`:""}</div>
                    <div style={{ fontSize:16,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</div>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <span style={{ fontSize:11,color:p.firma_url?T.green:T.red }}>{p.firma_url?"Firmado":"Sin firma"}</span>
                    <Btn ch="PDF" onClick={()=>generarPartePDF(p,averia,cl,empresa)} v="b" sm/>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB FOTOS ── */}
        {tab==="fotos"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8 }}>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} onChange={subirFoto}/>
              <input ref={galleryRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={subirFoto}/>
              <span style={{ fontSize:12,color:T.sub }}>{fotos.length}/4 fotos</span>
              {fotos.length<4 && (
                <div style={{ display:"flex", gap:6 }}>
                  <Btn ch="Cámara" onClick={()=>fileRef.current.click()} v="g" sm/>
                  <Btn ch="Galería" onClick={()=>galleryRef.current.click()} v="s" sm/>
                </div>
              )}
            </div>
            {fotos.length===0?<div onClick={()=>fileRef.current.click()} style={{ border:`2px dashed ${T.border}`,borderRadius:10,padding:30,textAlign:"center",cursor:"pointer",color:T.muted }}>Pulsa para añadir fotos</div>
            :<div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8 }}>{fotos.map(f=><div key={f.id} style={{ position:"relative",aspectRatio:"4/3",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}` }}><img src={getFotoUrl(f.storage_path)} alt="" onClick={()=>setFotoAmpliada(getFotoUrl(f.storage_path))} style={{ width:"100%",height:"100%",objectFit:"cover",cursor:"pointer" }}/><button onClick={async()=>{ await supabase.storage.from("fotos").remove([f.storage_path]); await supabase.from("fotos_averias").delete().eq("id",f.id); loadFotos(); }} style={{ position:"absolute",top:6,right:6,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer" }}>×</button></div>)}</div>}
          </div>
        )}

        {/* ── TAB NOTAS ── */}
        {tab==="notas"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>

            {/* Campo nota + voz */}
            <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
              <textarea ref={notaRef} value={nota} onChange={e=>setNota(e.target.value)} placeholder="Añadir nota técnica..." style={{...inp(),flex:1,minHeight:60,resize:"none"}} onKeyDown={e=>{ if(e.key==="Enter"&&e.ctrlKey) addNota(); }}/>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                <button onClick={()=>{
                  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
                    alert("Tu navegador no soporta el micrófono"); return;
                  }
                  const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
                  const r = new SR();
                  r.lang="es-ES"; r.continuous=false; r.interimResults=false;
                  r.onresult=e=>{ setNota(p=>(p?p+" ":"")+e.results[0][0].transcript); };
                  r.start();
                }} style={{
                  width:36, height:36, borderRadius:8, border:`1px solid ${T.border}`,
                  background:T.surface, cursor:"pointer", display:"flex",
                  alignItems:"center", justifyContent:"center", flexShrink:0
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2">
                    <rect x="9" y="2" width="6" height="11" rx="3"/>
                    <path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
                  </svg>
                </button>
                <Btn ch="OK" onClick={()=>addNota()} disabled={!nota.trim()}/>
              </div>
            </div>
            {/* Notas existentes */}
            {notas.length===0&&<p style={{ color:T.muted,fontSize:13 }}>Sin notas.</p>}
            {notas.map(n=>(
              <div key={n.id} style={{ background:T.surface,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:11,fontWeight:600,color:T.accent }}>{n.autor_nombre}</span>
                  <span style={{ fontSize:10,color:T.muted }}>{new Date(n.created_at).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <p style={{ margin:0,fontSize:13,color:T.text,lineHeight:1.5 }}>{n.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showParte&&<ParteModal averia={averia} cliente={cl} user={user} empresa={empresa} profiles={data.profiles} materiales={data.materiales||[]} refresh={()=>{loadPartes();refresh?.();}} onClose={()=>setShowParte(false)}/>}
      {showEquipoHistorial && equipoVinculado && (
        <EquipoDetalle
          equipo={equipoVinculado}
          data={data}
          refresh={refresh}
          onClose={()=>setShowEquipoHistorial(false)}
        />
      )}
      {fotoAmpliada && (
        <div onClick={()=>setFotoAmpliada(null)}
          style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",
            background:"#000000dd",zIndex:2000,display:"flex",
            alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <img src={fotoAmpliada} alt=""
            style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain",borderRadius:8}}
            onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setFotoAmpliada(null)}
            style={{position:"absolute",top:20,right:20,background:"none",
              border:"none",color:"#fff",fontSize:32,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </Modal>
  );
}
