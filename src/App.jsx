import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";
import { requestNotificationPermission } from "./firebase.js";
import { detectarAveria, mejorarDescripcion, detectarMateriales, asistirPresupuesto, generarParteCompleto, generarPresupuestoCompleto, generarLineasPresupuesto } from "./ai.js";
import { todayStr, addDays, urgInfo } from "./utils/dates.js";
import { openMaps, sendEmail } from "./utils/links.js";
import { getTextColor } from "./utils/color.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { startVoiceSimple } from "./hooks/useVoice.js";
import { SC_LIGHT, mkBS, mkMS, mkPS, mkOB_ESTADOS, BS_ACTIVOS, BS_ALL, SO_B, MS_ACTIVOS, SO_M, PS_ORDER, MT_TIPOS, MT } from "./constants/status.js";
import { EQ, RITE_CHECKLIST, TIPO_EQUIPO_OPTIONS } from "./constants/equipment.js";
import { generarResumenObraPDF } from "./pdf/obraPDF.js";
import { generarPresupuestoPDF } from "./pdf/presupuestoPDF.js";
import { generarPartePDF } from "./pdf/partePDF.js";
import { sendPushNotification } from "./push.js";
import { T_LIGHT, T_DARK, useTheme } from "./ThemeContext.jsx";
import { mkInp } from "./utils/styles.js";
import Badge from "./components/ui/Badge.jsx";
import BadgeProg from "./components/ui/BadgeProg.jsx";
import Field from "./components/ui/Field.jsx";
import MHead from "./components/ui/MHead.jsx";
import Modal from "./components/ui/Modal.jsx";
import Ava from "./components/ui/Ava.jsx";
import Btn from "./components/ui/Btn.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import Login from "./components/views/Login.jsx";
import Sidebar from "./components/views/Sidebar.jsx";
import CatalogoMaterialesView from "./components/views/CatalogoMaterialesView.jsx";
import EmpresaConfig from "./components/views/EmpresaConfig.jsx";
import UsuariosView from "./components/views/UsuariosView.jsx";
import InstalacionesObrasView from "./components/views/InstalacionesObrasView.jsx";
import FichajesView from "./components/views/FichajesView.jsx";
import FormularioView from "./components/views/FormularioView.jsx";
import DashboardView from "./components/views/DashboardView.jsx";
import CalendarView from "./components/views/CalendarView.jsx";
import ParteModal from "./components/shared/ParteModal.jsx";
import BtnContacto from "./components/shared/BtnContacto.jsx";
import ProgramarVisitaModal from "./components/shared/ProgramarVisitaModal.jsx";
import MantenimientoDetalle from "./components/shared/MantenimientoDetalle.jsx";
import NuevoEquipoModal from "./components/shared/NuevoEquipoModal.jsx";
import ObraDetalle from "./components/shared/ObraDetalle.jsx";
import ClienteBuscadorField from "./components/shared/ClienteBuscadorField.jsx";
import NuevaObraModal from "./components/shared/NuevaObraModal.jsx";
import BotonNomina from "./components/shared/BotonNomina.jsx";
import ImportarExcelModal from "./components/shared/ImportarExcelModal.jsx";
import EquipoDetalle from "./components/shared/EquipoDetalle.jsx";
import AveriaDetalle from "./components/shared/AveriaDetalle.jsx";
import PresupuestoDetalle from "./components/shared/PresupuestoDetalle.jsx";
import ClienteDetalle from "./components/shared/ClienteDetalle.jsx";
import ClienteSelector from "./components/shared/ClienteSelector.jsx";
import NuevaAveriaModal from "./components/shared/NuevaAveriaModal.jsx";
import NuevoAvisoModal from "./components/shared/NuevoAvisoModal.jsx";
import NuevoPresupuestoModal from "./components/shared/NuevoPresupuestoModal.jsx";
import PresupuestosList from "./components/views/PresupuestosList.jsx";
import ClientesList from "./components/views/ClientesList.jsx";
import AvisosView from "./components/views/AvisosView.jsx";


/* ─── THEME ──────────────────────────────────────────────────────────────── */
let T = T_LIGHT;
let _setTooltip = ()=>{};
const AIBtn = ({ch,onClick,disabled})=>(
  <button type="button" onClick={onClick} disabled={disabled}
    style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 13px",borderRadius:8,border:"none",cursor:disabled?"not-allowed":"pointer",background:"linear-gradient(135deg,#3b82f6 0%,#7c3aed 100%)",color:"#fff",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",opacity:disabled?0.72:1,flexShrink:0,whiteSpace:"nowrap",transition:"opacity 0.15s"}}>
    {disabled
      ?<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:"aiSpin 0.8s linear infinite",flexShrink:0}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Procesando...</>
      :ch}
  </button>
);


/* ══════════════════════════════════════════════════════════════════════════
   SECCIÓN AVERÍAS — Flujo completo
   ══════════════════════════════════════════════════════════════════════════ */

let BS = mkBS(SC_LIGHT);
let MS = mkMS(SC_LIGHT);
let PS = mkPS(SC_LIGHT);

let UCOL = { urgente:T.red, hoy:T.orange, semana:"#f59e0b", prox:T.teal, ok:T.muted, none:T.muted };
/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const inp = (x={}) => mkInp(T)(x);

function TooltipOnboarding({ id, titulo, descripcion, onClose }) {
  return (
    <div style={{
      position:"fixed", bottom: 80, right: 24, zIndex:1200,
      background:T.accent, color:"#fff", borderRadius:14,
      padding:"16px 20px", maxWidth:320, boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
      animation:"slideUp 0.3s ease"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700, fontSize:14, marginBottom:6}}>{titulo}</div>
          <div style={{fontSize:12, opacity:0.9, lineHeight:1.5}}>{descripcion}</div>
        </div>
        <button onClick={onClose}
          style={{background:"none", border:"none", color:"#fff", cursor:"pointer",
            fontSize:18, opacity:0.8, padding:0, flexShrink:0}}>✕</button>
      </div>
      <button onClick={onClose}
        style={{marginTop:12, padding:"6px 16px", borderRadius:8,
          background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)",
          color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600, width:"100%"}}>
        Entendido
      </button>
    </div>
  );
}

/* ─── AVISOS: AvisosView extraído a components/views/AvisosView.jsx ─── */

/* ─── PRESUPUESTOS: PresupuestosList extraído a components/views/PresupuestosList.jsx ─── */

/* ─── CLIENTES: ClientesList extraído a components/views/ClientesList.jsx ─── */

/* ─── MANTENIMIENTO ──────────────────────────────────────────────────────── */
function MantenimientoView({ data, user, refresh, empresa={} }) {
  const isMobile=useIsMobile(); const [tab,setTab]=useState("pendientes"); const [showInst,setShowInst]=useState(null); const [showRev,setShowRev]=useState(null); const [expanded,setExpanded]=useState(null);
  const [showNuevoEq, setShowNuevoEq] = useState(null);
  const isAdmin=user.role==="admin"; const insts=data.instalaciones||[]; const revs=data.revisiones||[]; const cls=data.clientes||[]; const [revSel,setRevSel]=useState(null);
  const cl=id=>cls.find(c=>c.id===id);
  const eqs = (data.equipos||[]).filter(eq => eq.instalacion_id);
  const pendientes = [];
  eqs.forEach(eq => {
    const inst = insts.find(i => i.id === eq.instalacion_id);
    if(!inst) return;
    const c = cls.find(cl => cl.id === eq.cliente_id);
    MT_TIPOS.forEach(tipo => {
      if(!eq["activa_"+tipo]) return;
      const info = urgInfo(eq["proxima_"+tipo]||null);
      if(info.level !== "ok" && info.level !== "none")
        pendientes.push({ eq, inst, cl: c, tipo, info });
    });
  });
  pendientes.sort((a,b) => {
    const o = { urgente:0, hoy:1, semana:2, prox:3, ok:4, none:5 };
    return (o[a.info.level]??5) - (o[b.info.level]??5);
  });
  const urg = { urgente:0, hoy:0, semana:0, prox:0 };
  pendientes.forEach(p => {
    if(urg[p.info.level]!==undefined) urg[p.info.level]++;
  });

  async function delInst(id){ await supabase.from("instalaciones").delete().eq("id",id); refresh?.(); setShowInst(null); }
  async function saveRev(rev){ const { error }=await supabase.from("revisiones").insert([rev]); if(!error){ const dias=MT[rev.tipo]?.freq||90; const proxima=addDays(todayStr(),dias); if(rev.equipo_id){ await supabase.from("equipos").update({ ["proxima_"+rev.tipo]:proxima }).eq("id",rev.equipo_id); } else { await supabase.from("instalaciones").update({ ["proxima_"+rev.tipo]:proxima }).eq("id",rev.instalacion_id); } refresh?.(); } setShowRev(null); }

  const TabBtn=({id,label,n})=><button onClick={()=>setTab(id)} style={{ padding:"9px 16px",border:"none",background:"none",color:tab===id?T.accent:T.sub,fontSize:12,fontWeight:tab===id?600:400,cursor:"pointer",borderBottom:tab===id?`2px solid ${T.accent}`:"2px solid transparent",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>{label}{n>0&&<span style={{ background:tab===id?T.accent:T.border,color:tab===id?"#fff":T.muted,borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700 }}>{n}</span>}</button>;

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div><h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 3px",fontFamily:"'Sora',sans-serif" }}>Contratos</h1><p style={{ color:T.muted,fontSize:12,margin:0 }}>Contratos periódicos · Revisiones</p></div>
        <button onClick={()=>_setTooltip("contratos")} title="Ayuda de Contratos" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        {isAdmin&&<Btn ch="+ Nuevo contrato" onClick={()=>setShowInst({clienteId:cls[0]?.id})}/>}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:20 }}>
        {[{label:"Vencidas",val:urg.urgente,color:T.red},{label:"Esta semana",val:urg.hoy+urg.semana,color:T.orange},{label:"Este mes",val:urg.prox,color:T.teal},{label:"Instalaciones",val:insts.length,color:T.accent}].map(s=><div key={s.label} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden" }}><div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:s.color,borderRadius:"12px 12px 0 0" }}/><div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8 }}>{s.label}</div><div style={{ fontSize:28,fontWeight:700,color:s.color,fontFamily:"'Sora',sans-serif" }}>{s.val}</div></div>)}
      </div>
      <div style={{ borderBottom:`1px solid ${T.border}`,marginBottom:18,display:"flex",overflowX:"auto" }}>
        <TabBtn id="pendientes" label="Pendientes" n={pendientes.length}/>
        <TabBtn id="contratos" label="Contratos" n={insts.length}/>
        <TabBtn id="historial" label="Historial" n={revs.length}/>
      </div>
      {tab==="pendientes"&&<div style={{ display:"flex",flexDirection:"column",gap:16 }}>
        {pendientes.length===0&&<div style={{ textAlign:"center",padding:"60px 20px",background:T.card,borderRadius:12,border:`1px solid ${T.border}` }}><div style={{ width:56,height:56,borderRadius:14,background:T.greenLight,border:"1px solid #bbf7d0",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:20,fontWeight:800,color:T.green }}></div><div style={{ fontSize:15,fontWeight:600,color:T.text,marginBottom:6 }}>Todo al día</div><div style={{ fontSize:13,color:T.muted }}>Sin revisiones pendientes.</div></div>}
        {Array.from(new Set(pendientes.map(p=>p.cl?.id))).map(clienteId=>{ const clientePends=pendientes.filter(p=>p.cl?.id===clienteId); const clienteNombre=clientePends[0]?.cl?.nombre||"Sin cliente"; return (
          <div key={clienteId}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:8,paddingLeft:4,display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:28,height:28,borderRadius:8,background:T.accentLight,border:`1px solid #bfdbfe`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:T.accent,flexShrink:0 }}>
                {clienteNombre[0]?.toUpperCase()}
              </div>
              {clienteNombre}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {clientePends.map((p,i)=>{ const mt=MT[p.tipo]; const uc=UCOL[p.info.level]; return <div key={i} style={{ background:T.card,border:`1px solid ${T.border}`,borderLeft:`4px solid ${uc}`,borderRadius:11,padding:"13px 15px",display:"flex",alignItems:"center",gap:14 }}><div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:4 }}>{p.eq.nombre}</div><div style={{ fontSize:11,color:T.muted }}>{p.inst.nombre}</div><div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}><span style={{ fontSize:11,padding:"1px 8px",borderRadius:20,background:mt.color+"12",border:`1px solid ${mt.color}25`,color:mt.color,fontWeight:600 }}>{mt.label}</span><span style={{ fontSize:10,color:T.border }}>·</span><span style={{ fontSize:11,fontWeight:600,color:uc }}>{p.info.label}</span></div></div><Btn ch="Iniciar" onClick={()=>setShowRev({inst:p.inst,eq:p.eq,cliente:p.cl,tipo:p.tipo})} v="p" sm/></div>; })}
            </div>
          </div>
        );})}
      </div>}
      {tab==="contratos"&&<div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {cls.filter(c=>insts.some(i=>i.cliente_id===c.id)).length===0&&<div style={{ textAlign:"center",padding:"60px 20px",color:T.muted,fontSize:14 }}>No hay contratos. Pulsa "+ Nuevo contrato" para añadir uno.</div>}
        {cls.filter(c=>{ const cInsts=insts.filter(i=>i.cliente_id===c.id); return cInsts.length>0; }).map(c=>{ const cInsts=insts.filter(i=>i.cliente_id===c.id); const exp=expanded===c.id; return <div key={c.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:11,overflow:"hidden" }}>
          <div onClick={()=>setExpanded(exp?null:c.id)} style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{ flex:1 }}><div style={{ fontSize:14,fontWeight:600,color:T.text }}>{c.nombre}</div><div style={{ fontSize:12,color:T.muted,marginTop:2 }}>{cInsts.length} instalación{cInsts.length!==1?"es":""}</div></div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              {isAdmin&&<Btn ch="+ Inst." onClick={e=>{e.stopPropagation();setShowInst({clienteId:c.id});}} v="g" sm/>}
              {isAdmin&&<button onClick={async e=>{ e.stopPropagation(); if(!window.confirm(`¿Eliminar el contrato de ${c.nombre}? Se eliminarán todas sus instalaciones y revisiones. El cliente seguirá en la base de datos.`)) return; for(const inst of cInsts){ await supabase.from("revisiones").delete().eq("instalacion_id",inst.id); await supabase.from("instalaciones").delete().eq("id",inst.id); } refresh?.(); }} style={{ padding:"4px 10px",borderRadius:7,border:"1.5px solid #fecaca",background:"#fff5f5",color:T.red,fontSize:11,fontWeight:600,cursor:"pointer" }}>Eliminar</button>}
              <span style={{ color:T.muted,fontSize:18,display:"inline-block",transform:exp?"rotate(90deg)":"none",transition:"transform 0.2s" }}>›</span>
            </div>
          </div>
          {exp&&<div style={{ borderTop:`1px solid ${T.border}` }}>
            {cInsts.map(inst => {
              const eqsInst = (data.equipos||[]).filter(eq => eq.instalacion_id === inst.id);
              return (
                <div key={inst.id} style={{borderBottom:`1px solid ${T.border}`}}>
                  {/* Cabecera del contrato */}
                  <div style={{padding:"10px 16px 10px 28px",display:"flex",
                    justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:13,fontWeight:700,color:T.text}}>{inst.nombre}</span>
                      {inst.activo===false && (
                        <span style={{fontSize:11,color:T.muted,marginLeft:8,
                          padding:"1px 8px",borderRadius:20,background:T.surface,
                          border:`1px solid ${T.border}`}}>Inactivo</span>
                      )}
                      <span style={{fontSize:11,color:T.muted,marginLeft:8}}>
                        {eqsInst.length} equipo{eqsInst.length!==1?"s":""}
                      </span>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setShowInst({clienteId:c.id, inst})}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,
                          border:`1px solid ${T.border}`,background:T.card,
                          color:T.text,cursor:"pointer"}}>
                        Editar
                      </button>
                      <button onClick={()=>setShowNuevoEq({ clienteId: c.id, instalacionId: inst.id })}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,
                          border:"none",background:T.accent,
                          color:"#fff",cursor:"pointer",fontWeight:600}}>
                        + Equipo
                      </button>
                    </div>
                  </div>

                  {/* Lista de equipos */}
                  {eqsInst.length===0 ? (
                    <div style={{padding:"10px 28px 14px",fontSize:12,color:T.muted}}>
                      Sin equipos registrados
                    </div>
                  ) : (
                    <div style={{padding:"0 16px 12px 28px",display:"flex",flexDirection:"column",gap:6}}>
                      {eqsInst.map(eq=>{
                        const frecuencias = ["mensual","trimestral","semestral","anual"]
                          .filter(t=>eq["activa_"+t]);
                        const tipoLabel = TIPO_EQUIPO_OPTIONS.find(t=>t.value===eq.tipo)?.label||eq.tipo||"";
                        return (
                          <div key={eq.id} style={{background:T.surface,borderRadius:8,
                            padding:"8px 12px",border:`1px solid ${T.border}`,
                            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:T.text}}>{eq.nombre}</div>
                              <div style={{fontSize:11,color:T.muted,marginTop:1}}>
                                {[tipoLabel,eq.marca,eq.modelo].filter(Boolean).join(" · ")}
                              </div>
                              {frecuencias.length>0 && (
                                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                                  {frecuencias.map(t=>{
                                    const mt = MT[t];
                                    const info = urgInfo(eq["proxima_"+t]||null);
                                    const uc = UCOL[info.level]||T.muted;
                                    return (
                                      <span key={t} style={{fontSize:10,padding:"2px 8px",borderRadius:20,
                                        background:mt.color+"15",border:`1px solid ${mt.color}40`,
                                        color:mt.color,fontWeight:600}}>
                                        {mt.label}
                                        {eq["proxima_"+t] && (
                                          <span style={{color:uc,marginLeft:4}}>· {info.label}</span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <button onClick={()=>setShowRev({inst, eq, cliente:c, tipo: frecuencias[0]||"anual"})}
                              style={{fontSize:11,padding:"4px 10px",borderRadius:6,
                                border:`1px solid ${T.accent}40`,background:T.accentLight,
                                color:T.accent,cursor:"pointer",fontWeight:600,marginLeft:8,flexShrink:0}}>
                              Iniciar revisión
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>}
        </div>; })}
      </div>}
      {tab==="historial"&&<div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {revs.length===0&&<div style={{ textAlign:"center",padding:"60px",color:T.muted,fontSize:13 }}>Sin revisiones completadas.</div>}
        {[...revs].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||"")).map(rev=>{ const mt=MT[rev.tipo]||{label:rev.tipo,color:T.muted}; const total=Object.keys(rev.checks||{}).length; const done=Object.values(rev.checks||{}).filter(Boolean).length; return <div key={rev.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:11,padding:"13px 15px",display:"flex",alignItems:"center",gap:14 }}><div style={{ flex:1,minWidth:0 }}><div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}><span style={{ fontSize:13,fontWeight:600,color:T.text }}>{rev.instalacion_nombre}</span><span style={{ fontSize:9,padding:"1px 8px",borderRadius:20,background:mt.color+"12",border:`1px solid ${mt.color}25`,color:mt.color,fontWeight:700 }}>{mt.label}</span><span style={{ fontSize:10,color:T.muted }}>Parte #{rev.num_parte}</span></div><div style={{ fontSize:12,color:T.muted }}>{rev.cliente_nombre} · {rev.fecha} · {rev.tecnico_nombre} · {done}/{total} ítems</div></div>{rev.firma_url&&<span style={{ fontSize:11,color:T.green,fontWeight:600 }}>Firmado</span>}<Btn ch="Ver detalle" onClick={()=>setRevSel(rev)} v="g" sm/></div>; })}
      </div>}
      {showInst&&<InstModal initClienteId={showInst.clienteId} inst={showInst.inst} data={data} refresh={refresh} clientes={cls} onClose={()=>setShowInst(null)}/>}
      {showRev&&<RevisionModal inst={showRev.inst} eq={showRev.eq} cliente={showRev.cliente} tipo={showRev.tipo} user={user} onSave={saveRev} onClose={()=>setShowRev(null)}/>}
      {revSel&&<RevisionDetalle rev={revSel} insts={insts} cls={cls} empresa={empresa} onClose={()=>setRevSel(null)}/>}
      {showNuevoEq && (
        <NuevoEquipoModal
          clienteId={showNuevoEq.clienteId}
          instalacionId={showNuevoEq.instalacionId}
          onSave={()=>{ refresh?.(); setShowNuevoEq(null); }}
          onClose={()=>setShowNuevoEq(null)}
        />
      )}
    </div>
  );
}

function RevisionDetalle({ rev, insts, cls, empresa={}, onClose }) {
  const mt=MT[rev.tipo]||{label:rev.tipo,color:T.teal};
  const inst=insts.find(i=>i.id===rev.instalacion_id);
  const cliente=cls.find(c=>c.id===rev.cliente_id);
  const items=(inst?.["items_"+rev.tipo])||[];
  const done=Object.values(rev.checks||{}).filter(Boolean).length;
  const total=Object.keys(rev.checks||{}).length;
  const [generando,setGenerando]=useState(false);

  async function generarPDF(yEnviar=false) {
    setGenerando(true);
    try {
      const JsPDF = await (async ()=>{
        if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
        return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); });
      })();
      const doc = new JsPDF({unit:"mm",format:"a4"});
      const rgb=rev.tipo==="mensual"?[13,148,136]:rev.tipo==="trimestral"?[217,119,6]:rev.tipo==="semestral"?[124,58,237]:[220,38,38];
      const [W,D,G,L]=[[255,255,255],[15,23,42],[100,116,139],[248,250,252]];
      // Header
      doc.setFillColor(...rgb); doc.rect(0,0,210,38,"F");
      doc.setTextColor(...W); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(empresa.nombre||"BLCH",12,13);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      if(empresa.cif) doc.text("CIF: "+empresa.cif,12,20);
      if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
      doc.setFontSize(11); doc.setFont("helvetica","bold");
      doc.text("PARTE MANTENIMIENTO "+mt.label.toUpperCase(),198,12,{align:"right"});
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text("N.º: "+(rev.num_parte||"—"),198,20,{align:"right"});
      doc.text("Fecha: "+rev.fecha,198,28,{align:"right"});
      // Client + installation
      let y=44;
      doc.setFillColor(...L); doc.rect(10,y,190,22,"F");
      doc.setTextColor(...D); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("CLIENTE",14,y+7); doc.text("INSTALACIÓN",105,y+7);
      doc.setFont("helvetica","normal"); doc.setFontSize(10);
      doc.text(rev.cliente_nombre||"—",14,y+15);
      doc.text(rev.instalacion_nombre||"—",105,y+15);
      doc.setFontSize(8); doc.setTextColor(...G);
      if(cliente?.telefono) doc.text(cliente.telefono,14,y+20);
      if(inst?.tipo) doc.text(inst.tipo+(inst.ubicacion?" · "+inst.ubicacion:""),105,y+20);
      y+=28;
      doc.setTextColor(...D); doc.setFontSize(9); doc.setFont("helvetica","normal");
      doc.text("Técnico: "+(rev.tecnico_nombre||"—"),14,y); y+=10;
      // Progress
      doc.setFillColor(...rgb); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text(`CHECKLIST — ${done}/${total} verificados`,14,y+5); y+=10;
      // Items
      items.forEach((item,i)=>{
        const checked=rev.checks?.[i]===true;
        if(i%2===0){ doc.setFillColor(...L); doc.rect(10,y-1,190,7,"F"); }
        if(checked){ doc.setFillColor(...rgb); } else { doc.setFillColor(200,200,200); }
        doc.rect(14,y,4,4,"F");
        doc.setTextColor(checked?D[0]:160,checked?D[1]:160,checked?D[2]:160);
        doc.setFont("helvetica","normal"); doc.setFontSize(9);
        doc.text(item,22,y+3.5); y+=8;
        if(y>255){ doc.addPage(); y=20; }
      });
      y+=4;
      if(rev.observaciones){
        const oLines=doc.splitTextToSize(rev.observaciones,178);
        doc.setFillColor(254,252,232); doc.rect(10,y,190,6+oLines.length*5.5,"F");
        doc.setTextColor(146,100,4); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("OBSERVACIONES:",14,y+5);
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(oLines,14,y+11); y+=12+oLines.length*5.5;
      }
      if(rev.firma_url){ doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G); doc.text("FIRMA:",14,y); y+=4; try{doc.addImage(rev.firma_url,"PNG",14,y,65,26);}catch(e){} }
      // Footer
      const ph=doc.internal.pageSize.height;
      doc.setFillColor(...D); doc.rect(0,ph-12,210,12,"F");
      doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
      doc.text((empresa.nombre||"")+(empresa.cif?" · CIF:"+empresa.cif:""),14,ph-5);
      if(empresa.cuenta_iban) doc.text("IBAN: "+empresa.cuenta_iban,105,ph-5,{align:"center"});
      doc.text((empresa.telefono||"")+(empresa.email?" · "+empresa.email:""),198,ph-5,{align:"right"});
      // Open PDF
      const blobUrl=doc.output("bloburl");
      window.open(blobUrl,"_blank");
      // Send email if requested
      if(yEnviar&&cliente?.email){
        setTimeout(()=>{
          const body=["PARTE DE MANTENIMIENTO "+mt.label.toUpperCase(),"","N.º Parte: "+(rev.num_parte||"—"),"Fecha: "+rev.fecha,"Instalación: "+rev.instalacion_nombre,"Cliente: "+rev.cliente_nombre,"Técnico: "+rev.tecnico_nombre,"","Checklist: "+done+"/"+total+" ítems verificados",rev.observaciones?"Observaciones: "+rev.observaciones:"","","El PDF del parte se adjunta a este correo."].join("\n");
          sendEmail({to:cliente.email,subject:`Parte mantenimiento ${mt.label} #${rev.num_parte} — ${rev.instalacion_nombre}`,body});
        },600);
      }
    } catch(e) { alert("Error al generar PDF. Permite ventanas emergentes en tu navegador."); }
    setGenerando(false);
  }

  return (<Modal onClose={onClose} w={620}>
    <MHead title={`Parte #${rev.num_parte} — Mantenimiento ${mt.label}`} sub={`${rev.instalacion_nombre} · ${rev.cliente_nombre}`} onClose={onClose}/>
    <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
      <div style={{ background:T.surface,borderRadius:10,padding:"14px",border:`1px solid ${T.border}` }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
          {[["Técnico",rev.tecnico_nombre],["Fecha",rev.fecha],["Resultado",`${done}/${total} ítems`]].map(([l,v])=><div key={l}><div style={{ fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",marginBottom:4 }}>{l}</div><div style={{ fontSize:13,fontWeight:600,color:T.text }}>{v}</div></div>)}
        </div>
      </div>
      <div style={{ maxHeight:"35vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:3 }}>
        {items.map((item,i)=>{
          const checked=rev.checks?.[i]===true;
          return <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:7,background:checked?mt.color+"08":T.surface,border:`1px solid ${checked?mt.color+"30":T.border}` }}>
            <div style={{ width:18,height:18,borderRadius:4,flexShrink:0,background:checked?mt.color:T.border,display:"flex",alignItems:"center",justifyContent:"center" }}>{checked&&<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</div>
            <span style={{ fontSize:12,color:checked?T.text:T.muted,flex:1 }}>{item}</span>
          </div>;
        })}
      </div>
      {rev.observaciones&&<div style={{ background:T.orange+"18",border:`1px solid ${T.orange}`,borderRadius:10,padding:"12px 14px" }}><div style={{ fontSize:11,fontWeight:600,color:T.orange,marginBottom:4 }}>Observaciones</div><div style={{ fontSize:13,color:T.orange }}>{rev.observaciones}</div></div>}
      {rev.firma_url&&<div><div style={{ fontSize:11,fontWeight:600,color:T.sub,marginBottom:6 }}>Firma del cliente</div><img src={rev.firma_url} alt="firma" style={{ maxWidth:260,borderRadius:8,border:`1px solid ${T.border}` }}/></div>}
      <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
        <Btn ch={generando?"Generando...":"Ver PDF"} onClick={()=>generarPDF(false)} v="b" disabled={generando}/>
        {cliente?.email&&<Btn ch="PDF + Enviar email" onClick={()=>generarPDF(true)} v="s" disabled={generando}/>}
      </div>
    </div>
  </Modal>);
}

function InstModal({ initClienteId, inst, clientes, data, refresh, onClose }) {
  const isMobile = useIsMobile();
  const isEdit = !!inst;
  const [clienteId, setClienteId] = useState(initClienteId || inst?.cliente_id || null);
  const [form, setForm] = useState({
    nombre: inst?.nombre || "",
    notas: inst?.notas || "",
    activo: inst?.activo !== false,
  });
  const [equipos, setEquipos] = useState([]);
  const [showAddEquipo, setShowAddEquipo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInstId, setSavedInstId] = useState(inst?.id || null);

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const saveContrato = async () => {
    if(!clienteId){ alert("Selecciona un cliente"); return; }
    if(!form.nombre.trim()){ alert("El nombre del contrato es obligatorio"); return; }
    setSaving(true);
    const clean = { nombre: form.nombre, notas: form.notas||null, activo: form.activo };
    if(isEdit){
      await supabase.from("instalaciones").update(clean).eq("id", inst.id);
      setSaving(false);
      refresh?.(); onClose();
    } else {
      const { data: newInst, error } = await supabase.from("instalaciones")
        .insert([{ ...clean, cliente_id: clienteId }]).select().single();
      setSaving(false);
      if(error){ alert("Error: "+error.message); return; }
      setSavedInstId(newInst.id);
      refresh?.();
    }
  };

  const eliminar = async () => {
    if(!window.confirm("¿Eliminar este contrato?")) return;
    await supabase.from("equipos").update({ instalacion_id: null }).eq("instalacion_id", inst.id);
    await supabase.from("revisiones").delete().eq("instalacion_id", inst.id);
    await supabase.from("instalaciones").delete().eq("id", inst.id);
    refresh?.(); onClose();
  };

  return (
    <Modal onClose={onClose} w={620}>
      <MHead title={isEdit ? "Editar contrato" : "Nuevo contrato"} onClose={onClose}/>
      <div style={{padding: isMobile?"14px":"20px 24px", display:"flex",
        flexDirection:"column", gap:14, maxHeight:"85vh", overflowY:"auto"}}>

        {/* Cliente */}
        <ClienteSelector clientes={clientes} value={clienteId} onChange={setClienteId}
          onNewCliente={async(f)=>{
            const {data:nc,error} = await supabase.from("clientes").insert([f]).select().single();
            if(!error&&nc) setClienteId(nc.id);
            else alert("Error: "+(error?.message||""));
          }}/>

        {/* Nombre y notas */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOMBRE DEL CONTRATO *</div>
          <input value={form.nombre} onChange={e=>upd("nombre",e.target.value)}
            placeholder="Ej: Mantenimiento anual calderas..." style={inp()}/>
        </div>
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOTAS</div>
          <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)}
            placeholder="Observaciones, condiciones especiales..."
            style={{...inp(), minHeight:60}}/>
        </div>

        {/* Toggle activo */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 14px",background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>
          <span style={{fontSize:13,fontWeight:600,color:T.text}}>Contrato activo</span>
          <button onClick={()=>upd("activo",!form.activo)}
            style={{width:44,height:24,borderRadius:12,position:"relative",border:"none",
              background: form.activo ? T.accent : T.border,cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{position:"absolute",top:2,
              left: form.activo ? 22 : 2,width:20,height:20,
              borderRadius:"50%",background:"#fff",transition:"all 0.2s"}}/>
          </button>
        </div>

        {/* Botón guardar contrato */}
        {!savedInstId && (
          <button onClick={saveContrato} disabled={saving}
            style={{padding:"11px",borderRadius:10,border:"none",
              background: saving ? T.border : T.accent,
              color:"#fff",cursor:saving?"not-allowed":"pointer",
              fontSize:14,fontWeight:700}}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear contrato"}
          </button>
        )}

        {/* Sección equipos — aparece tras crear el contrato o en edición */}
        {(savedInstId) && (
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1}}>
                EQUIPOS ({equipos.length})
              </div>
              <button onClick={()=>setShowAddEquipo(true)}
                style={{padding:"7px 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",
                  fontSize:12,fontWeight:600}}>
                + Añadir equipo
              </button>
            </div>

            {equipos.length===0 && !showAddEquipo && (
              <div onClick={()=>setShowAddEquipo(true)}
                style={{textAlign:"center",padding:"24px",color:T.muted,fontSize:13,
                  background:T.surface,borderRadius:10,
                  border:`2px dashed ${T.border}`,cursor:"pointer"}}>
                Sin equipos. Pulsa para añadir el primero.
              </div>
            )}

            {equipos.map((eq,i)=>(
              <div key={i} style={{background:T.surface,borderRadius:10,padding:"10px 14px",
                border:`1px solid ${T.border}`,marginBottom:8,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:T.text}}>{eq.nombre}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                    {[TIPO_EQUIPO_OPTIONS.find(t=>t.value===eq.tipo)?.label,
                      eq.marca, eq.modelo].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{fontSize:11,color:T.accent,marginTop:2}}>
                    {["mensual","trimestral","semestral","anual"]
                      .filter(t=>eq["activa_"+t])
                      .map(t=>MT[t]?.label||t).join(" · ")}
                  </div>
                </div>
                <button onClick={()=>setEquipos(p=>p.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:T.red,
                    cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
              </div>
            ))}

            {showAddEquipo && (
              <NuevoEquipoModal
                clienteId={clienteId}
                instalacionId={savedInstId}
                onSave={()=>{
                  refresh?.();
                  setShowAddEquipo(false);
                  // Recarga equipos de esta instalación
                  supabase.from("equipos")
                    .select("*")
                    .eq("instalacion_id", savedInstId)
                    .then(({data:eqs})=>setEquipos(eqs||[]));
                }}
                onClose={()=>setShowAddEquipo(false)}
              />
            )}

            <button onClick={onClose}
              style={{width:"100%",padding:"11px",borderRadius:10,marginTop:8,
                border:`1px solid ${T.border}`,background:T.surface,
                color:T.text,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Cerrar
            </button>
          </div>
        )}

        {/* Botones edición */}
        {isEdit && !savedInstId && (
          <div style={{display:"flex",gap:8}}>
            <button onClick={eliminar}
              style={{padding:"10px 16px",borderRadius:8,border:`1px solid ${T.red}40`,
                background:T.redLight,color:T.red,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Eliminar
            </button>
            <button onClick={onClose}
              style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13}}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RevisionModal({ inst, eq, cliente, tipo, user, onSave, onClose }) {
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










/* ══════════════════════════════════════════════════════════════════════════
   SECCIÓN INSTALACIONES — Trabajos de instalación nuevos
   ══════════════════════════════════════════════════════════════════════════ */

let OB_ESTADOS = mkOB_ESTADOS(SC_LIGHT);


export default function App() {
  const [user, setUser]         = useState(null);
  const [empresa, setEmpresa]   = useState({});
  const [techs, setTechs]       = useState([]);
  const [data, setData]         = useState({clientes:[],averias:[],presupuestos:[],eventos:[],instalaciones:[],revisiones:[],equipos:[],mantenimientos:[],instalaciones_obras:[],profiles:[],materiales:[]});
  const [view, setView]         = useState("avisos");
  const [sideOpen, setSideOpen] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedPresupuesto, setSelectedPresupuesto] = useState(null);
  const [selectedInstalacion, setSelectedInstalacion] = useState(null);
  const [selectedMant, setSelectedMant] = useState(null);
  const [isOnline, setIsOnline]     = useState(navigator.onLine);
  const { darkMode, setDarkMode, T: themeT, BS: themeBS, MS: themeMS, PS: themePS, OB_ESTADOS: themeOB_ESTADOS, UCOL: themeUCOL } = useTheme();
  const isMobile = useIsMobile();
  const isAdmin  = user?.role === "admin";
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchVoiceRef = useRef(false);
  const fcmRequestedRef = useRef(false);
  const [searchVoiceActive, setSearchVoiceActive] = useState(false);
  const [tooltipActivo, setTooltipActivo] = useState(null);
  _setTooltip = setTooltipActivo;
  T = themeT;
  BS = themeBS;
  MS = themeMS;
  PS = themePS;
  OB_ESTADOS = themeOB_ESTADOS;
  UCOL = themeUCOL;

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session) loadUser(session.user.id); });
    supabase.auth.onAuthStateChange((_,session)=>{ if(session) loadUser(session.user.id); else setUser(null); });
  },[]);

  // ── Tiempo real
  useEffect(()=>{
    if(!user) return;
    let rtTimer;
    const debouncedLoad = () => { clearTimeout(rtTimer); rtTimer = setTimeout(()=>loadAll(), 400); };
    const tablas = ["averias","presupuestos","mantenimientos","instalaciones_obras","instalaciones","revisiones","clientes","eventos","equipos"];
    const subs = tablas.map(tabla=>
      supabase.channel(`rt_${tabla}_${user.id}`)
        .on("postgres_changes",{ event:"*", schema:"public", table:tabla }, debouncedLoad)
        .subscribe()
    );
    return ()=>{ clearTimeout(rtTimer); subs.forEach(s=>supabase.removeChannel(s)); };
  },[user?.id]);

  useEffect(()=>{
    const goOnline  = () => { setIsOnline(true); loadAll(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return ()=>{ window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  },[]);

  useEffect(()=>{ document.body.style.background = T.bg; }, []);

  useEffect(()=>{
    mostrarTooltipSiNovisto(view);
  }, [view]);

  async function loadUser(id) {
    const { data:profile } = await supabase.from("profiles").select("*").eq("id",id).single();
    if(profile&&profile.activo){
      setUser(profile);
      if(profile.role!=="admin") setView("avisos");
      loadAll();
      if (!fcmRequestedRef.current) {
      fcmRequestedRef.current = true;
      const fcmToken = await requestNotificationPermission();
      console.log("5. Token FCM obtenido:", fcmToken ? fcmToken.slice(0,20)+"..." : "null");
      if(fcmToken) {
        await supabase.from("profiles").update({ fcm_token: null }).eq("fcm_token", fcmToken);
        const { error: fcmErr } = await supabase.from("profiles").update({ fcm_token: fcmToken }).eq("id", id);
        console.log("6. Token guardado en DB:", fcmErr ? "ERROR: "+fcmErr.message : "OK");
      }
      }
    } else { await supabase.auth.signOut(); }
  }

  async function loadAll() {
    const fetch=async(t,o)=>{ let q=supabase.from(t).select("*"); if(o)q=q.order(o,{ascending:o==="nombre"||o==="fecha"}); const {data:d}=await q; return d||[]; };
    const hoyISO=new Date().toISOString().slice(0,10);
    const [cls,avs,pres,evs,ins,revs,eqs,mants,obras,emp,prs,ficHoy,eqEvs,eqArch]=await Promise.all([fetch("clientes","nombre"),fetch("averias","created_at"),fetch("presupuestos","created_at"),fetch("eventos","fecha"),fetch("instalaciones","nombre"),fetch("revisiones","created_at"),fetch("equipos","nombre"),fetch("mantenimientos","created_at"),fetch("instalaciones_obras","created_at"),supabase.from("empresa").select("*").eq("id",1).single(),supabase.from("profiles").select("*").eq("activo",true),supabase.from("fichajes").select("empleado_id,entrada").eq("fecha",hoyISO),fetch("equipo_eventos","fecha"),fetch("equipo_archivos","created_at")]);
    setData({clientes:cls,averias:avs,presupuestos:pres,eventos:evs,instalaciones:ins,revisiones:revs,equipos:eqs,mantenimientos:mants,instalaciones_obras:obras,profiles:prs.data||[],fichajesHoy:ficHoy.data||[],equipo_eventos:eqEvs,equipo_archivos:eqArch});
    if(emp.data) setEmpresa(emp.data);
    if(prs.data) setTechs(prs.data);
    const {data:mats}=await supabase.from("materiales").select("*").eq("activo",true).order("nombre",{ascending:true});
    setData(prev=>({...prev,materiales:mats||[]}));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const mostrarTooltipSiNovisto = (id) => {
    const key = "blch-tooltip-"+id;
    if(!localStorage.getItem(key)) {
      setTooltipActivo(id);
    }
  };
  const cerrarTooltip = () => {
    if(tooltipActivo) {
      localStorage.setItem("blch-tooltip-"+tooltipActivo, "1");
      setTooltipActivo(null);
    }
  };

  if (!user) return <Login onLogin={u=>{ setUser(u); if(u.role!=="admin") setView("avisos"); loadAll(); }}/>;

  const navAvN   = (data.averias||[]).filter(b=>b.status==="nueva").length+(data.mantenimientos||[]).filter(m=>m.status==="nuevo").length;
  const navInstN = (data.instalaciones_obras||[]).filter(o=>["pendiente","en_curso","pendiente_facturar"].includes(o.status)).length;
  const navPresN = (data.presupuestos||[]).filter(p=>["nuevo","enviado","aceptado"].includes(p.status)).length;
  const navContN = (data.instalaciones||[]).reduce((a,i)=>{ MT_TIPOS.forEach(t=>{ if(!i["activa_"+t])return; const inf=urgInfo(i["proxima_"+t]||null); if(inf.level!=="ok"&&inf.level!=="none") a++; }); return a; },0);
  const navFicN  = (()=>{ const h=new Date().getHours(); if(h<7||h>=20) return 0; return (data.profiles||[]).filter(p=>p.ficha!==false&&!(data.fichajesHoy||[]).find(f=>f.empleado_id===p.id&&f.entrada)).length; })();

  const TOOLTIPS = {
    avisos: { titulo:"Avisos — Averías y Mantenimientos", descripcion:"Aquí gestionas todas las incidencias de tus clientes. Crea un aviso cuando un cliente reporta una avería o necesita un mantenimiento. El técnico lo recibirá y podrá crear el parte de trabajo desde aquí." },
    presupuestos: { titulo:"Presupuestos", descripcion:"Crea y envía presupuestos a tus clientes. Puedes vincularlos a un aviso existente. Cuando el cliente lo acepta puedes convertirlo en instalación directamente." },
    instalaciones_obras: { titulo:"Instalaciones", descripcion:"Gestiona las obras e instalaciones en curso. Una instalación puede venir de un presupuesto aceptado o crearse directamente. Aquí controlas el estado y la facturación." },
    contratos: { titulo:"Contratos de mantenimiento", descripcion:"Gestiona los contratos periódicos con tus clientes. Cada contrato agrupa los equipos del cliente con su frecuencia de revisión. Las revisiones pendientes aparecen automáticamente." },
    clientes: { titulo:"Clientes", descripcion:"Tu base de datos de clientes. Cada cliente tiene su historial completo — averías, presupuestos, partes e instalaciones. Desde aquí puedes ver todo lo que se ha hecho para cada cliente." },
    personal: { titulo:"Personal", descripcion:"Gestiona los usuarios de la app. Puedes crear técnicos para que accedan solo a sus avisos y partes, y admins para gestión completa." },
  };

  function busquedaGlobal(query) {
    if(!query || query.trim().length < 2) return [];
    const palabras = query.toLowerCase().trim().split(/\s+/);
    const resultados = [];
    function coincide(texto) {
      if(!texto) return 0;
      const t = texto.toLowerCase();
      return palabras.filter(p => t.includes(p)).length;
    }
    function score(obj, campos) {
      return campos.reduce((s, c) => s + coincide(obj[c]), 0);
    }
    (data.clientes||[]).forEach(c => {
      const s = score(c, ["nombre","apellidos","telefono","email","direccion","dni"]);
      if(s > 0) resultados.push({tipo:"Cliente", titulo:c.nombre+" "+(c.apellidos||""), sub:c.telefono, score:s, id:c.id, action:()=>{ setView("clientes"); setShowSearch(false); setTimeout(()=>setSelectedCliente(c), 100); }});
    });
    (data.averias||[]).forEach(a => {
      const cliente = (data.clientes||[]).find(c=>c.id===a.cliente_id);
      const s = score(a, ["descripcion","equipo","direccion"]) + coincide(cliente?.nombre);
      if(s > 0) resultados.push({tipo:"Avería", titulo:a.descripcion?.slice(0,60), sub:cliente?.nombre, score:s, id:a.id, action:()=>{ setView("avisos"); setShowSearch(false); setTimeout(()=>setSelected(a), 100); }});
    });
    (data.presupuestos||[]).forEach(p => {
      const cliente = (data.clientes||[]).find(c=>c.id===p.cliente_id);
      const s = score(p, ["descripcion","notas"]) + coincide(cliente?.nombre);
      if(s > 0) resultados.push({tipo:"Presupuesto", titulo:p.descripcion?.slice(0,60), sub:cliente?.nombre, score:s, id:p.id, action:()=>{ setView("presupuestos"); setShowSearch(false); setTimeout(()=>setSelectedPresupuesto(p), 100); }});
    });
    (data.instalaciones_obras||[]).forEach(i => {
      const cliente = (data.clientes||[]).find(c=>c.id===i.cliente_id);
      const s = score(i, ["descripcion","direccion"]) + coincide(cliente?.nombre);
      if(s > 0) resultados.push({tipo:"Instalación", titulo:i.descripcion?.slice(0,60), sub:cliente?.nombre, score:s, id:i.id, action:()=>{ setView("instalaciones_obras"); setShowSearch(false); setTimeout(()=>setSelectedInstalacion(i), 100); }});
    });
    (data.materiales||[]).forEach(m => {
      const s = score(m, ["nombre"]);
      if(s > 0) resultados.push({tipo:"Material", titulo:m.nombre, sub:m.precio+"€", score:s, id:m.id, action:()=>{setView("empresa"); setShowSearch(false);}});
    });
    (data.contratos||[]).forEach(c => {
      const cliente = (data.clientes||[]).find(cl=>cl.id===c.cliente_id);
      const s = score(c, ["descripcion","tipo"]) + coincide(cliente?.nombre);
      if(s > 0) resultados.push({tipo:"Contrato", titulo:c.descripcion?.slice(0,60), sub:cliente?.nombre, score:s, id:c.id, action:()=>{setView("contratos"); setShowSearch(false);}});
    });
    return resultados.sort((a,b) => b.score - a.score).slice(0, 15);
  }

  function startVoice(cb) {
    if(searchVoiceRef.current) return;
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado"); return; }
    searchVoiceRef.current = true;
    setSearchVoiceActive(true);
    let transcript = ""; let active = true; let currentR = null;
    function finish() {
      active = false; searchVoiceRef.current = false; setSearchVoiceActive(false);
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

  return (
    <ErrorBoundary>
      <div style={{ display:"flex", minHeight:"100vh", background:T.bg, fontFamily:"'DM Sans',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes aiSpin{to{transform:rotate(360deg)}}`}</style>
        {!isOnline&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#f97316",color:"#fff",textAlign:"center",padding:"8px 16px",fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Sin conexión — los cambios no se guardarán</div>}
        <Sidebar user={user} view={view} setView={v=>{setView(v);if(isMobile)setSideOpen(false);}} onLogout={handleLogout} data={data} open={sideOpen} onToggle={()=>setSideOpen(p=>!p)} onClose={()=>setSideOpen(false)}/>
        <div style={{ flex:1, minWidth:0, paddingTop:isMobile?52:0, paddingBottom:isMobile?70:0, overflowY:"auto", minHeight:"100vh" }}>
          {view==="dashboard" &&isAdmin&&<DashboardView data={data} setView={setView} techs={techs}/>}
          {view==="calendario" &&<CalendarView data={data} refresh={loadAll} user={user}/>}
          {view==="avisos" &&<AvisosView data={data} user={user} onSelect={setSelected} onSelectMant={setSelectedMant} techs={techs} refresh={loadAll} onTooltip={setTooltipActivo}/>}
          {view==="presupuestos" &&<PresupuestosList data={data} refresh={loadAll} user={user} empresa={empresa} onTooltip={setTooltipActivo}/>}
          {view==="clientes" &&isAdmin&&<ClientesList data={data} refresh={loadAll} user={user} onTooltip={setTooltipActivo}/>}
          {view==="formulario" &&isAdmin&&<FormularioView data={data} empresa={empresa}/>}
          {view==="contratos" &&<MantenimientoView data={data} user={user} refresh={loadAll} empresa={empresa}/>}
          {view==="empresa" &&isAdmin&&<EmpresaConfig empresa={empresa} setEmpresa={setEmpresa}/>}
          {view==="usuarios" &&isAdmin&&<UsuariosView techs={techs} refresh={loadAll} user={user} onTooltip={setTooltipActivo}/>}
          {view==="fichajes" &&<FichajesView data={data} user={user} refresh={loadAll} empresa={empresa}/>}
          {view==="instalaciones_obras"&&<InstalacionesObrasView data={data} user={user} techs={techs} refresh={loadAll} empresa={empresa} onTooltip={setTooltipActivo}/>}
        </div>
        {selected&&<AveriaDetalle averia={selected} data={data} user={user} techs={techs} empresa={empresa} refresh={loadAll} onClose={()=>setSelected(null)}/>}
        {selectedCliente&&<ClienteDetalle cliente={selectedCliente} data={data} refresh={loadAll} onClose={()=>setSelectedCliente(null)} onSelectAveria={a=>{setSelectedCliente(null);setTimeout(()=>setSelected(a),50);}} onSelectPresu={p=>{setSelectedCliente(null);setTimeout(()=>setSelectedPresupuesto(p),50);}} onSelectMant={m=>{setSelectedCliente(null);setTimeout(()=>setSelectedMant(m),50);}} onSelectInst={i=>{setSelectedCliente(null);setTimeout(()=>setSelectedInstalacion(i),50);}}/>}
        {selectedPresupuesto&&<PresupuestoDetalle pres={selectedPresupuesto} data={data} user={user} refresh={()=>{loadAll();setSelectedPresupuesto(null);}} empresa={empresa} onClose={()=>setSelectedPresupuesto(null)}/>}
        {selectedInstalacion&&<ObraDetalle obra={selectedInstalacion} data={data} user={user} techs={techs} empresa={empresa} refresh={loadAll} onClose={()=>setSelectedInstalacion(null)}/>}
        {selectedMant&&<MantenimientoDetalle mant={selectedMant} data={data} user={user} techs={techs} empresa={empresa} refresh={loadAll} onClose={()=>setSelectedMant(null)}/>}

        {/* Buscador global */}
        {showSearch && (
          <div style={{position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.5)"}} onClick={()=>setShowSearch(false)}>
            <div style={{position:"absolute", top:"10%", left:"50%", transform:"translateX(-50%)", width:"min(600px, 90vw)", background:T.card, borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:`1px solid ${T.border}`}}>
                <svg width="20" height="20" fill="none" stroke={T.muted} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                  placeholder="Buscar clientes, averías, presupuestos, materiales..."
                  style={{flex:1, border:"none", outline:"none", fontSize:16, background:"transparent", color:T.text, fontFamily:"'DM Sans',sans-serif"}}/>
                {searchVoiceActive
                  ? <button onClick={()=>window.__stopVoice&&window.__stopVoice()} style={{padding:"0 10px", height:36, borderRadius:8, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, whiteSpace:"nowrap", animation:"pulse-red 1.5s infinite"}}>⏹ Parar</button>
                  : <button onClick={()=>startVoice(t=>setSearchQuery(t))} style={{width:36, height:36, borderRadius:8, border:`1px solid ${T.border}`, background:T.card, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                    </button>
                }
                <button onClick={()=>setShowSearch(false)} style={{width:36, height:36, borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, cursor:"pointer", fontSize:18, color:T.muted, fontFamily:"'DM Sans',sans-serif"}}>×</button>
              </div>
              <div style={{maxHeight:400, overflowY:"auto"}}>
                {searchQuery.length >= 2 ? busquedaGlobal(searchQuery).map((r,i) => (
                  <div key={i} onClick={r.action} style={{padding:"12px 20px", cursor:"pointer", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.accentLight}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:T.accentLight, color:T.accent, whiteSpace:"nowrap"}}>{r.tipo}</span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:14, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{r.titulo}</div>
                      {r.sub && <div style={{fontSize:12, color:T.sub}}>{r.sub}</div>}
                    </div>
                  </div>
                )) : (
                  <div style={{padding:40, textAlign:"center", color:T.muted, fontFamily:"'DM Sans',sans-serif"}}>Escribe o habla para buscar...</div>
                )}
                {searchQuery.length >= 2 && busquedaGlobal(searchQuery).length === 0 && (
                  <div style={{padding:40, textAlign:"center", color:T.muted, fontFamily:"'DM Sans',sans-serif"}}>No se encontraron resultados</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botón lupa flotante */}
        <button onClick={()=>{ setSearchQuery(""); setShowSearch(true); }} style={{
          position:"fixed", bottom: isMobile ? 80 : 24, right:24,
          width:52, height:52, borderRadius:"50%",
          background:"linear-gradient(135deg, #1d4ed8, #7c3aed)",
          border:"none", cursor:"pointer", zIndex:998,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 4px 20px rgba(29,78,216,0.4)"
        }}>
          <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        {isMobile&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999,height:64,background:T.card,borderTop:`1px solid ${T.border}`,boxShadow:"0 -2px 12px rgba(0,0,0,0.08)",display:"flex",alignItems:"stretch"}}>
          {[
            {id:"avisos",           label:"Avisos",    badge:navAvN,   icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>},
            {id:"instalaciones_obras",label:"Instala.", badge:navInstN, icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>},
            ...(isAdmin?[{id:"presupuestos",label:"Presup.",badge:navPresN,icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}]:[]),
            {id:"contratos",        label:"Contratos", badge:navContN, icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>},
            {id:"fichajes",         label:"Fichar",    badge:navFicN,  icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
          ].map(item=>{ const active=view===item.id; return (
            <button key={item.id} onClick={()=>setView(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:active?T.accent:T.muted,position:"relative",padding:"8px 4px",fontFamily:"'DM Sans',sans-serif"}}>
              {item.badge>0&&<span style={{position:"absolute",top:6,left:"50%",transform:"translateX(4px)",minWidth:16,height:16,borderRadius:8,background:T.red,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",lineHeight:1}}>{item.badge>9?"9+":item.badge}</span>}
              {item.icon}
              <span style={{fontSize:10,fontWeight:active?600:400,lineHeight:1}}>{item.label}</span>
            </button>
          );})}
        </div>}
      </div>
      {tooltipActivo && TOOLTIPS[tooltipActivo] && (
        <TooltipOnboarding
          id={tooltipActivo}
          titulo={TOOLTIPS[tooltipActivo].titulo}
          descripcion={TOOLTIPS[tooltipActivo].descripcion}
          onClose={cerrarTooltip}
        />
      )}
    </ErrorBoundary>
  );
}
