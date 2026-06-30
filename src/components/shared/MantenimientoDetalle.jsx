import React, { useState, useEffect, useRef } from "react";
import { useTheme }         from "../../ThemeContext.jsx";
import { mkInp }            from "../../utils/styles.js";
import { useIsMobile }      from "../../hooks/useIsMobile.js";
import { openMaps }         from "../../utils/links.js";
import { generarPartePDF }  from "../../pdf/partePDF.js";
import { supabase }         from "../../supabase.js";
import Modal                from "../ui/Modal.jsx";
import Btn                  from "../ui/Btn.jsx";
import BtnContacto          from "./BtnContacto.jsx";
import ProgramarVisitaModal from "./ProgramarVisitaModal.jsx";
import ParteModal           from "./ParteModal.jsx";

export default function MantenimientoDetalle({ mant:initM, data, user, techs, empresa, refresh, onClose }) {
  const { T, MS } = useTheme();
  const inp = mkInp(T);
  const isMobile  = useIsMobile();
  const isAdmin   = user.role === "admin";
  const [tab, setTab]       = useState("info");
  const [mant, setMant]     = useState(initM);
  const [notas, setNotas]   = useState([]);
  const [partes, setPartes] = useState([]);
  const [fotos, setFotos]   = useState([]);
  const [nota, setNota]     = useState("");
  const [showParte, setShowParte] = useState(false);
  const notaRef = useRef();
  const fileRef = useRef();
  const galleryRef = useRef();
  const [voiceActive, setVoiceActive] = useState(false);

  const cl = (data.clientes||[]).find(c=>c.id===mant.cliente_id);
  const s  = MS[mant.status];

  useEffect(()=>{ loadNotas(); loadPartes(); loadFotos(); },[mant.id]);

  async function loadNotas()  { const {data:d}=await supabase.from("notas_mantenimientos").select("*").eq("mantenimiento_id", mant.id).order("created_at",{ascending:true}); setNotas(d||[]); }
  async function loadPartes() { const {data:d}=await supabase.from("partes").select("*").eq("mantenimiento_id",mant.id).order("created_at",{ascending:false}); setPartes(d||[]); }
  async function loadFotos()  { const {data:d}=await supabase.from("fotos_averias").select("*").eq("mantenimiento_id", mant.id); setFotos(d||[]); }

  async function updStatus(newStatus) {
    const updates = { status: newStatus };
    if(newStatus==="cerrado") updates.status="pendiente_facturar";
    const {error}=await supabase.from("mantenimientos").update(updates).eq("id",mant.id);
    if(!error){ setMant(p=>({...p,...updates})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function addNota(txt) {
    const texto = txt||nota.trim(); if(!texto) return;
    await supabase.from("notas_mantenimientos").insert([{mantenimiento_id: mant.id,autor_id:user.id,autor_nombre:user.nombre,texto}]);
    setNota(""); loadNotas();
  }

  async function subirFoto(e) {
    const files=Array.from(e.target.files).slice(0,4-fotos.length);
    for(const file of files){ const ext=file.name.split(".").pop(); const path=`mantenimientos/${mant.id}/${Date.now()}.${ext}`; const {error}=await supabase.storage.from("fotos").upload(path,file,{upsert:false}); if(!error) await supabase.from("fotos_averias").insert([{mantenimiento_id: mant.id,storage_path:path}]); }
    loadFotos(); e.target.value="";
  }

  function getFotoUrl(path){ const {data}=supabase.storage.from("fotos").getPublicUrl(path); return data?.publicUrl||""; }

  function startVoice(cb) {
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado"); return; }
    setVoiceActive(true);
    let transcript = ""; let active = true; let currentR = null;
    function finish() {
      active = false; setVoiceActive(false);
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

  const isPendFacturar = mant.status==="pendiente_facturar";
  const isFacturado    = mant.status==="facturado";
  const ESTADOS_FLOW   = ["nuevo","en_proceso","cerrado"];

  const averiaMock = { id:"mant_"+mant.id, descripcion:mant.descripcion, equipo:mant.equipo, direccion:mant.direccion };

  return (
    <Modal onClose={onClose} w={720}>
      {/* ── BARRA FIJA ── */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.card,borderBottom:`1px solid ${T.border}` }}>

        {/* Fila 1: Cliente + info */}
        <div style={{ padding:"12px 14px 8px" }}>
          <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:2 }}>{cl?.nombre||"Cliente"}</div>
          <div style={{ fontSize:12,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {mant.equipo}{mant.direccion?` · ${mant.direccion}`:""}
          </div>
        </div>

        {/* Fila 2: Botones acción */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6,alignItems:"center" }}>
          {cl?.telefono&&<a href={`tel:${cl.telefono}`} style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
          {cl?.telefono&&<a href={`https://wa.me/34${(cl.telefono||"").replace(/\s/g,"")}`} target="_blank" rel="noreferrer" style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
          {mant.direccion&&<button onClick={()=>openMaps(mant.direccion)} style={{ width:36,height:36,borderRadius:9,background:T.accentLight,border:"1.5px solid "+T.accent+"40",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></button>}
          <BtnContacto cliente={cl}/>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ width:36,height:36,borderRadius:9,background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
        </div>

        {/* Fila 3: Workflow estados */}
        <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4,overflowX:"auto" }}>
          {ESTADOS_FLOW.map((k,i)=>{
            const activo=mant.status===k; const sc=MS[k];
            return (
              <React.Fragment key={k}>
                <button onClick={()=>!isFacturado&&updStatus(k)} disabled={isFacturado}
                  style={{ padding:"5px 10px",borderRadius:20,border:`1.5px solid ${activo?sc.color:T.border}`,background:activo?sc.color:T.card,color:activo?"#fff":T.muted,fontSize:11,fontWeight:activo?700:400,cursor:isFacturado?"default":"pointer",whiteSpace:"nowrap",flexShrink:0 }}>
                  {activo&&"● "}{sc.label}
                </button>
                {i<ESTADOS_FLOW.length-1&&<span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span>}
              </React.Fragment>
            );
          })}
          {isPendFacturar&&<><span style={{ color:T.border,fontSize:12 }}>›</span><button onClick={async()=>{ await supabase.from("mantenimientos").update({status:"facturado"}).eq("id",mant.id); setMant(p=>({...p,status:"facturado"})); refresh?.(); }} style={{ padding:"5px 10px",borderRadius:20,border:`1px solid ${T.orange}`,background:T.orange+"22",color:T.orange,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0 }}>Facturar</button></>}
          {isFacturado&&<><span style={{ color:T.border,fontSize:12 }}>›</span><span style={{ padding:"5px 10px",borderRadius:20,background:T.surface,color:T.muted,fontSize:11,fontWeight:600 }}>Facturado</span></>}
        </div>

        {/* Fila 4: Técnico + Parte */}
        <div style={{ padding:"0 14px 8px",borderTop:`1px solid ${T.border}`,paddingTop:8,display:"flex",gap:6,alignItems:"center" }}>
          {isAdmin&&(
            <select defaultValue={mant.tecnico_id||""} onChange={async e=>{ const {error}=await supabase.from("mantenimientos").update({tecnico_id:e.target.value||null}).eq("id",mant.id); if(!error){setMant(p=>({...p,tecnico_id:e.target.value||null}));refresh?.();} }} style={{...inp({padding:"6px 8px",fontSize:12,width:"auto",borderRadius:8,maxWidth:160})}}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
          <button onClick={()=>{ setTab("partes"); setShowParte(true); }} style={{ padding:"7px 14px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>+ Parte</button>
          <ProgramarVisitaModal averia={{...averiaMock,fecha_visita:mant.fecha_visita,cliente_id:mant.cliente_id}} cliente={cl} data={data}/>
        </div>

        {/* Fila 5: Tabs */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6 }}>
          {["info","fotos","notas","partes"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${tab===t?T.accent:T.border}`,background:tab===t?T.accentLight:T.card,color:tab===t?T.accent:T.sub,fontSize:11,fontWeight:tab===t?700:400,cursor:"pointer",textAlign:"center" }}>
              {{info:"Info",fotos:`Fotos (${fotos.length})`,notas:`Notas (${notas.length})`,partes:`Partes (${partes.length})`}[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div style={{ padding:"14px 16px" }}>

        {isPendFacturar&&(
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:T.orange+"18",border:`1px solid ${T.orange}`,borderRadius:8,marginBottom:12 }}>
            <span style={{ flex:1,fontSize:13,color:T.orange,fontWeight:500 }}>Mantenimiento cerrado — recuerda enviar la factura al cliente</span>
            {partes.length>0&&<button onClick={()=>generarPartePDF(partes[0],averiaMock,cl,empresa,"PARTE DE MANTENIMIENTO")} style={{ padding:"6px 12px",borderRadius:7,border:`1px solid ${T.border}`,background:T.accentLight,color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer" }}>Ver PDF</button>}
          </div>
        )}

        {tab==="info"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ padding:"10px 12px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,fontSize:13,color:T.text,lineHeight:1.6 }}>{mant.descripcion}</div>
            {isAdmin&&mant.notas&&<div style={{ padding:"10px 12px",background:T.orange+"18",borderRadius:8,border:`1px solid ${T.orange}`,fontSize:12,color:T.orange }}>{mant.notas}</div>}
            {partes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return (
              <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:T.text }}>{p.tecnico_nombre} {h>0?`· ${h.toFixed(1)}h`:""}</div>
                  <div style={{ fontSize:16,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</div>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ fontSize:11,color:p.firma_url||p.firma_base64?T.green:T.red }}>{p.firma_url||p.firma_base64?"Firmado":"Sin firma"}</span>
                  <Btn ch="PDF" onClick={()=>generarPartePDF(p,averiaMock,cl,empresa,"PARTE DE MANTENIMIENTO")} v="b" sm/>
                </div>
              </div>
            ); })}
            {isAdmin&&(
              <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:12 }}>
                <button onClick={async()=>{ if(!window.confirm("¿Eliminar este mantenimiento?")) return; await supabase.from("mantenimientos").delete().eq("id",mant.id); refresh?.();onClose(); }} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid #fecaca",background:T.redLight,color:T.red,fontSize:12,fontWeight:600,cursor:"pointer" }}>Eliminar</button>
              </div>
            )}
          </div>
        )}

        {tab==="fotos"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8 }}>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display:"none" }} onChange={subirFoto}/>
              <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={subirFoto}/>
              <span style={{ fontSize:12,color:T.sub }}>{fotos.length}/4 fotos</span>
              {fotos.length<4 && (
                <div style={{ display:"flex", gap:6 }}>
                  <Btn ch="Cámara" onClick={()=>fileRef.current.click()} v="g" sm/>
                  <Btn ch="Galería" onClick={()=>galleryRef.current.click()} v="s" sm/>
                </div>
              )}
            </div>
            {fotos.length===0?<div onClick={()=>fileRef.current.click()} style={{ border:`2px dashed ${T.border}`,borderRadius:10,padding:30,textAlign:"center",cursor:"pointer",color:T.muted }}>Pulsa para añadir fotos</div>
            :<div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8 }}>{fotos.map(f=><div key={f.id} style={{ position:"relative",aspectRatio:"4/3",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}` }}><img src={getFotoUrl(f.storage_path)} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/><button onClick={async()=>{ await supabase.storage.from("fotos").remove([f.storage_path]); await supabase.from("fotos_averias").delete().eq("id",f.id); loadFotos(); }} style={{ position:"absolute",top:6,right:6,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer" }}>×</button></div>)}</div>}
          </div>
        )}

        {tab==="notas"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
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

        {tab==="partes"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <div style={{ display:"flex",justifyContent:"flex-end" }}><Btn ch="+ Nuevo parte" onClick={()=>setShowParte(true)}/></div>
            {partes.length===0&&<div style={{ textAlign:"center",padding:"30px",color:T.muted,fontSize:13,background:T.surface,borderRadius:10,border:`1px solid ${T.border}` }}>Sin partes de trabajo.</div>}
            {partes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return (
              <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"12px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <div><div style={{ fontSize:13,fontWeight:600,color:T.text }}>{p.tecnico_nombre}</div><div style={{ fontSize:11,color:T.muted }}>{p.fecha} {h>0?`· ${h.toFixed(1)}h`:""}</div></div>
                  <div style={{ fontSize:20,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</div>
                </div>
                <div style={{ display:"flex",justifyContent:"flex-end" }}>
                  <Btn ch="PDF" onClick={()=>generarPartePDF(p,averiaMock,cl,empresa,"PARTE DE MANTENIMIENTO")} v="b" sm/>
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>

      {showParte&&<ParteModal averia={averiaMock} cliente={cl} user={user} empresa={empresa} profiles={data.profiles} materiales={data.materiales||[]} refresh={()=>{loadPartes();refresh?.();}} onClose={()=>setShowParte(false)} titulo="PARTE DE MANTENIMIENTO"/>}
    </Modal>
  );
}
