import React, { useState, useEffect, useRef } from "react";
import { useTheme }         from "../../ThemeContext.jsx";
import { mkInp }            from "../../utils/styles.js";
import { useIsMobile }      from "../../hooks/useIsMobile.js";
import { openMaps }         from "../../utils/links.js";
import { generarPresupuestoPDF } from "../../pdf/presupuestoPDF.js";
import { generarPartePDF }       from "../../pdf/partePDF.js";
import { generarResumenObraPDF } from "../../pdf/obraPDF.js";
import { supabase }         from "../../supabase.js";
import Modal                from "../ui/Modal.jsx";
import Btn                  from "../ui/Btn.jsx";
import Field                from "../ui/Field.jsx";
import BtnContacto          from "./BtnContacto.jsx";
import ParteModal           from "./ParteModal.jsx";
import NuevoEquipoModal     from "./NuevoEquipoModal.jsx";
import FotosEntidad          from "./FotosEntidad.jsx";

export default function ObraDetalle({ obra:initO, data, user, techs, empresa, refresh, onClose }) {
  const { T, OB_ESTADOS } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const [obra, setObra] = useState(initO);
  const [tab, setTab]   = useState("info");
  const [partes, setPartes]   = useState([]);
  const [notas, setNotas]     = useState([]);
  const [nota, setNota]       = useState("");
  const [showParte, setShowParte] = useState(false);
  const [showEquipo, setShowEquipo] = useState(false);
  const [showProgram, setShowProgram] = useState(false);
  const [progDate, setProgDate]       = useState("");
  const [progNota, setProgNota]       = useState("");
  const [savingProg, setSavingProg]   = useState(false);
  const notaRef = useRef();

  const cl    = (data.clientes||[]).find(c=>c.id===obra.cliente_id);
  const presu = (data.presupuestos||[]).find(p=>p.id===obra.presupuesto_id);

  const SO_OB   = { pendiente:0, en_curso:1, completada:2, pendiente_facturar:3, facturada:10 };
  const OB_FLOW = ["pendiente","en_curso","completada","pendiente_facturar"];
  const OB_LABELS = { pendiente:"Pendiente", en_curso:"En curso", completada:"Completada", pendiente_facturar:"Pend. facturar", facturada:"Facturada" };
  const isPendFacturar = obra.status === "pendiente_facturar";
  const isFacturada    = obra.status === "facturada";

  useEffect(()=>{ loadPartes(); loadNotas(); },[obra.id]);

  async function loadPartes() { const {data:d}=await supabase.from("partes").select("*").eq("instalacion_id",obra.id).order("created_at",{ascending:false}); setPartes(d||[]); }
  async function loadNotas()  { const {data:d}=await supabase.from("notas_averias").select("*").eq("instalacion_id",obra.id).order("created_at",{ascending:true}); setNotas(d||[]); }

  async function updStatus(s) {
    const upd = { status: s==="completada" ? "pendiente_facturar" : s };
    const {error}=await supabase.from("instalaciones_obras").update(upd).eq("id",obra.id);
    if(!error){ setObra(p=>({...p,...upd})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function addNota() {
    if(!nota.trim()) return;
    const {error} = await supabase.from("notas_averias").insert([{instalacion_id:obra.id,autor_id:user.id,autor_nombre:user.nombre,texto:nota.trim()}]);
    if(error){ alert("Error al guardar la nota: "+error.message); return; }
    setNota(""); loadNotas();
  }

  async function programarObra() {
    if(!progDate) return; setSavingProg(true);
    const {error}=await supabase.from("eventos").insert([{
      tipo:"instalacion", titulo:obra.descripcion?.slice(0,60)||"Instalación",
      cliente_id:obra.cliente_id, direccion:obra.direccion||cl?.direccion||"",
      fecha:progDate, notas:progNota, color:"#16a34a",
      instalacion_id:obra.id,
    }]);
    if(!error){ refresh?.(); setShowProgram(false); setSavingProg(false); }
    else { alert("Error: "+error.message); setSavingProg(false); }
  }

  return (
    <Modal onClose={onClose} w={720}>
      {/* ── BARRA OPERATIVA FIJA ── */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.card,borderBottom:`1px solid ${T.border}` }}>

        {/* Fila 1: cliente + descripción */}
        <div style={{ padding:"12px 14px 8px" }}>
          <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:2 }}>{cl?.nombre||"Cliente"}</div>
          <div style={{ fontSize:12,color:T.muted }}>{obra.descripcion?.slice(0,80)}{obra.direccion?` · ${obra.direccion}`:""}</div>
        </div>

        {/* Fila 2: botones de acción */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6,alignItems:"center" }}>
          {cl?.telefono&&<a href={`tel:${cl.telefono}`} style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
          {cl?.telefono&&<a href={`https://wa.me/34${cl.telefono.replace(/\s/g,"")}`} target="_blank" rel="noreferrer" style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
          {obra.direccion&&<button onClick={()=>openMaps(obra.direccion)} style={{ width:36,height:36,borderRadius:9,background:T.accentLight,border:"1.5px solid "+T.accent+"40",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></button>}
          <BtnContacto cliente={cl}/>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ width:36,height:36,borderRadius:9,background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
        </div>

        {/* Fila 3: workflow de estados */}
        <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4,overflowX:"auto" }}>
          {OB_FLOW.map((k,i)=>{
            const activo = obra.status===k;
            const pasado = SO_OB[obra.status]>SO_OB[k];
            const sc = OB_ESTADOS[k];
            return (
              <React.Fragment key={k}>
                <button onClick={()=>!isFacturada&&updStatus(k)} disabled={isFacturada}
                  style={{ padding:"5px 10px",borderRadius:20,border:`1.5px solid ${activo?sc.color:pasado?sc.color+"60":T.border}`,background:activo?sc.color:pasado?sc.color+"15":T.card,color:activo?"#fff":pasado?sc.color:T.muted,fontSize:11,fontWeight:activo?700:500,cursor:isFacturada?"default":"pointer",whiteSpace:"nowrap",flexShrink:0 }}>
                  {activo&&"● "}{OB_LABELS[k]}
                </button>
                {i<OB_FLOW.length-1&&<span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span>}
              </React.Fragment>
            );
          })}
          {isPendFacturar&&<><span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span><button onClick={async()=>{ const {error}=await supabase.from("instalaciones_obras").update({status:"facturada"}).eq("id",obra.id); if(!error){setObra(p=>({...p,status:"facturada"}));refresh?.();} }} style={{ padding:"5px 10px",borderRadius:20,border:`1px solid ${T.orange}`,background:T.orange+"22",color:T.orange,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0 }}>Facturar</button></>}
          {isFacturada&&<><span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span><span style={{ padding:"5px 10px",borderRadius:20,background:T.surface,color:T.muted,fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>Facturada</span></>}
        </div>

        {/* Fila 4: técnico + parte */}
        <div style={{ padding:"0 14px 8px",borderTop:`1px solid ${T.border}`,paddingTop:8,display:"flex",gap:6,alignItems:"center" }}>
          {isAdmin&&(
            <select defaultValue={obra.tecnico_id||""} onChange={async e=>{ const {error}=await supabase.from("instalaciones_obras").update({tecnico_id:e.target.value||null}).eq("id",obra.id); if(!error){setObra(p=>({...p,tecnico_id:e.target.value||null}));refresh?.();} }} style={{...inp({padding:"6px 8px",fontSize:12,width:"auto",borderRadius:8,flex:1,maxWidth:160})}}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
          <button onClick={()=>{ setTab("partes"); setShowParte(true); }} style={{ padding:"7px 14px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>+ Parte</button>
          <Btn ch="Programar" onClick={()=>setShowProgram(p=>!p)} v="b" sm/>
        </div>

        {showProgram&&(
          <div style={{ padding:"10px 14px 12px",borderTop:`1px solid ${T.border}`,background:T.bg }}>
            <div style={{ fontSize:12,fontWeight:600,color:T.sub,marginBottom:8 }}>Añadir al calendario</div>
            <div style={{ display:"flex",gap:10,alignItems:"flex-end" }}>
              <Field label="Fecha"><input type="date" value={progDate} onChange={e=>setProgDate(e.target.value)} style={inp({padding:"6px 8px",fontSize:12})}/></Field>
              <Field label="Nota"><input value={progNota} onChange={e=>setProgNota(e.target.value)} style={inp({padding:"6px 8px",fontSize:12})} placeholder="Opcional"/></Field>
              <Btn ch={savingProg?"Guardando...":"Programar"} onClick={programarObra} disabled={savingProg||!progDate}/>
            </div>
          </div>
        )}

        {/* Fila 5: tabs */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6 }}>
          {[{k:"info",l:"Info"},{k:"fotos",l:"Fotos"},{k:"notas",l:`Notas (${notas.length})`},{k:"partes",l:`Partes (${partes.length})`}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{ flex:1,padding:"8px 4px",borderRadius:8,border:`1px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentLight:T.card,color:tab===t.k?T.accent:T.sub,fontSize:12,fontWeight:tab===t.k?700:400,cursor:"pointer",textAlign:"center",fontFamily:"'DM Sans',sans-serif" }}>{t.l}</button>
          ))}
        </div>

      </div>

      {/* ── CONTENIDO ── */}
      <div style={{ padding:"14px 16px",overflowY:"auto",maxHeight:"60vh" }}>

        {isPendFacturar&&(
          <div style={{ background:T.orange+"18",border:`1px solid ${T.orange}`,borderRadius:10,marginBottom:14,overflow:"hidden" }}>
            <div style={{ padding:"9px 14px",background:T.orange,display:"flex",alignItems:"center",gap:8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Datos para facturación</span>
            </div>
            {presu ? (
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontSize:11,fontWeight:600,color:T.orange,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6 }}>Presupuesto vinculado</div>
                <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:4 }}>#{presu.id}{presu.descripcion?` — ${presu.descripcion}`:""}</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:16,fontSize:13,color:T.sub,marginBottom:12,padding:"8px 10px",background:T.card,borderRadius:7,border:`1px solid ${T.orange}44` }}>
                  <span>Base: <strong style={{ color:T.text }}>{(presu.importe||0).toFixed(2)} €</strong></span>
                  {presu.aplicar_iva!==false&&<span>IVA (21%): <strong style={{ color:T.text }}>{((presu.importe||0)*0.21).toFixed(2)} €</strong></span>}
                  <span style={{ fontWeight:700,color:T.orange }}>TOTAL: {(presu.aplicar_iva===false?presu.importe||0:(presu.importe||0)*1.21).toFixed(2)} €</span>
                </div>
                <Btn ch="Ver / Descargar PDF del presupuesto" onClick={()=>generarPresupuestoPDF(presu,cl,empresa)} v="s"/>
              </div>
            ) : partes.length>0 ? (
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontSize:11,fontWeight:600,color:T.orange,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8 }}>Partes de trabajo ({partes.length})</div>
                <div style={{ display:"flex",flexDirection:"column",gap:5,marginBottom:10 }}>
                  {partes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return (
                    <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:T.card,borderRadius:7,border:`1px solid ${T.orange}44` }}>
                      <div style={{ flex:1,fontSize:12 }}>
                        <span style={{ fontWeight:600,color:T.text }}>{p.tecnico_nombre}</span>
                        <span style={{ color:T.muted,marginLeft:8 }}>{p.fecha?.split("-").reverse().join("/")}{h>0?` · ${h.toFixed(1)}h`:""}</span>
                      </div>
                      <span style={{ fontSize:14,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</span>
                      <Btn ch="PDF" onClick={()=>generarPartePDF(p,{id:"obra_"+obra.id,descripcion:obra.descripcion,equipo:"Instalación",direccion:obra.direccion},cl,empresa)} v="b" sm/>
                    </div>
                  ); })}
                </div>
                {(()=>{ const base=partes.reduce((s,p)=>s+(parseFloat(p.importe_total)||0),0); const iva=base*0.21; return (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:16,fontSize:13,color:T.sub,marginBottom:12,padding:"8px 10px",background:T.card,borderRadius:7,border:`1px solid ${T.orange}44` }}>
                    <span>Base: <strong style={{ color:T.text }}>{base.toFixed(2)} €</strong></span>
                    <span>IVA (21%): <strong style={{ color:T.text }}>{iva.toFixed(2)} €</strong></span>
                    <span style={{ fontWeight:700,color:T.orange }}>TOTAL: {(base+iva).toFixed(2)} €</span>
                  </div>
                ); })()}
                <Btn ch="Descargar PDF resumen de partes" onClick={()=>generarResumenObraPDF(partes,obra,cl,empresa)}/>
              </div>
            ) : (
              <div style={{ padding:"12px 14px",fontSize:13,color:T.orange }}>Sin presupuesto ni partes registrados. Añade un parte para poder facturar.</div>
            )}
          </div>
        )}

        {tab==="info"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ padding:"10px 12px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,fontSize:13,color:T.text,lineHeight:1.6 }}>{obra.descripcion}</div>
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10 }}>
              <div style={{ background:T.surface,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",marginBottom:6 }}>Fechas</div>
                <div style={{ fontSize:13,color:T.text }}><span style={{ fontWeight:600 }}>Inicio:</span> {obra.fecha_inicio||"—"}</div>
                {obra.fecha_fin&&<div style={{ fontSize:13,color:T.text,marginTop:3 }}><span style={{ fontWeight:600 }}>Fin previsto:</span> {obra.fecha_fin}</div>}
              </div>
              {presu&&<div style={{ background:T.accentLight,borderRadius:8,padding:"10px 12px",border:"1px solid #bfdbfe" }}>
                <div style={{ fontSize:10,fontWeight:600,color:T.accent,textTransform:"uppercase",marginBottom:4 }}>Presupuesto #{presu.id}</div>
                <div style={{ fontSize:12,color:T.text }}>{presu.descripcion}</div>
                <div style={{ fontSize:15,fontWeight:700,color:T.accent,marginTop:4 }}>{(presu.importe||0).toFixed(2)} €</div>
              </div>}
            </div>
            <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:12 }}>
              <Btn ch="+ Registrar equipo instalado" onClick={()=>setShowEquipo(true)} v="s" sm/>
              <p style={{ fontSize:11,color:T.muted,marginTop:6 }}>El equipo quedará vinculado al historial del cliente.</p>
            </div>
            {partes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return (
              <div key={p.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:T.text }}>{p.tecnico_nombre} {h>0?`· ${h.toFixed(1)}h`:""}</div>
                  <div style={{ fontSize:16,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</div>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ fontSize:11,color:p.firma_url?T.green:T.red }}>{p.firma_url?"Firmado":"Sin firma"}</span>
                  <Btn ch="PDF" onClick={()=>generarPartePDF(p,{id:"obra_"+obra.id,descripcion:obra.descripcion,equipo:"Instalación",direccion:obra.direccion},cl,empresa)} v="b" sm/>
                </div>
              </div>
            ); })}
            {isAdmin&&<div style={{ borderTop:`1px solid ${T.border}`,paddingTop:12 }}><button onClick={async()=>{ if(!window.confirm("¿Eliminar esta instalación?")) return; await supabase.from("instalaciones_obras").delete().eq("id",obra.id); refresh?.();onClose(); }} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid #fecaca",background:T.redLight,color:T.red,fontSize:12,fontWeight:600,cursor:"pointer" }}>Eliminar instalación</button></div>}
          </div>
        )}

        {tab==="fotos"&&<FotosEntidad entidad="instalacion_obra" entidadId={obra.id}/>}

        {tab==="notas"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
              <textarea ref={notaRef} value={nota} onChange={e=>setNota(e.target.value)} placeholder="Añadir nota técnica..." style={{...inp(),flex:1,minHeight:60,resize:"none"}} onKeyDown={e=>{ if(e.key==="Enter"&&e.ctrlKey) addNota(); }}/>
              <Btn ch="OK" onClick={addNota} disabled={!nota.trim()}/>
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
            {partes.length===0&&<div style={{ textAlign:"center",padding:"40px 20px",color:T.muted,fontSize:14,background:T.surface,borderRadius:10,border:`1px solid ${T.border}` }}>Sin partes de trabajo.</div>}
            {partes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return <div key={p.id} style={{ background:T.card,borderRadius:10,padding:"14px",border:`1px solid ${T.border}` }}><div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}><div><div style={{ fontSize:13,fontWeight:600 }}>{p.tecnico_nombre}</div><div style={{ fontSize:11,color:T.muted }}>{p.fecha?.split("-").reverse().join("/")} {h>0?`· ${h.toFixed(1)}h`:""}</div></div><div style={{ textAlign:"right" }}><div style={{ fontSize:20,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €</div></div></div><div style={{ display:"flex",justifyContent:"flex-end" }}><Btn ch="Ver PDF" onClick={()=>generarPartePDF(p,{id:"obra_"+obra.id,descripcion:obra.descripcion,equipo:"Instalación",direccion:obra.direccion},cl,empresa)} v="b" sm/></div></div>; })}
          </div>
        )}

      </div>

      {showParte&&<ParteModal averia={{id:"obra_"+obra.id,descripcion:obra.descripcion,equipo:"Instalación",direccion:obra.direccion}} cliente={cl} user={user} empresa={empresa} profiles={data.profiles} materiales={data.materiales||[]} refresh={()=>{loadPartes();refresh?.();}} onClose={()=>setShowParte(false)}/>}
      {showEquipo&&<NuevoEquipoModal clienteId={obra.cliente_id} onSave={()=>refresh?.()} onClose={()=>setShowEquipo(false)}/>}
    </Modal>
  );
}
