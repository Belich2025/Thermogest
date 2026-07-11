import React, { useState, useRef } from "react";
import { useTheme }                  from "../../ThemeContext.jsx";
import { mkInp }                     from "../../utils/styles.js";
import { supabase }                 from "../../supabase.js";
import { useIsMobile }              from "../../hooks/useIsMobile.js";
import { todayStr }                 from "../../utils/dates.js";
import { generarLineasPresupuesto } from "../../ai.js";
import { generarPresupuestoPDF }    from "../../pdf/presupuestoPDF.js";
import Modal                        from "../ui/Modal.jsx";
import Field                        from "../ui/Field.jsx";
import Btn                          from "../ui/Btn.jsx";
import FotosEntidad                  from "./FotosEntidad.jsx";
import BtnContacto                  from "./BtnContacto.jsx";

export default function PresupuestoDetalle({ pres:initP, data, user, refresh, empresa, onClose }) {
  const { T, PS, BS } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const [p, setP]           = useState(initP);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    descripcion: initP.descripcion||"",
    notas: initP.notas||"",
    lineas: initP.lineas||[{concepto:"",cantidad:1,precio:0}],
    aplicar_iva: initP.aplicar_iva!==false,
  });
  const [showProgram, setShowProgram]     = useState(false);
  const [progDate, setProgDate]           = useState(todayStr());
  const [progNota, setProgNota]           = useState("");
  const [saving, setSaving]               = useState(false);
  const [showAveriaPanel, setShowAveriaPanel] = useState(false);
  const [averiaQuery, setAveriaQuery]     = useState("");
  const voiceActiveRef = useRef(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [matDrop,setMatDrop]=useState(-1);
  const [genLineasState, setGenLineasState] = useState(null);

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

  const MicBtn=({onResult})=>voiceActive
    ?<button type="button" onClick={()=>window.__stopVoice&&window.__stopVoice()} style={{ padding:"0 10px",height:34,borderRadius:8,border:"none",background:"#dc2626",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap",animation:"pulse-red 1.5s infinite" }}>⏹ Parar IA</button>
    :<button type="button" onClick={()=>startVoice(onResult)} style={{ width:34,height:34,borderRadius:8,border:"none",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700 }}>✦ IA</button>;

  const cl = (data.clientes||[]).find(c=>c.id===p.cliente_id);
  const s  = PS[p.status];

  const updEdit = (k,v) => setEditForm(prev=>({...prev,[k]:v}));
  function updLinea(i,k,v){ setEditForm(prev=>{ const ls=[...prev.lineas]; ls[i]={...ls[i],[k]:v}; return {...prev,lineas:ls}; }); }
  function addLinea(){ updEdit("lineas",[...editForm.lineas,{concepto:"",cantidad:1,precio:0}]); }
  function removeLinea(i){ if(editForm.lineas.length===1) return; updEdit("lineas",editForm.lineas.filter((_,j)=>j!==i)); }

  const editBase  = editForm.lineas.reduce((s,l)=>s+(parseFloat(l.cantidad||0)*parseFloat(l.precio||0)),0);
  const editIva   = editForm.aplicar_iva ? editBase*0.21 : 0;
  const editTotal = editBase+editIva;

  const ESTADOS_FLOW = ["nuevo","enviado","aceptado","rechazado"];

  async function updStatus(newStatus) {
    const {error}=await supabase.from("presupuestos").update({status:newStatus}).eq("id",p.id);
    if(!error){ setP(prev=>({...prev,status:newStatus})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function guardarEdicion() {
    const now = new Date().toISOString();
    const {error}=await supabase.from("presupuestos").update({
      descripcion:editForm.descripcion, notas:editForm.notas||null,
      lineas:editForm.lineas, aplicar_iva:editForm.aplicar_iva, importe:editTotal,
      updated_at:now,
    }).eq("id",p.id);
    if(!error){ setP(prev=>({...prev,...editForm,importe:editTotal,updated_at:now})); setEditMode(false); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function guardarYPDF() {
    const now = new Date().toISOString();
    const {error}=await supabase.from("presupuestos").update({
      descripcion:editForm.descripcion, notas:editForm.notas||null,
      lineas:editForm.lineas, aplicar_iva:editForm.aplicar_iva, importe:editTotal,
      updated_at:now,
    }).eq("id",p.id);
    if(!error){
      const updated={...p,...editForm,importe:editTotal,updated_at:now};
      setP(prev=>({...prev,...editForm,importe:editTotal,updated_at:now}));
      setEditMode(false);
      refresh?.();
      generarPresupuestoPDF(updated,cl,empresa);
    } else alert("Error: "+error.message);
  }

  async function vincularAveria(averia_id) {
    const {error}=await supabase.from("presupuestos").update({averia_id}).eq("id",p.id);
    if(!error){ setP(prev=>({...prev,averia_id})); setAveriaQuery(""); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function desvincularAveria() {
    const {error}=await supabase.from("presupuestos").update({averia_id:null}).eq("id",p.id);
    if(!error){ setP(prev=>({...prev,averia_id:null})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function generarLineasConIA() {
    if(genLineasState) return;
    setGenLineasState("escuchando");
    startVoice(async (transcript) => {
      setGenLineasState("procesando");
      try {
        const nuevas = await generarLineasPresupuesto(transcript, data.materiales||[]);
        if(!nuevas||!nuevas.length){ alert("No se generaron líneas. Inténtalo de nuevo."); setGenLineasState(null); return; }
        const lineasMapeadas = nuevas.map(l=>({ concepto:l.concepto||"", cantidad:l.cantidad||1, precio:l.precioUnitario||0, enCatalogo:l.enCatalogo }));
        const actuales = editForm.lineas.filter(l=>l.concepto.trim());
        updEdit("lineas",[...actuales,...lineasMapeadas]);
      } catch(e){ alert("Error en IA: "+e.message); }
      setGenLineasState(null);
    });
  }

  async function crearInstalacion() {
    const {error}=await supabase.from("instalaciones_obras").insert([{
      cliente_id:p.cliente_id, presupuesto_id:p.id, descripcion:p.descripcion,
      direccion:cl?.direccion||"", fecha_inicio:todayStr(), status:"pendiente"
    }]);
    if(!error){ refresh?.(); alert("Instalación creada. Encuéntrala en la sección Instalaciones."); }
    else alert("Error: "+error.message);
  }

  async function programarTrabajo() {
    if(!progDate) return; setSaving(true);
    const {error}=await supabase.from("eventos").insert([{
      tipo:"instalacion", titulo:p.descripcion?.slice(0,60)||"Trabajo",
      cliente_id:p.cliente_id, direccion:cl?.direccion||"",
      fecha:progDate, notas:progNota, color:T.teal,
      presupuesto_id:p.id,
    }]);
    if(!error){ refresh?.(); setShowProgram(false); setSaving(false); }
    else { alert("Error: "+error.message); setSaving(false); }
  }

  return (
    <Modal onClose={onClose} w={720}>
      {/* ── BARRA FIJA ── */}
      <div style={{ position:"sticky",top:0,zIndex:10,background:T.card,borderBottom:`1px solid ${T.border}` }}>

        {/* Fila 1: Cliente + info */}
        <div style={{ padding:"12px 14px 8px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}>
            <span style={{ fontSize:11,color:T.muted,fontWeight:600 }}>PRESUPUESTO {p.num_presupuesto?"#"+p.num_presupuesto:"#"+p.id}</span>
            {p.from_form&&<span style={{ fontSize:10,padding:"1px 7px",borderRadius:20,background:T.purpleLight,color:T.purple,fontWeight:600 }}>Web</span>}
          </div>
          <div style={{ fontSize:16,fontWeight:700,color:T.text,marginBottom:2 }}>{cl?.nombre||"Cliente"}</div>
          <div style={{ fontSize:12,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {p.descripcion?.slice(0,60)}
          </div>
        </div>

        {/* Fila 2: Botones acción */}
        <div style={{ padding:"0 14px 10px",display:"flex",gap:6,alignItems:"center" }}>
          {cl?.telefono&&<a href={`tel:${cl.telefono}`} style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
          {cl?.telefono&&<a href={`https://wa.me/34${(cl.telefono||"").replace(/\s/g,"")}`} target="_blank" rel="noreferrer" style={{ width:36,height:36,borderRadius:9,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
          <BtnContacto cliente={cl}/>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ width:36,height:36,borderRadius:9,background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
        </div>

        {/* Fila 3: Workflow estados */}
        <div style={{ padding:"0 14px 10px",display:"flex",alignItems:"center",gap:4,overflowX:"auto" }}>
          {ESTADOS_FLOW.map((k,i)=>{
            const activo=p.status===k; const sc=PS[k];
            return (
              <React.Fragment key={k}>
                <button onClick={()=>updStatus(k)}
                  style={{ padding:"5px 10px",borderRadius:20,border:`1.5px solid ${activo?sc.color:T.border}`,background:activo?sc.color:T.card,color:activo?"#fff":T.muted,fontSize:11,fontWeight:activo?700:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0 }}>
                  {activo&&"● "}{sc.label}
                </button>
                {i<ESTADOS_FLOW.length-1&&<span style={{ color:T.border,fontSize:12,flexShrink:0 }}>›</span>}
              </React.Fragment>
            );
          })}
        </div>

        {/* Fila 4: Acciones rápidas */}
        <div style={{ padding:"0 14px 10px",borderTop:`1px solid ${T.border}`,paddingTop:8,display:"flex",gap:6,flexWrap:"wrap" }}>
          <Btn ch={editMode?"Cancelar":"Editar presupuesto"} onClick={()=>setEditMode(p=>!p)} v="g" sm/>
          <Btn ch={p.averia_id?"● Avería vinculada":"Vincular avería"} onClick={()=>{ setShowAveriaPanel(v=>!v); setShowProgram(false); }} v={p.averia_id?"s":"g"} sm/>
          {p.status==="aceptado"&&<Btn ch="Crear instalación" onClick={crearInstalacion} v="s" sm/>}
          {p.status==="aceptado"&&<Btn ch="Programar" onClick={()=>{ setShowProgram(v=>!v); setShowAveriaPanel(false); }} v="b" sm/>}
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div style={{ padding:"14px 16px",display:"flex",flexDirection:"column",gap:14 }}>

        {/* Total destacado — solo si ya tiene importe */}
        {p.importe>0&&(
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:T.accentLight,border:"2px solid #bfdbfe",borderRadius:10 }}>
            <div>
              <div style={{ fontSize:11,color:T.accent,fontWeight:600,textTransform:"uppercase" }}>Total presupuesto</div>
              {p.aplicar_iva!==false&&<div style={{ fontSize:11,color:T.muted }}>IVA 21% incluido</div>}
            </div>
            <div style={{ fontSize:28,fontWeight:800,color:T.accent,fontFamily:"'Sora',sans-serif" }}>{(p.importe||0).toFixed(2)} €</div>
          </div>
        )}

        {/* Modo edición */}
        {editMode&&(
          <div style={{ background:T.surface,borderRadius:12,padding:"14px",border:`2px solid ${T.accent}`,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.accent }}>Editando presupuesto</div>
            <Field label="Descripción *"><div style={{ display:"flex",gap:6,alignItems:"flex-start" }}><textarea value={editForm.descripcion} onChange={e=>updEdit("descripcion",e.target.value)} style={{...inp(),minHeight:60,resize:"vertical",flex:1}}/><MicBtn onResult={t=>setEditForm(p=>({...p,descripcion:p.descripcion?p.descripcion+" "+t:t}))}/></div></Field>
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}><span style={{ fontSize:11,fontWeight:600,color:T.sub }}>Líneas (uso interno)</span><Btn ch="+ Línea" onClick={addLinea} v="g" sm/></div>
              <button type="button" onClick={generarLineasConIA} disabled={!!genLineasState}
                style={{ width:"100%",padding:"10px 14px",borderRadius:10,border:"none",background:genLineasState?T.muted:"linear-gradient(135deg,#3b82f6 0%,#7c3aed 100%)",color:"#fff",fontSize:13,fontWeight:700,cursor:genLineasState?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8,opacity:genLineasState?0.85:1 }}>
                {genLineasState==="escuchando"
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:"aiSpin 1s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 🎤 Escuchando... describe el trabajo</>
                  : genLineasState==="procesando"
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:"aiSpin 0.8s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Generando líneas...</>
                  : <>✦ Generar líneas con IA</>}
              </button>
              <div style={{ background:T.card,borderRadius:10,border:`1px solid ${T.border}`,overflow:"visible" }}>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 60px 75px 65px 24px",gap:6,padding:"6px 10px",borderBottom:`1px solid ${T.border}`,borderRadius:"10px 10px 0 0",overflow:"hidden" }}>
                  {["Concepto","Cant.","€/ud","Total",""].map((h,i)=><span key={i} style={{ fontSize:9,fontWeight:600,color:T.muted,textTransform:"uppercase" }}>{h}</span>)}
                </div>
                {editForm.lineas.map((l,i)=>{
                  const pendiente = l.enCatalogo===false && !parseFloat(l.precio||0);
                  return (
                  <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 60px 75px 65px 24px",gap:6,padding:"5px 10px",borderBottom:i<editForm.lineas.length-1?`1px solid ${T.border}`:"none",alignItems:"center",borderLeft:pendiente?"3px solid #ef4444":"3px solid transparent",background:pendiente?"#fff5f5":"transparent" }}>
                    <div style={{position:"relative",overflow:"visible"}}>
                      <input value={l.concepto} onChange={e=>{ updLinea(i,"concepto",e.target.value); setMatDrop(e.target.value.length>=2?i:-1); }} onBlur={()=>setTimeout(()=>setMatDrop(-1),150)} placeholder="Concepto..." style={inp({padding:"4px 7px",fontSize:12})}/>
                      {matDrop===i&&(()=>{ const q=l.concepto.toLowerCase(); const sugs=(data.materiales||[]).filter(c=>c.nombre.toLowerCase().includes(q)).slice(0,6); return sugs.length?(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:9999,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",maxHeight:200,overflowY:"auto"}}>{sugs.map(c=>(<button key={c.id} type="button" onMouseDown={()=>{ updLinea(i,"concepto",c.nombre); updLinea(i,"precio",c.precio); updLinea(i,"enCatalogo",true); setMatDrop(-1); }} style={{width:"100%",textAlign:"left",padding:"6px 10px",background:"none",border:"none",borderBottom:`1px solid ${T.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"'DM Sans',sans-serif"}}><span style={{fontSize:12,color:T.text}}>{c.nombre}</span><span style={{fontSize:11,color:T.accent,fontWeight:600}}>{Number(c.precio).toFixed(2)}€</span></button>))}</div>):null; })()}
                    </div>
                    <input type="number" value={l.cantidad} onChange={e=>updLinea(i,"cantidad",e.target.value)} style={inp({padding:"4px 7px",fontSize:12})}/>
                    <input type="number" value={l.precio} onChange={e=>{ updLinea(i,"precio",e.target.value); if(parseFloat(e.target.value)>0) updLinea(i,"enCatalogo",true); }} placeholder="0.00" style={inp({padding:"4px 7px",fontSize:12,background:pendiente?"#fee2e2":""})}/>
                    <span style={{ fontSize:11,fontWeight:600,color:pendiente?"#ef4444":T.accent,textAlign:"center" }}>{pendiente?"⚠️":l.cantidad&&l.precio?(parseFloat(l.cantidad)*parseFloat(l.precio)).toFixed(2)+"€":"—"}</span>
                    <button onClick={()=>removeLinea(i)} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:15 }}>×</button>
                  </div>
                  );
                })}
              </div>
            </div>
            <div onClick={()=>updEdit("aplicar_iva",!editForm.aplicar_iva)} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:T.card,borderRadius:8,border:`1px solid ${editForm.aplicar_iva?T.green:T.border}`,cursor:"pointer" }}>
              <div style={{ width:36,height:20,borderRadius:10,background:editForm.aplicar_iva?T.green:T.muted,position:"relative",flexShrink:0 }}><span style={{ position:"absolute",top:2,left:editForm.aplicar_iva?18:2,width:16,height:16,borderRadius:"50%",background:T.card }}/></div>
              <span style={{ fontSize:12,fontWeight:600,color:editForm.aplicar_iva?T.green:T.text }}>{editForm.aplicar_iva?"IVA 21% activado":"Sin IVA"}</span>
              <span style={{ marginLeft:"auto",fontSize:18,fontWeight:700,color:T.accent,fontFamily:"'Sora',sans-serif" }}>{editTotal.toFixed(2)} €</span>
            </div>
            <Field label="Notas"><textarea value={editForm.notas} onChange={e=>updEdit("notas",e.target.value)} style={{...inp(),minHeight:45,resize:"vertical"}} placeholder="Condiciones, validez..."/></Field>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <Btn ch="Guardar cambios" onClick={guardarEdicion} v="g"/>
              {editTotal>0&&<Btn ch="Guardar y descargar PDF" onClick={guardarYPDF}/>}
            </div>
          </div>
        )}

        {/* Descripción */}
        {!editMode&&(
          <div style={{ padding:"10px 12px",background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,fontSize:13,color:T.text,lineHeight:1.6 }}>{p.descripcion}</div>
        )}

        {/* Fotos */}
        {!editMode&&(
          <div>
            <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",marginBottom:8 }}>Fotos</div>
            <FotosEntidad entidad="presupuesto" entidadId={p.id}/>
          </div>
        )}

        {/* Avería vinculada — siempre visible en vista de lectura */}
        {!editMode&&p.averia_id&&(()=>{
          const av=(data.averias||[]).find(a=>a.id===p.averia_id);
          const cAv=av?(data.clientes||[]).find(c=>c.id===av.cliente_id):null;
          if(!av) return null;
          const avS=BS[av.status];
          return (
            <div style={{ padding:"10px 12px",background:T.redLight,border:`1.5px solid #fecaca`,borderRadius:8,display:"flex",flexDirection:"column",gap:4 }}>
              <div style={{ fontSize:10,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:"0.5px" }}>Avería vinculada</div>
              <div style={{ fontSize:13,fontWeight:600,color:T.text,lineHeight:1.4 }}>{av.descripcion}</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                {cAv&&<span style={{ fontSize:11,color:T.muted }}>{cAv.nombre}</span>}
                <span style={{ fontSize:10,padding:"2px 8px",borderRadius:20,background:(avS?.color||T.muted)+"20",color:avS?.color||T.muted,fontWeight:600 }}>{avS?.label||av.status}</span>
                <span style={{ fontSize:10,color:T.muted }}>#{av.id}</span>
              </div>
            </div>
          );
        })()}

        {/* Líneas internas */}
        {!editMode&&(p.lineas||[]).filter(l=>l.concepto).length>0&&(
          <div style={{ background:T.surface,borderRadius:10,padding:"12px",border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",marginBottom:8 }}>Líneas de trabajo (interno)</div>
            {(p.lineas||[]).filter(l=>l.concepto).map((l,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:i<(p.lineas||[]).filter(x=>x.concepto).length-1?`1px solid ${T.border}`:"none",fontSize:13,color:T.text }}>
                <span>{l.concepto} {l.cantidad>1?`(×${l.cantidad})`:""}</span>
                <span style={{ fontWeight:600,color:T.accent }}>{(parseFloat(l.cantidad||0)*parseFloat(l.precio||0)).toFixed(2)} €</span>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {!editMode&&p.notas&&(
          <div style={{ padding:"10px 12px",background:T.orange+"18",borderRadius:8,border:`1px solid ${T.orange}`,fontSize:12,color:T.orange }}>{p.notas}</div>
        )}

        {/* Ver / Descargar PDF — solo cuando hay importe */}
        {!editMode&&p.importe>0&&(
          <div style={{ display:"flex",justifyContent:"flex-end" }}>
            <Btn ch="Ver / Descargar PDF" onClick={()=>generarPresupuestoPDF(p,cl,empresa)} v="s"/>
          </div>
        )}

        {/* Avería vinculada */}
        {showAveriaPanel&&(()=>{
          const averiaVinculada = p.averia_id ? (data.averias||[]).find(a=>a.id===p.averia_id) : null;
          const clAv = averiaVinculada ? (data.clientes||[]).find(c=>c.id===averiaVinculada.cliente_id) : null;
          const q = averiaQuery.toLowerCase().trim();
          const averiasFiltradas = q.length>0
            ? (data.averias||[]).filter(a=>{
                const c2=(data.clientes||[]).find(x=>x.id===a.cliente_id);
                return (a.descripcion||"").toLowerCase().includes(q)||(c2?.nombre||"").toLowerCase().includes(q);
              }).slice(0,8)
            : [];
          return (
            <div style={{ background:T.surface,borderRadius:10,padding:"14px",border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:12,fontWeight:700,color:T.sub,marginBottom:10 }}>Avería vinculada</div>
              {averiaVinculada ? (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <div style={{ background:T.card,border:`1.5px solid ${T.red}`,borderRadius:8,padding:"10px 12px" }}>
                    <div style={{ fontSize:12,fontWeight:700,color:T.red,marginBottom:2 }}>{clAv?.nombre||"Sin cliente"}</div>
                    <div style={{ fontSize:13,color:T.text,marginBottom:6,lineHeight:1.4 }}>{averiaVinculada.descripcion}</div>
                    <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                      <span style={{ fontSize:10,padding:"2px 8px",borderRadius:20,background:T.redLight,color:T.red,fontWeight:600 }}>{averiaVinculada.status}</span>
                      <span style={{ fontSize:11,color:T.muted }}>{averiaVinculada.created_at?.slice(0,10)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6,justifyContent:"flex-end" }}>
                    <button onClick={desvincularAveria} style={{ padding:"5px 12px",borderRadius:7,border:`1.5px solid ${T.border}`,background:T.card,color:T.muted,fontSize:12,fontWeight:600,cursor:"pointer" }}>Desvincular</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <input value={averiaQuery} onChange={e=>setAveriaQuery(e.target.value)}
                    placeholder="Buscar avería por cliente o descripción..."
                    style={{...inp({fontSize:13})}}
                    autoComplete="off"/>
                  {averiasFiltradas.length>0&&(
                    <div style={{ border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card }}>
                      {averiasFiltradas.map(a=>{
                        const c2=(data.clientes||[]).find(x=>x.id===a.cliente_id);
                        return (
                          <div key={a.id} onClick={()=>vincularAveria(a.id)}
                            style={{ padding:"8px 12px",borderBottom:`1px solid ${T.border}`,cursor:"pointer" }}
                            onMouseEnter={e=>e.currentTarget.style.background=T.accentLight}
                            onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                            <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{c2?.nombre||"Sin cliente"}</div>
                            <div style={{ fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{a.descripcion}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.length>0&&averiasFiltradas.length===0&&(
                    <div style={{ fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0" }}>Sin resultados</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Programar trabajo */}
        {showProgram&&(
          <div style={{ background:T.surface,borderRadius:10,padding:"14px",border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,fontWeight:600,color:T.sub,marginBottom:10 }}>Programar trabajo en calendario</div>
            <div style={{ display:"flex",gap:10,marginBottom:10 }}>
              <input type="date" value={progDate} onChange={e=>setProgDate(e.target.value)} style={{...inp(),flex:1}}/>
            </div>
            <textarea value={progNota} onChange={e=>setProgNota(e.target.value)} placeholder="Notas..." style={{...inp(),minHeight:45,resize:"vertical",marginBottom:10}}/>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <Btn ch="Cancelar" onClick={()=>setShowProgram(false)} v="g"/>
              <Btn ch={saving?"Programando...":"Programar"} onClick={programarTrabajo} disabled={saving||!progDate}/>
            </div>
          </div>
        )}

        {/* Eliminar */}
        <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:12 }}>
          <button onClick={async()=>{ if(!window.confirm("¿Eliminar este presupuesto?")) return; const {error}=await supabase.from("presupuestos").delete().eq("id",p.id); if(!error){refresh?.();onClose();}else alert("Error: "+error.message); }} style={{ padding:"7px 14px",borderRadius:8,border:"1.5px solid #fecaca",background:T.redLight,color:T.red,fontSize:12,fontWeight:600,cursor:"pointer" }}>
            Eliminar presupuesto
          </button>
        </div>
      </div>
    </Modal>
  );
}
