import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";
import { requestNotificationPermission } from "./firebase.js";
import { detectarAveria, mejorarDescripcion, detectarMateriales, asistirPresupuesto, generarParteCompleto, generarPresupuestoCompleto, generarLineasPresupuesto } from "./ai.js";
import { todayStr, addDays, urgInfo } from "./utils/dates.js";
import { openMaps, sendEmail } from "./utils/links.js";
import { getTextColor } from "./utils/color.js";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { startVoiceSimple } from "./hooks/useVoice.js";
import { SC_LIGHT, SC_DARK, mkBS, mkMS, mkPS, BS_ACTIVOS, BS_ALL, SO_B, MS_ACTIVOS, SO_M, PS_ORDER, MT_TIPOS, MT } from "./constants/status.js";
import { EQ, RITE_CHECKLIST, TIPO_EQUIPO_OPTIONS } from "./constants/equipment.js";
import { generarResumenObraPDF } from "./pdf/obraPDF.js";
import { generarPresupuestoPDF } from "./pdf/presupuestoPDF.js";

async function sendPushNotification(profiles, title, body, role) {
  const targets = (profiles||[]).filter(p=>
    (role==null||p.role===role) && p.fcm_token && p.activo!==false
  );
  const tokensUnicos = [...new Set(targets.map(p=>p.fcm_token))];
  console.log("Enviando", tokensUnicos.length, "notificaciones");
  await Promise.all(tokensUnicos.map(token=>
    supabase.functions.invoke("send-notification", { body:{ token, title, body } })
      .catch(e=>console.error("FCM push error:", e))
  ));
}

/* ─── RESPONSIVE ─────────────────────────────────────────────────────────── */
/* ─── THEME ──────────────────────────────────────────────────────────────── */
const T_LIGHT = {
  bg:"#f8fafc", card:"#ffffff", surface:"#f1f5f9",
  border:"#e2e8f0", accent:"#1d4ed8", accentLight:"#dbeafe",
  green:"#16a34a", greenLight:"#dcfce7",
  red:"#dc2626", redLight:"#fee2e2",
  orange:"#d97706", orangeLight:"#fff7ed", teal:"#0d9488", tealLight:"#f0fdfa",
  purple:"#7c3aed", purpleLight:"#f5f3ff",
  text:"#0f172a", sub:"#475569", muted:"#94a3b8",
  input:"#ffffff",
};
const T_DARK = {
  bg:"#0a0a0a", card:"#111111", surface:"#1a1a1a",
  border:"#3a3a3a", accent:"#3b82f6", accentLight:"#1a2e4a",
  green:"#a0a0a0", greenLight:"#1a1a1a",
  red:"#ef4444", redLight:"#2d0a0a",
  orange:"#f97316", orangeLight:"#2d1a0080", teal:"#14b8a6", tealLight:"#134e4a",
  purple:"#a78bfa", purpleLight:"#2e1065",
  text:"#f0f0f0", sub:"#aaaaaa", muted:"#666666",
  input:"#1a1a1a",
};
let T = T_LIGHT;
let _setTooltip = ()=>{};
const SunIcon  = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/></svg>;
const MoonIcon = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
function BotonNomina({ n }) {
  const [cargando, setCargando] = React.useState(false);
  async function abrir() {
    setCargando(true);
    const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(n.archivo_url, 3600);
    setCargando(false);
    if (error) { alert("No se pudo generar el enlace: " + error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <button onClick={abrir} disabled={cargando}
      style={{ padding:"8px 16px",borderRadius:9,background:T.accentLight,border:"1.5px solid "+T.accent+"40",
               color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",
               flexShrink:0,opacity:cargando?0.6:1 }}>
      {cargando ? "Cargando…" : "Ver / Descargar"}
    </button>
  );
}
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

const UCOL = { urgente:T.red, hoy:T.orange, semana:"#f59e0b", prox:T.teal, ok:T.muted, none:T.muted };
/* ─── VOICE SIMPLE ──────────────────────────────────────────────────────── */
/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const inp = (x={}) => ({
  width:"100%", boxSizing:"border-box", background:T.input,
  border:`1.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px",
  color:T.text, fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif",
  transition:"border-color 0.15s", ...x,
});

/* ─── ATOMS ──────────────────────────────────────────────────────────────── */
function Badge({ status, type="b" }) {
  const s=(type==="b"?BS:PS)[status]||{label:status,color:T.muted};
  return <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:s.color+"14",border:`1px solid ${s.color}28`,color:s.color,whiteSpace:"nowrap" }}><span style={{ width:5,height:5,borderRadius:"50%",background:s.color }}/>{s.label}</span>;
}
function BadgeProg({ fecha }) {
  if(!fecha) return null;
  const dd = fecha.slice(8,10)+"/"+fecha.slice(5,7);
  return <span style={{ fontSize:10,padding:"2px 9px",borderRadius:20,background:"#ecfdf5",border:"1px solid #6ee7b7",color:"#047857",fontWeight:700,whiteSpace:"nowrap",flexShrink:0 }}>Prog. {dd}</span>;
}
function Ava({ name="?", size=32, color }) {
  const c=color||T.accent, p=(name||"?").trim().split(" ");
  const i=((p[0]||"")[0]||"")+((p[1]||"")[0]||"");
  return <div style={{ width:size,height:size,borderRadius:"50%",flexShrink:0,background:c+"16",border:`1.5px solid ${c}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.36,fontWeight:700,color:c,fontFamily:"'Sora',sans-serif" }}>{i.toUpperCase()||"?"}</div>;
}
function Btn({ ch, onClick, v="p", sm, disabled, full }) {
  const styles={p:{background:T.accent,color:"#fff",border:"none"},g:{background:T.card,color:T.sub,border:`1.5px solid ${T.border}`},d:{background:T.redLight,color:T.red,border:`1.5px solid ${T.red}40`},s:{background:T.greenLight,color:T.green,border:`1.5px solid ${T.green}40`},b:{background:T.accentLight,color:T.accent,border:`1.5px solid ${T.accent}40`}};
  return <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:sm?"5px 13px":"9px 18px",width:full?"100%":undefined,fontSize:sm?12:13,fontWeight:600,borderRadius:8,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,fontFamily:"'DM Sans',sans-serif",...(styles[v]||styles.p) }}>{ch}</button>;
}
function Field({ label, children }) {
  return <div style={{ display:"flex",flexDirection:"column",gap:6 }}><label style={{ fontSize:11,fontWeight:600,color:T.sub }}>{label}</label>{children}</div>;
}
function Modal({ onClose, children, w=660, zIndex=200 }) {
  const isMobile=useIsMobile();
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,zIndex,background:"rgba(15,23,42,0.45)",backdropFilter:"blur(6px)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:16 }}><div style={{ width:"100%",maxWidth:w,maxHeight:"92vh",overflowY:"auto",borderRadius:isMobile?"16px 16px 0 0":"14px",background:T.card,border:`1px solid ${T.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",paddingBottom:isMobile?80:20 }}>{children}</div></div>;
}
function MHead({ title, sub, onClose }) {
  return <div style={{ padding:"16px 18px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0 }}><div><h2 style={{ margin:0,fontSize:16,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif" }}>{title}</h2>{sub&&<p style={{ margin:"3px 0 0",fontSize:12,color:T.muted }}>{sub}</p>}</div><button onClick={onClose} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20,flexShrink:0 }}>×</button></div>;
}
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(e){ return {err:e}; }
  render(){ if(this.state.err) return <div style={{ padding:24,background:T.redLight,border:"1px solid #fecaca",borderRadius:12,margin:20 }}><div style={{ fontWeight:700,color:T.red,marginBottom:8 }}>Error en el componente</div><pre style={{ fontSize:11,color:T.red,whiteSpace:"pre-wrap" }}>{String(this.state.err)}</pre></div>; return this.props.children; }
}

function FormularioView({ data, empresa }) {
  const [query, setQuery] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [showDrop, setShowDrop] = useState(false);
  const isMobile = useIsMobile();

  const clientes = data.clientes || [];
  const filtrados = query.length > 1
    ? clientes.filter(c =>
        (c.nombre||"").toLowerCase().includes(query.toLowerCase()) ||
        (c.telefono||"").replace(/\s/g,"").includes(query.replace(/\s/g,""))
      ).slice(0,8)
    : [];

  const telefonoFinal = clienteSel?.telefono || query.replace(/\D/g,"");
  const nombreFinal = clienteSel?.nombre || "";
  const enlace = window.location.origin + "/contacto";
  const mensaje = encodeURIComponent(
    (nombreFinal ? "Hola " + nombreFinal + ",\n\n" : "Hola,\n\n") +
    "Te enviamos nuestro formulario de contacto para gestionar tu solicitud. Por favor, rellénalo cuando puedas:\n\n" +
    enlace + "\n\nGracias,\n" + (empresa?.nombre || "")
  );
  const waUrl = "https://wa.me/" + telefonoFinal.replace(/\D/g,"") + "?text=" + mensaje;

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:500 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:T.text, margin:0 }}>Formulario</h1>
        <p style={{ fontSize:13, color:T.muted, marginTop:4 }}>
          Envía el formulario de contacto a un cliente por WhatsApp
        </p>
      </div>

      {/* Buscador de cliente */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.muted, marginBottom:6, letterSpacing:1 }}>
          CLIENTE
        </div>
        <div style={{ position:"relative" }}>
          <input
            value={clienteSel ? clienteSel.nombre + (clienteSel.telefono?" · "+clienteSel.telefono:"") : query}
            onChange={e=>{ setQuery(e.target.value); setClienteSel(null); setShowDrop(true); }}
            onFocus={()=>setShowDrop(true)}
            placeholder="Buscar por nombre o teléfono..."
            style={{...inp(), width:"100%"}}
          />
          {clienteSel && (
            <button onClick={()=>{ setClienteSel(null); setQuery(""); }}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18}}>×</button>
          )}
          {showDrop && filtrados.length>0 && !clienteSel && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,
              border:`1px solid ${T.border}`,borderRadius:8,zIndex:100,boxShadow:"0 4px 12px #0002",
              maxHeight:200,overflowY:"auto"}}>
              {filtrados.map(c=>(
                <div key={c.id} onClick={()=>{ setClienteSel(c); setQuery(""); setShowDrop(false); }}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,
                    fontSize:13,color:T.text}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                  onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                  <div style={{fontWeight:600}}>{c.nombre} {c.apellidos||""}</div>
                  {c.telefono&&<div style={{fontSize:11,color:T.muted}}>{c.telefono}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {!clienteSel && query.length>1 && filtrados.length===0 && (
          <div style={{fontSize:12,color:T.muted,marginTop:6}}>
            Cliente no encontrado — se creará nuevo al rellenar el formulario
          </div>
        )}
      </div>

      {/* Info del cliente seleccionado */}
      {clienteSel && (
        <div style={{background:T.surface,borderRadius:10,padding:"12px 14px",
          border:`1px solid ${T.border}`,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>{clienteSel.nombre} {clienteSel.apellidos||""}</div>
          {clienteSel.telefono&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{clienteSel.telefono}</div>}
          {clienteSel.email&&<div style={{fontSize:12,color:T.muted}}>{clienteSel.email}</div>}
        </div>
      )}

      {/* Número manual si no hay cliente */}
      {!clienteSel && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,marginBottom:6,letterSpacing:1}}>
            TELÉFONO
          </div>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Ej: 612345678"
            style={{...inp(),width:"100%"}}
          />
        </div>
      )}

      {/* Botón enviar */}
      <a
        href={telefonoFinal.replace(/\D/g,"").length >= 9 ? waUrl : undefined}
        target="_blank" rel="noopener noreferrer"
        onClick={e=>{ if(telefonoFinal.replace(/\D/g,"").length < 9) e.preventDefault(); }}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          padding:"14px", borderRadius:12, textDecoration:"none",
          background: telefonoFinal.replace(/\D/g,"").length >= 9 ? T.green : T.border,
          color:"#fff", fontWeight:700, fontSize:15,
          cursor: telefonoFinal.replace(/\D/g,"").length >= 9 ? "pointer" : "not-allowed",
          transition:"all 0.15s"
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.021.502 3.927 1.385 5.604L0 24l6.545-1.371A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.032-1.387l-.361-.214-3.733.979.998-3.648-.235-.374A9.818 9.818 0 1112 21.818z"/>
        </svg>
        Enviar formulario por WhatsApp
      </a>

      {telefonoFinal.replace(/\D/g,"").length < 9 && (
        <div style={{fontSize:12,color:T.muted,textAlign:"center",marginTop:8}}>
          Introduce un teléfono válido para enviar
        </div>
      )}
    </div>
  );
}

/* ─── SIDEBAR ────────────────────────────────────────────────────────────── */
function Sidebar({ user, view, setView, onLogout, data, open, onToggle, onClose, darkMode, onToggleDark }) {
  const isMobile=useIsMobile();
  const isAdmin=user.role==="admin";
  const links=[
    ...(isAdmin?[{id:"dashboard",label:"Dashboard"}]:[]),
    {id:"calendario",label:"Calendario"},
    {id:"avisos",label:"Avisos"},
    ...(isAdmin?[{id:"instalaciones_obras",label:"Instalaciones"}]:[]),
    ...(isAdmin?[{id:"presupuestos",label:"Presupuestos"}]:[]),
    {id:"contratos",label:"Contratos"},
    {id:"fichajes",label:"Control horario"},
    ...(isAdmin?[{id:"clientes",label:"Clientes"}]:[]),
    ...(isAdmin?[{id:"formulario",label:"Formulario"}]:[]),
    ...(isAdmin?[{id:"usuarios",label:"Personal"},{id:"empresa",label:"Mi empresa"}]:[]),
  ];
  const mtUrg=(data.instalaciones||[]).reduce((a,i)=>{ MT_TIPOS.forEach(t=>{ if(!i["activa_"+t])return; const inf=urgInfo(i["proxima_"+t]||null); if(inf.level!=="ok"&&inf.level!=="none") a++; }); return a; },0);
  const avisosNuevos=(data.averias||[]).filter(b=>b.status==="nueva").length+(data.mantenimientos||[]).filter(m=>m.status==="nuevo").length;
  const avisosPendF=(data.averias||[]).filter(b=>b.status==="pendiente_facturar").length+(data.mantenimientos||[]).filter(m=>m.status==="pendiente_facturar").length;
  const presNuevos=(data.presupuestos||[]).filter(p=>p.status==="nuevo").length;
  const presEnviados=(data.presupuestos||[]).filter(p=>p.status==="enviado").length;
  const instIds=new Set((data.instalaciones_obras||[]).map(o=>o.presupuesto_id).filter(Boolean));
  const presAceptados=(data.presupuestos||[]).filter(p=>p.status==="aceptado"&&!instIds.has(p.id)).length;
  const instPendiente=(data.instalaciones_obras||[]).filter(o=>o.status==="pendiente").length;
  const instEnCurso=(data.instalaciones_obras||[]).filter(o=>o.status==="en_curso").length;
  const instPendF=(data.instalaciones_obras||[]).filter(o=>o.status==="pendiente_facturar").length;
  const horaActual=new Date().getHours();
  const fichajesHoy=data.fichajesHoy||[];
  const sinFichar=(horaActual>=7&&horaActual<20)?(data.profiles||[]).filter(p=>p.ficha!==false&&!fichajesHoy.find(f=>f.empleado_id===p.id&&f.entrada)).length:0;
  const navBadges={
    avisos:[[avisosNuevos,"#dc2626"],[avisosPendF,"#7c3aed"]],
    presupuestos:[[presNuevos,"#dc2626"],[presEnviados,"#f59e0b"],[presAceptados,"#16a34a"]],
    instalaciones_obras:[[instPendiente,OB_ESTADOS.pendiente.color],[instEnCurso,OB_ESTADOS.en_curso.color],[instPendF,OB_ESTADOS.pendiente_facturar.color]],
    contratos:[[mtUrg,T.red]],
    fichajes:[[sinFichar,T.red]],
  };
  const Bdg=({n,c})=>n>0?<span style={{minWidth:18,height:18,borderRadius:9,background:c,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",flexShrink:0,lineHeight:1}}>{n}</span>:null;
  const NavItem=({l})=>{ const active=view===l.id; const bs=navBadges[l.id]||[]; return <button onClick={()=>{ setView(l.id); if(isMobile) onClose(); }} style={{ display:"flex",alignItems:"center",padding:"10px 13px",borderRadius:8,border:"none",background:active?T.accentLight:"transparent",color:active?T.accent:T.sub,fontSize:13,fontWeight:active?600:400,cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"'DM Sans',sans-serif",borderLeft:`3px solid ${active?T.accent:"transparent"}`,gap:6 }}><span style={{ flex:1 }}>{l.label}</span>{bs.map(([n,c],i)=><Bdg key={i} n={n} c={c}/>)}</button>; };
  const Footer=()=><div style={{ padding:"12px 14px",borderTop:`1px solid ${T.border}`,background:T.surface,flexShrink:0 }}><div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><Ava name={user.nombre||"?"} size={30} color={user.color||T.accent}/><div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.nombre}</div><div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>{user.role}</div></div></div><button onClick={onToggleDark} style={{ display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:6 }}>{darkMode?<SunIcon/>:<MoonIcon/>}<span>{darkMode?"Modo claro":"Modo oscuro"}</span></button><button onClick={onLogout} style={{ width:"100%",padding:"7px",borderRadius:7,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Cerrar sesión</button></div>;
  if (isMobile) return (<>
    <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:90,height:52,background:T.card,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 14px",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
      <button onClick={onToggle} style={{ width:34,height:34,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>≡</button>
      <div style={{ display:"flex",alignItems:"center",gap:8,flex:1 }}><div style={{ width:26,height:26,borderRadius:7,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff" }}>BL</div><span style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif" }}>BLCH</span></div>
      {avisosNuevos>0&&<span style={{ background:T.red,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>{avisosNuevos}</span>}
      {(avisosPendF+instPendF)>0&&<span style={{ background:"#7c3aed",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>{avisosPendF+instPendF}</span>}
    </div>
    {open&&<div onClick={onToggle} style={{ position:"fixed",inset:0,zIndex:91,background:"rgba(15,23,42,0.35)",backdropFilter:"blur(3px)" }}/>}
    <div style={{ position:"fixed",top:0,left:0,bottom:64,zIndex:92,width:270,background:T.card,boxShadow:"4px 0 20px rgba(0,0,0,0.12)",transform:open?"translateX(0)":"translateX(-100%)",transition:"transform 0.22s ease",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}><div style={{ width:32,height:32,borderRadius:9,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff" }}>BL</div><div><div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif" }}>BLCH</div><div style={{ fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em" }}>Gestión Técnica</div></div></div>
        <button onClick={onToggle} style={{ width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:T.surface,cursor:"pointer",fontSize:16,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
      </div>
      <nav style={{ flex:1,padding:"10px",paddingBottom:80,overflowY:"auto",display:"flex",flexDirection:"column",gap:2 }}>{links.map(l=><NavItem key={l.id} l={l}/>)}</nav>
      <Footer/>
    </div>
  </>);
  return (
    <div style={{ width:open?240:0,minWidth:open?240:0,flexShrink:0,background:T.card,borderRight:open?`1px solid ${T.border}`:"none",display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0,transition:"width 0.22s ease",overflow:"hidden" }}>
      <div style={{ padding:"16px 14px 14px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",minWidth:214 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}><div style={{ width:32,height:32,borderRadius:9,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0 }}>BL</div><div><div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif",whiteSpace:"nowrap" }}>BLCH</div><div style={{ fontSize:9,color:T.muted,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap" }}>Gestión Técnica</div></div></div>
        <button onClick={onToggle} style={{ width:26,height:26,borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,cursor:"pointer",fontSize:13,color:T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=T.accentLight;e.currentTarget.style.color=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.background=T.surface;e.currentTarget.style.color=T.muted;}}>‹</button>
      </div>
      <nav style={{ flex:1,padding:"10px",overflowY:"auto",display:"flex",flexDirection:"column",gap:2,minWidth:214 }}>{links.map(l=><NavItem key={l.id} l={l}/>)}</nav>
      <div style={{ minWidth:214 }}><Footer/></div>
    </div>
  );
}

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

/* ─── DASHBOARD ──────────────────────────────────────────────────────────── */
function Dashboard({ data, setView, techs }) {
  const isMobile = useIsMobile();
  const bds    = data.averias      || [];
  const pres   = data.presupuestos || [];
  const insts  = data.instalaciones|| [];
  const evs    = data.eventos      || [];

  // ── Averías por estado
  const avStates = ["nueva","en_reparacion","pendiente_piezas","presupuesto_enviado","pendiente_facturar"];
  const avCounts = avStates.map(k=>({ k, s:BS[k], n:bds.filter(b=>b.status===k).length }));
  const avTotal  = avCounts.reduce((s,x)=>s+x.n, 0);

  // ── Presupuestos por estado
  const prStates = ["nuevo","enviado","aceptado","rechazado"];
  const prCounts = prStates.map(k=>({ k, s:PS[k], n:pres.filter(p=>p.status===k).length }));
  const prTotal  = pres.length;
  const prImporte= pres.filter(p=>p.status==="aceptado").reduce((s,p)=>s+(p.importe||0),0);

  // ── Próximos eventos (7 días)
  const today = todayStr();
  const in7   = addDays(today, 7);
  const nextEvs = [...evs]
    .filter(e=>e.fecha>=today && e.fecha<=in7)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha))
    .slice(0,6);

  // ── Próximas revisiones (contratos)
  const pending = [];
  insts.forEach(inst=>{
    const cl=(data.clientes||[]).find(c=>c.id===inst.cliente_id);
    MT_TIPOS.forEach(tipo=>{
      if(!inst["activa_"+tipo]) return;
      const inf=urgInfo(inst["proxima_"+tipo]||null);
      if(inf.level!=="ok"&&inf.level!=="none") pending.push({inst,cl,tipo,info:inf});
    });
  });
  pending.sort((a,b)=>(a.info.days??99)-(b.info.days??99));

  const Card=({label,value,color,sub})=>(
    <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px",position:"relative",overflow:"hidden",flex:1,minWidth:isMobile?"calc(50% - 6px)":0 }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:color,borderRadius:"14px 14px 0 0" }}/>
      <div style={{ fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:34,fontWeight:800,color,fontFamily:"'Sora',sans-serif",lineHeight:1 }}>{value}</div>
      {sub&&<div style={{ fontSize:11,color:T.muted,marginTop:6 }}>{sub}</div>}
    </div>
  );

  const SectionTitle=({title,action,onAction})=>(
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
      <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>{title}</h2>
      {action&&<button onClick={onAction} style={{ background:"none",border:"none",color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer" }}>{action} →</button>}
    </div>
  );

  return (
    <div style={{ padding:isMobile?"12px":"28px", display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <p style={{ color:T.muted,fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",margin:"0 0 4px" }}>Panel de control</p>
        <h1 style={{ fontSize:isMobile?20:26,fontWeight:800,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Dashboard</h1>
      </div>

      {(()=>{
  const pasos = [
    { id:"cliente",    label:"Añade tu primer cliente",              done: (data.clientes||[]).length > 0,           action: ()=>setView("clientes") },
    { id:"aviso",      label:"Crea tu primer aviso",                 done: (data.averias||[]).length > 0,            action: ()=>setView("avisos") },
    { id:"presupuesto",label:"Genera tu primer presupuesto",         done: (data.presupuestos||[]).length > 0,       action: ()=>setView("presupuestos") },
    { id:"tecnico",    label:"Añade un técnico a tu equipo",         done: (data.profiles||[]).filter(p=>p.role==="tecnico").length > 0, action: ()=>setView("personal") },
    { id:"contrato",   label:"Crea tu primer contrato de mantenimiento", done: (data.instalaciones||[]).length > 0, action: ()=>setView("contratos") },
  ];
  const completados = pasos.filter(p=>p.done).length;
  const total = pasos.length;
  const todoHecho = completados === total;
  const oculto = localStorage.getItem("blch-onboarding-oculto");
  if(todoHecho || oculto) return null;
  return (
    <div style={{background:T.card, borderRadius:14, padding:"20px 24px",
      border:`1px solid ${T.border}`, marginBottom:4}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16}}>
        <div>
          <div style={{fontSize:15, fontWeight:700, color:T.text, marginBottom:4}}>
            Primeros pasos — {completados}/{total} completados
          </div>
          <div style={{fontSize:12, color:T.muted}}>
            Completa estos pasos para sacar el máximo partido a BLCH
          </div>
        </div>
        <button onClick={()=>{ localStorage.setItem("blch-onboarding-oculto","1"); window.location.reload(); }}
          style={{background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:13}}>
          Ocultar
        </button>
      </div>

      {/* Barra de progreso */}
      <div style={{height:6, background:T.surface, borderRadius:3, marginBottom:16, overflow:"hidden"}}>
        <div style={{height:"100%", width:`${(completados/total)*100}%`,
          background: completados===total ? T.green : T.accent,
          borderRadius:3, transition:"width 0.4s ease"}}/>
      </div>

      {/* Lista de pasos */}
      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {pasos.map(p=>(
          <div key={p.id} onClick={!p.done ? p.action : undefined}
            style={{display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
              borderRadius:10, cursor: p.done ? "default" : "pointer",
              background: p.done ? T.surface : T.card,
              border:`1px solid ${p.done ? T.border : T.accent+"44"}`,
              transition:"all 0.15s",
              opacity: p.done ? 0.7 : 1}}
            onMouseEnter={e=>{ if(!p.done) e.currentTarget.style.background=T.accentLight; }}
            onMouseLeave={e=>{ if(!p.done) e.currentTarget.style.background=T.card; }}>
            <div style={{width:22, height:22, borderRadius:"50%", flexShrink:0,
              background: p.done ? T.green : T.surface,
              border:`2px solid ${p.done ? T.green : T.border}`,
              display:"flex", alignItems:"center", justifyContent:"center"}}>
              {p.done && (
                <svg width="11" height="11" viewBox="0 0 11 11">
                  <polyline points="1,6 4,9 10,2" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <span style={{fontSize:13, color: p.done ? T.muted : T.text, fontWeight: p.done ? 400 : 500,
              textDecoration: p.done ? "line-through" : "none"}}>
              {p.label}
            </span>
            {!p.done && (
              <svg style={{marginLeft:"auto"}} width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke={T.accent} strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
})()}

      {/* ── KPIs ── */}
      <div style={{ display:"flex",flexWrap:"wrap",gap:12 }}>
        <Card label="Averías activas" value={avTotal}            color={T.accent}  sub={`${bds.filter(b=>b.status==="pendiente_facturar").length} pend. facturar`}/>
        <Card label="Presupuestos activos" value={prTotal}            color="#7c3aed" sub={`${prImporte.toFixed(0)}€ aceptados`}/>
        <Card label="Revisiones pendientes" value={pending.length}     color={T.teal}    sub="contratos activos"/>
        <Card label="Próximos eventos" value={nextEvs.length}     color={T.orange}  sub="próximos 7 días"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>

        {/* ── Estado averías ── */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <SectionTitle title="Estado de averías" action="Ver todas" onAction={()=>setView("avisos")}/>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {avCounts.map(({k,s,n})=>{
              const pct = avTotal>0 ? Math.round((n/avTotal)*100) : 0;
              return (
                <div key={k}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,color:T.sub,fontWeight:500 }}>{s.label}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:s.color }}>{n}</span>
                  </div>
                  <div style={{ height:6,background:T.border,borderRadius:4,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,background:s.color,borderRadius:4,transition:"width 0.4s ease" }}/>
                  </div>
                </div>
              );
            })}
            {avTotal===0&&<div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>Sin averías activas</div>}
          </div>
        </div>

        {/* ── Estado presupuestos ── */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <SectionTitle title="Estado de presupuestos" action="Ver todos" onAction={()=>setView("presupuestos")}/>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {prCounts.map(({k,s,n})=>{
              const pct = prTotal>0 ? Math.round((n/prTotal)*100) : 0;
              return (
                <div key={k}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,color:T.sub,fontWeight:500 }}>{s.label}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:s.color }}>{n}</span>
                  </div>
                  <div style={{ height:6,background:T.border,borderRadius:4,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${pct}%`,background:s.color,borderRadius:4,transition:"width 0.4s ease" }}/>
                  </div>
                </div>
              );
            })}
            {prTotal===0&&<div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>Sin presupuestos</div>}
            {prImporte>0&&(
              <div style={{ marginTop:8,padding:"10px 14px",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0",display:"flex",justifyContent:"space-between" }}>
                <span style={{ fontSize:12,color:T.green,fontWeight:600 }}>Total aceptados</span>
                <span style={{ fontSize:14,fontWeight:700,color:T.green,fontFamily:"'Sora',sans-serif" }}>{prImporte.toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Próximos trabajos ── */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <SectionTitle title="Próximos trabajos" action="Ver calendario" onAction={()=>setView("calendario")}/>
          {nextEvs.length===0 ? (
            <div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>Sin eventos esta semana</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {nextEvs.map(e=>{
                const cl=(data.clientes||[]).find(c=>c.id===e.cliente_id);
                const fecha=new Date(e.fecha+"T12:00:00");
                const dia=fecha.getDate();
                const mes=fecha.toLocaleDateString("es-ES",{month:"short"});
                return (
                  <div key={e.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"8px 10px",borderRadius:9,background:T.surface,border:`1px solid ${T.border}` }}>
                    <div style={{ width:38,flexShrink:0,background:(e.color||T.accent)+"18",borderRadius:9,padding:"6px 0",textAlign:"center" }}>
                      <div style={{ fontSize:16,fontWeight:800,color:e.color||T.accent,fontFamily:"'Sora',sans-serif",lineHeight:1 }}>{dia}</div>
                      <div style={{ fontSize:9,color:T.muted,textTransform:"uppercase",fontWeight:600 }}>{mes}</div>
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.titulo}</div>
                      {cl&&<div style={{ fontSize:11,color:T.muted }}>{cl.nombre}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Próximas revisiones ── */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <SectionTitle title="Revisiones pendientes" action="Ver contratos" onAction={()=>setView("contratos")}/>
          {pending.length===0 ? (
            <div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>
              <div style={{ fontSize:20,marginBottom:6 }}></div>
              Todo al día con los contratos
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {pending.slice(0,6).map((p,i)=>{
                const mt=MT[p.tipo]; const uc=UCOL[p.info.level];
                return (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,background:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${uc}` }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.inst.nombre}</div>
                      <div style={{ fontSize:11,color:T.muted }}>{p.cl?.nombre}</div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2 }}>
                      <span style={{ fontSize:10,padding:"1px 7px",borderRadius:20,background:mt.color+"14",color:mt.color,fontWeight:600 }}>{mt.label}</span>
                      <span style={{ fontSize:10,fontWeight:700,color:uc }}>{p.info.label}</span>
                    </div>
                  </div>
                );
              })}
              {pending.length>6&&<div style={{ textAlign:"center",fontSize:11,color:T.muted }}>+{pending.length-6} más</div>}
            </div>
          )}
        </div>

      </div>

      {/* ── Estadísticas ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:16 }}>

        {/* Barras averías por mes */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px",gridColumn:isMobile?"auto":"span 2" }}>
          <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 14px",fontFamily:"'Sora',sans-serif" }}>Averías últimos 6 meses</h2>
          {(()=>{
            const meses=[]; const now=new Date();
            for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; const label=d.toLocaleDateString("es-ES",{month:"short",year:"2-digit"}); const n=bds.filter(b=>(b.created_at||"").startsWith(key)).length; meses.push({label,n,key}); }
            const max=Math.max(...meses.map(m=>m.n),1);
            return (<div style={{ display:"flex",alignItems:"flex-end",gap:8,height:100 }}>{meses.map(m=>(<div key={m.key} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}><div style={{ fontSize:11,fontWeight:700,color:T.accent }}>{m.n||""}</div><div style={{ width:"100%",borderRadius:"6px 6px 0 0",background:m.n>0?T.accent:T.border,height:`${Math.max((m.n/max)*80,m.n>0?8:2)}px` }}/><div style={{ fontSize:10,color:T.muted,textTransform:"capitalize" }}>{m.label}</div></div>))}</div>);
          })()}
        </div>

        {/* Resumen rápido */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 14px",fontFamily:"'Sora',sans-serif" }}>Resumen</h2>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[["Clientes totales",(data.clientes||[]).length,T.accent],["Presup. aceptados",pres.filter(p=>p.status==="aceptado").length,"#7c3aed"],["Contratos activos",insts.filter(i=>MT_TIPOS.some(t=>i["activa_"+t])).length,T.teal],["Equipos registrados",(data.equipos||[]).length,T.orange]].map(([l,v,c])=>(<div key={l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:T.surface }}><span style={{ fontSize:12,color:T.sub }}>{l}</span><span style={{ fontSize:16,fontWeight:700,color:c,fontFamily:"'Sora',sans-serif" }}>{v}</span></div>))}
          </div>
        </div>

        {/* Equipos más frecuentes */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 14px",fontFamily:"'Sora',sans-serif" }}>Equipos más averiados</h2>
          {(()=>{ const counts={}; bds.forEach(b=>{ if(b.equipo&&b.equipo!=="Por determinar") counts[b.equipo]=(counts[b.equipo]||0)+1; }); const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5); const max=sorted[0]?.[1]||1; return sorted.length===0?<div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>Sin datos</div>:<div style={{ display:"flex",flexDirection:"column",gap:8 }}>{sorted.map(([eq,n])=>(<div key={eq}><div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}><span style={{ fontSize:12,color:T.sub }}>{eq}</span><span style={{ fontSize:12,fontWeight:700,color:T.accent }}>{n}</span></div><div style={{ height:5,background:T.border,borderRadius:4 }}><div style={{ height:"100%",width:`${(n/max)*100}%`,background:T.accent,borderRadius:4 }}/></div></div>))}</div>; })()}
        </div>

        {/* Tiempo medio resolución */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 14px",fontFamily:"'Sora',sans-serif" }}>Tiempo medio de resolución</h2>
          {(()=>{
            const cerradas=bds.filter(b=>b.status==="pendiente_facturar"||b.status==="facturado");
            const tiempos=cerradas.map(b=>{
              if(!b.created_at||!b.fecha_visita) return null;
              const dias=Math.round((new Date(b.fecha_visita)-new Date(b.created_at.slice(0,10)))/86400000);
              return dias>=0?dias:null;
            }).filter(d=>d!==null);
            const media=tiempos.length>0?Math.round(tiempos.reduce((s,d)=>s+d,0)/tiempos.length):null;
            const rapidas=tiempos.filter(d=>d<=1).length;
            const medias=tiempos.filter(d=>d>1&&d<=7).length;
            const lentas=tiempos.filter(d=>d>7).length;
            return media===null?(
              <div style={{ textAlign:"center",color:T.muted,fontSize:13,padding:"20px 0" }}>Sin datos suficientes</div>
            ):(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ textAlign:"center",padding:"16px",background:T.accentLight,borderRadius:10,border:"1px solid #bfdbfe" }}>
                  <div style={{ fontSize:42,fontWeight:800,color:T.accent,fontFamily:"'Sora',sans-serif",lineHeight:1 }}>{media}</div>
                  <div style={{ fontSize:12,color:T.sub,marginTop:4 }}>días de media</div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {[["Mismo día o 1 día",rapidas,T.green],["2 a 7 días",medias,T.orange],["Más de 7 días",lentas,T.red]].map(([l,n,c])=>(
                    <div key={l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:7,background:T.surface }}>
                      <span style={{ fontSize:11,color:T.sub }}>{l}</span>
                      <span style={{ fontSize:13,fontWeight:700,color:c }}>{n}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11,color:T.muted,textAlign:"center" }}>Basado en {tiempos.length} averías cerradas</div>
              </div>
            );
          })()}
        </div>

      </div>

    </div>
  );
}


function Login({ onLogin }) {
  const isMobile=useIsMobile();
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const hasNotif = "Notification" in window;
  const [notifPerm, setNotifPerm] = useState(hasNotif ? Notification.permission : "unsupported");

  async function activarNotificaciones() {
    const p = await Notification.requestPermission();
    console.log("Permiso notificaciones:", p);
    setNotifPerm(p);
  }

  async function submit(e) {
    e.preventDefault(); if(!email||!pw) return;
    setLoading(true); setError("");
    const { data, error:err } = await supabase.auth.signInWithPassword({ email:email.trim(), password:pw });
    if (err) { setError("Email o contraseña incorrectos"); setLoading(false); return; }
    const { data:profile } = await supabase.from("profiles").select("*").eq("id",data.user.id).single();
    if (!profile||!profile.activo) { await supabase.auth.signOut(); setError("Usuario inactivo."); setLoading(false); return; }
    onLogin(profile); setLoading(false);
  }

  const notifBtn = hasNotif && notifPerm !== "unsupported" && (
    <button type="button" onClick={activarNotificaciones}
      style={{ width:"100%",padding:"11px",borderRadius:10,border:`1.5px solid ${notifPerm==="granted"?"#bbf7d0":"#bfdbfe"}`,background:notifPerm==="granted"?"#f0fdf4":"#eff6ff",color:notifPerm==="granted"?"#15803d":notifPerm==="denied"?"#dc2626":"#1d4ed8",fontSize:14,fontWeight:600,cursor:notifPerm==="granted"||notifPerm==="denied"?"default":"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
      {notifPerm==="granted" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
      {notifPerm==="denied"  && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
      {notifPerm==="default" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
      {notifPerm==="granted" ? "Notificaciones activadas" : notifPerm==="denied" ? "Notificaciones bloqueadas (actívalas en ajustes)" : "Activar notificaciones"}
    </button>
  );

  return (
    <div style={{ minHeight:"100vh",background:T.bg,display:"flex",flexDirection:isMobile?"column":"row",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:isMobile?"100%":"40%",background:"linear-gradient(160deg,#1e3a8a,#1d4ed8)",display:"flex",flexDirection:"column",justifyContent:"center",padding:isMobile?"32px 24px":"60px 48px",minHeight:isMobile?"auto":"100vh" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:32 }}><div style={{ width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff" }}>BL</div><div><div style={{ fontSize:17,fontWeight:700,color:"#fff",fontFamily:"'Sora',sans-serif" }}>BLCH</div><div style={{ fontSize:10,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em" }}>Gestión Técnica</div></div></div>
        {!isMobile&&<><h1 style={{ fontSize:28,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:12,fontFamily:"'Sora',sans-serif" }}>Calefacción &<br/>Climatización</h1><p style={{ color:"rgba(255,255,255,0.65)",fontSize:14,lineHeight:1.7,maxWidth:280 }}>Plataforma de gestión de averías, presupuestos, instalaciones y mantenimiento preventivo.</p></>}
      </div>
      <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"28px 20px 40px":"40px 48px" }}>
        <div style={{ width:"100%",maxWidth:380 }}>
          <h2 style={{ fontSize:22,fontWeight:700,color:T.text,marginBottom:6,fontFamily:"'Sora',sans-serif" }}>Acceder</h2>
          <p style={{ color:T.muted,fontSize:14,marginBottom:28 }}>Introduce tus credenciales</p>
          <form onSubmit={submit} style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp()} placeholder="correo@empresa.com" autoComplete="email"/></Field>
            <Field label="Contraseña"><input type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inp()} placeholder="••••••••" autoComplete="current-password"/></Field>
            {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
            <button type="submit" disabled={loading||!email||!pw} style={{ width:"100%",padding:"12px",borderRadius:10,border:"none",background:T.accent,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:loading?0.7:1,marginTop:4 }}>{loading?"Accediendo...":"Acceder"}</button>
            {notifBtn}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Guardar contacto vCard ──────────────────────────────────────────────── */
function guardarContacto(cliente) {
  if (!cliente) return;
  const vcf = [
 "BEGIN:VCARD",
 "VERSION:3.0",
 `FN:${cliente.nombre||""}`,
 `N:${(cliente.nombre||"").split(" ").slice(1).join(" ")};${(cliente.nombre||"").split(" ")[0]};;;`,
    cliente.telefono ? `TEL;TYPE=CELL:${cliente.telefono}` : "",
    cliente.email    ? `EMAIL:${cliente.email}` : "",
    cliente.direccion? `ADR:;;${cliente.direccion};;;;` : "",
 "END:VCARD"
  ].filter(Boolean).join("\n");
  const blob = new Blob([vcf], {type:"text/vcard"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${cliente.nombre||"contacto"}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── BtnContacto ─────────────────────────────────────────────────────────── */
function BtnContacto({ cliente, size=36 }) {
  if (!cliente?.nombre) return null;
  return (
    <button onClick={()=>guardarContacto(cliente)} title="Guardar contacto"
      style={{ width:size,height:size,borderRadius:8,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    </button>
  );
}


/* ─── CLIENTE SELECTOR ───────────────────────────────────────────────────── */



/* ── NuevaAveriaModal ──────────────────────────────────────────────────── */
function NuevaAveriaModal({ data, user, techs, refresh, onClose }) {
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];

  const [clienteId, setClienteId] = useState(cls[0]?.id || "");
  const [direccion, setDireccion] = useState(cls[0]?.direccion || "");
  const [form, setForm] = useState({
    equipo:"Caldera", descripcion:"",
    fechaVisita:todayStr(),
    tecnicoId: isAdmin ? (techs||[])[0]?.id || "" : user.id,
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [saving, setSaving] = useState(false);

  function handleClienteChange(id) {
    setClienteId(id);
    const c = cls.find(x=>x.id===id);
    setDireccion(c?.direccion || "");
  }

  async function handleNewCliente(nuevoForm) {
    const payload = { ...nuevoForm, dni:nuevoForm.dni||null, notas:nuevoForm.notas||null };
    const { data:nc, error } = await supabase.from("clientes").insert([payload]).select().single();
    if (!error && nc) { refresh?.(); setClienteId(nc.id); setDireccion(nc.direccion||""); }
    else alert("Error al crear cliente: " + (error?.message||""));
  }

  async function save() {
    if (!form.descripcion.trim() || !clienteId) { alert("Selecciona un cliente y escribe la descripción."); return; }
    setSaving(true);
    const { error } = await supabase.from("averias").insert([{
      cliente_id:  clienteId,
      direccion:   direccion,
      equipo:      form.equipo,
      descripcion: form.descripcion.trim(),
      fecha_visita:form.fechaVisita,
      tecnico_id:  form.tecnicoId || null,
      status: "nueva",
      from_form:   false,
    }]);
    if (!error) {
      refresh?.(); onClose();
    } else alert("Error: " + error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={560}>
      <MHead title="Nueva avería" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <ClienteSelector clientes={cls} value={clienteId} onChange={handleClienteChange} onNewCliente={handleNewCliente}/>
        {clienteId && (
          <Field label="Dirección de la visita">
            <input value={direccion} onChange={e=>setDireccion(e.target.value)} style={inp()} placeholder="Dirección donde realizar la visita"/>
          </Field>
        )}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          <Field label="Equipo">
            <select value={form.equipo} onChange={e=>upd("equipo",e.target.value)} style={inp()}>
              {["Caldera","Split A/C","Bomba de calor","Fan-coil","Climatizador","Aerotermia","VRV/VRF","Suelo radiante","Otro"].map(e=><option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Fecha visita">
            <input type="date" value={form.fechaVisita} onChange={e=>upd("fechaVisita",e.target.value)} style={inp()}/>
          </Field>
        </div>
        {isAdmin && (
          <Field label="Técnico asignado">
            <select value={form.tecnicoId||""} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar (visible para todos)</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}
        <Field label="Descripción del problema *">
          <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
            placeholder="Describe brevemente el problema..." style={{...inp(),minHeight:75,resize:"vertical"}}/>
        </Field>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear avería"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>

    </Modal>
  );
}

/* ── AveriaDetalle ─────────────────────────────────────────────────────── */
function AveriaDetalle({ averia:initA, data, user, techs, empresa, refresh, onClose }) {
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


function ParteModal({ averia, cliente, user, empresa, profiles, refresh, onClose, titulo="PARTE DE TRABAJO", materiales=[] }) {
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


function NuevoMantenimientoModal({ data, user, techs, refresh, onClose }) {
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];
  const [clienteId, setClienteId] = useState(cls[0]?.id || "");
  const [direccion, setDireccion] = useState(cls[0]?.direccion || "");
  const [form, setForm] = useState({
    equipo:"Caldera", descripcion:"",
    fechaVisita:todayStr(),
    tecnicoId: isAdmin ? (techs||[])[0]?.id || "" : user.id,
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [saving, setSaving] = useState(false);

  function handleClienteChange(id) {
    setClienteId(id);
    const c = cls.find(x=>x.id===id);
    setDireccion(c?.direccion || "");
  }

  async function save() {
    if (!form.descripcion.trim() || !clienteId) { alert("Selecciona un cliente y escribe la descripción."); return; }
    setSaving(true);
    const { error } = await supabase.from("mantenimientos").insert([{
      cliente_id:  clienteId,
      direccion:   direccion,
      equipo:      form.equipo,
      descripcion: form.descripcion.trim(),
      fecha_visita:form.fechaVisita,
      tecnico_id:  form.tecnicoId || null,
      status: "nuevo",
      from_form:   false,
    }]);
    if (!error) { refresh?.(); onClose(); }
    else alert("Error: " + error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={560}>
      <MHead title="Nuevo mantenimiento" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <ClienteSelector clientes={cls} value={clienteId} onChange={handleClienteChange} onNewCliente={async(f)=>{ const {data:nc,error}=await supabase.from("clientes").insert([f]).select().single(); if(!error&&nc){refresh?.();setClienteId(nc.id);setDireccion(nc.direccion||"");} else alert("Error: "+(error?.message||"")); }}/>
        {clienteId && (
          <Field label="Dirección de la visita">
            <input value={direccion} onChange={e=>setDireccion(e.target.value)} style={inp()} placeholder="Dirección donde realizar la visita"/>
          </Field>
        )}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          <Field label="Equipo">
            <select value={form.equipo} onChange={e=>upd("equipo",e.target.value)} style={inp()}>
              {EQ.map(e=><option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Fecha visita">
            <input type="date" value={form.fechaVisita} onChange={e=>upd("fechaVisita",e.target.value)} style={inp()}/>
          </Field>
        </div>
        {isAdmin && (
          <Field label="Técnico asignado">
            <select value={form.tecnicoId||""} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar (visible para todos)</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}
        <Field label="Descripción del trabajo *">
          <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
            placeholder="Describe el mantenimiento a realizar..." style={{...inp(),minHeight:75,resize:"vertical"}}/>
        </Field>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear mantenimiento"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>
    </Modal>
  );
}

function MantenimientoDetalle({ mant:initM, data, user, techs, empresa, refresh, onClose }) {
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


function MantenimientosView({ data, user, techs, refresh, empresa }) {
  const isMobile  = useIsMobile();
  const isAdmin   = user.role === "admin";
  const [filter, setFilter]   = useState("activos");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);

  const all = (data.mantenimientos||[]).filter(m=>{
    if (isAdmin) return true;
    return !m.tecnico_id || m.tecnico_id === user.id;
  });

  const filtros = [
    { key:"activos",            label:"Activos",          items: all.filter(m=>!["pendiente_facturar","facturado"].includes(m.status)) },
    { key:"pendiente_facturar", label:"Pend. facturar",   items: all.filter(m=>m.status==="pendiente_facturar") },
    { key:"facturado",          label:"Facturados",       items: all.filter(m=>m.status==="facturado") },
    { key:"todos",              label:"Todos",            items: all },
  ];
  const filtroActual = filtros.find(f=>f.key===filter) || filtros[0];
  const sorted = [...filtroActual.items].sort((a,b)=>(SO_M[a.status]??5)-(SO_M[b.status]??5));
  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Mantenimientos</h1>
        <Btn ch={isMobile?"+ Nuevo":"+ Nuevo mantenimiento"} onClick={()=>setShowNew(true)}/>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {filtros.map(f=>{
          const isActive = filter===f.key;
          const colors = {activas:T.accent, pendiente_facturar:"#7c3aed", facturadas:"#16a34a", todas:T.sub};
          const bgs = {activas:T.accentLight, pendiente_facturar:"#fff7ed", facturadas:T.surface, todas:T.bg};
          const c = colors[f.key]||T.sub;
          const bg = bgs[f.key]||T.bg;
          return (
            <button key={f.key} onClick={()=>setFilter(f.key)}
              style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${isActive?c:T.border}`, background:isActive?c+"22":T.card, color:isActive?c:T.sub, fontSize:12, fontWeight:isActive?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
              {f.label} <span style={{ fontSize:11, opacity:0.8 }}>({f.items.length})</span>
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.length===0 && <div style={{ textAlign:"center", color:T.muted, padding:"60px 0", fontSize:14 }}>No hay mantenimientos en esta categoría</div>}
        {sorted.map(m=>{
          const c  = cl(m.cliente_id);
          const s  = MS[m.status];
          const esPendFacturar = m.status === "pendiente_facturar";
          return (
            <div key={m.id} onClick={()=>setSelected(m)}
              style={{ background:esPendFacturar?"#fffdf0":T.card, border:`1px solid ${esPendFacturar?"#fde68a":T.border}`, borderLeft:`4px solid ${s?.color||T.muted}`, borderRadius:8, padding:"8px 12px", cursor:"pointer", transition:"all 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow=esPendFacturar?"0 0 0 1px #fde68a":"0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
              <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:6, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{m.descripcion}</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:500, color:T.text }}>{c?.nombre}</span>
                  <span style={{ color:T.border, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:T.muted }}>{m.equipo}</span>
                  <span style={{ color:T.border, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:T.muted }}>{m.fecha_visita}</span>
                  {m.from_form && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:T.purpleLight, color:T.purple, fontWeight:600 }}>Web</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:(s?.color||T.muted)+"15", color:s?.color||T.muted }}>
                    {s?.label || m.status}
                  </span>
                  {c?.telefono && (
                    <a href={`https://wa.me/34${c.telefono.replace(/\s/g,"")}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                      style={{ width:30,height:30,borderRadius:7,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  )}
                  {c?.telefono && (
                    <a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()}
                      style={{ width:30,height:30,borderRadius:7,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    </a>
                  )}
                  <button onClick={e=>{ e.stopPropagation(); openMaps(m.direccion); }}
                    style={{ width:30,height:30,borderRadius:7,background:T.accentLight,border:"1.5px solid "+T.accent+"40",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showNew && <NuevoMantenimientoModal data={data} user={user} techs={techs} refresh={refresh} onClose={()=>setShowNew(false)}/>}
      {selected && <MantenimientoDetalle mant={selected} data={data} user={user} techs={techs} empresa={empresa} refresh={refresh} onClose={()=>setSelected(null)}/>}
    </div>
  );
}


function ProgramarVisitaModal({ averia, cliente, data }) {
  const [show, setShow] = useState(false);
  const [fecha, setFecha] = useState(averia.fecha_visita||todayStr());
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  async function programar() {
    setSaving(true);
    const { error } = await supabase.from("eventos").insert([{
      tipo:"averia_programada",
      titulo:`${String(averia.id).startsWith("mant_")?"Mantenimiento":"Avería"}: ${averia.descripcion?.slice(0,50)}`,
      cliente_id:averia.cliente_id,
      direccion:averia.direccion||cliente?.direccion||"",
      fecha:fecha,
      notas:hora?`${hora}h — ${nota}`:nota,
      color:"#d97706",
      averia_id:String(averia.id),
    }]);
    if(!error){ setShow(false); alert("Visita añadida al calendario."); }
    else alert("Error: "+error.message);
    setSaving(false);
  }

  return (
    <div>
      {!show ? (
        <button onClick={()=>setShow(true)}
          style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid "+T.accent+"40", background:T.accentLight, color:T.accent, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          Programar
        </button>
      ) : (
        <div style={{ background:T.accentLight, borderRadius:10, padding:"14px", border:"1.5px solid "+T.accent+"40" }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.accent, marginBottom:12 }}>Programar visita</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})}/></Field>
              <Field label="Hora (opcional)"><input type="time" value={hora} onChange={e=>setHora(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})}/></Field>
            </div>
            <Field label="Notas"><input value={nota} onChange={e=>setNota(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Observaciones para la visita..."/></Field>
            <div style={{ display:"flex", gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setShow(false)} v="g" sm/>
              <Btn ch={saving?"Guardando...":"Añadir al calendario"} onClick={programar} disabled={saving||!fecha} sm/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── AVISOS ─────────────────────────────────────────────────────────────── */
function NuevoAvisoModal({ data, user, techs, refresh, onClose }) {
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

function AvisosView({ data, user, techs, refresh, empresa, onSelect, onSelectMant }) {
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const [tab, setTab]       = useState("averias");
  const [filter, setFilter] = useState("activos");
  const [showNew, setShowNew] = useState(false);

  const allBds   = (data.averias||[]).filter(b => isAdmin || !b.tecnico_id || b.tecnico_id===user.id);
  const allMants = (data.mantenimientos||[]).filter(m => isAdmin || !m.tecnico_id || m.tecnico_id===user.id);

  function applyFilter(items, esAverias) {
    if (filter==="activos") return esAverias
      ? items.filter(b=>!["cerrada","pendiente_facturar","facturado"].includes(b.status))
      : items.filter(m=>!["pendiente_facturar","facturado"].includes(m.status));
    if (filter==="todos") return items;
    return items.filter(x=>x.status===filter);
  }

  const sortedBds   = [...applyFilter(allBds,  true)].sort((a,b)=>(SO_B[a.status]??5)-(SO_B[b.status]??5));
  const sortedMants = [...applyFilter(allMants, false)].sort((a,b)=>(SO_M[a.status]??5)-(SO_M[b.status]??5));
  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  const fColors = { activos:T.accent, pendiente_facturar:"#7c3aed", facturado:"#16a34a", todos:T.sub };
  const fBgs    = { activos:T.accentLight, pendiente_facturar:"#fff7ed", facturado:T.surface, todos:T.bg };

  function countFilter(key) {
    const items = tab==="averias" ? allBds : allMants;
    if (key==="activos") return tab==="averias"
      ? items.filter(b=>!["cerrada","pendiente_facturar","facturado"].includes(b.status)).length
      : items.filter(m=>!["pendiente_facturar","facturado"].includes(m.status)).length;
    if (key==="todos") return items.length;
    return items.filter(x=>x.status===key).length;
  }

  const actionBtns = c => (<>
    {c?.telefono && (
      <a href={`https://wa.me/34${c.telefono.replace(/\s/g,"")}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
        style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    )}
    {c?.telefono && (
      <a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()}
        style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
      </a>
    )}
  </>);

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Avisos</h1>
        <button onClick={()=>_setTooltip("avisos")} title="Ayuda de Avisos" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        <Btn ch={isMobile?"+ Nuevo":"+ Nuevo aviso"} onClick={()=>setShowNew(true)}/>
      </div>

      <div style={{ width: isMobile ? "100%" : "fit-content" }}>
      {/* Pestañas */}
      <div style={{ display:"flex", gap:10, marginBottom:14, width:"100%" }}>
        {[
          ["averias","Averías",allBds.length,[
            [allBds.filter(b=>b.status==="nueva").length,"#dc2626"],
            [allBds.filter(b=>b.status==="en_reparacion").length,SC_LIGHT.en_reparacion],
            [allBds.filter(b=>b.status==="pendiente_facturar").length,"#7c3aed"],
          ]],
          ["mantenimientos","Mantenimientos",allMants.length,[
            [allMants.filter(m=>m.status==="nuevo").length,"#dc2626"],
            [allMants.filter(m=>m.status==="en_proceso").length,SC_LIGHT.en_proceso],
            [allMants.filter(m=>m.status==="pendiente_facturar").length,"#7c3aed"],
          ]],
        ].map(([k,l,cnt,bdgs])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:12, border:tab===k?`2px solid ${T.accent}`:`2px solid ${T.border}`, background:tab===k?T.accent+"22":T.card, color:tab===k?T.accent:T.sub, fontSize:13, fontWeight:tab===k?700:500, cursor:"pointer", whiteSpace:"nowrap", flex:1, justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
            {l}
            {bdgs.filter(([n])=>n>0).map(([n,c],i)=>(
              <span key={i} style={{ minWidth:18,height:18,borderRadius:9,background:c,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",lineHeight:1 }}>{n}</span>
            ))}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {[["activos","Activos"],["pendiente_facturar","Pend. facturar"],["facturado","Facturados"],["todos","Todos"]].map(([k,l])=>{
          const isActive = filter===k;
          const c  = fColors[k]||T.sub;
          const bg = fBgs[k]||T.bg;
          return (
            <button key={k} onClick={()=>setFilter(k)}
              style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"7px 16px", borderRadius:20, border:isActive?`1px solid ${c}`:`1.5px solid ${fColors[k]+"88"}`, background:isActive?c+"22":T.card, color:isActive?c:T.sub, fontSize:12, fontWeight:isActive?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
              {l}
              <span style={{ minWidth:18,height:18,borderRadius:9,background:fColors[k]||T.sub,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",lineHeight:1,flexShrink:0 }}>{countFilter(k)}</span>
            </button>
          );
        })}
      </div>
      </div>

      {/* Lista averías */}
      {tab==="averias" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sortedBds.length===0 && <div style={{ textAlign:"center", color:T.muted, padding:"60px 0", fontSize:14 }}>No hay averías en esta categoría</div>}
          {sortedBds.map(b=>{
            const c  = cl(b.cliente_id);
            const s  = BS[b.status];
            const pf = b.status==="pendiente_facturar";
            const evBd = (data.eventos||[]).find(e=>e.averia_id===String(b.id));
            return (
              <div key={b.id} onClick={()=>onSelect(b)}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderLeft: `6px solid ${s?.color||T.muted}`,
                  borderRadius: 11,
                  padding: "13px 15px",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.descripcion}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, fontWeight:500, color:T.text }}>{c?.nombre}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{b.equipo}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{b.fecha_visita}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{new Date(b.created_at).toLocaleDateString("es-ES")}</span>
                    {b.from_form && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:T.purpleLight, color:T.purple, fontWeight:600 }}>Web</span>}
                    <BadgeProg fecha={evBd?.fecha}/>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:(s?.color||T.muted)+"dd", color:"#fff" }}>{s?.label||b.status}</span>
                    <span style={{ fontSize:11, color:T.muted, marginLeft:6 }}>{new Date(b.created_at).toLocaleDateString("es-ES")}</span>
                    {actionBtns(c)}
                    <button onClick={e=>{ e.stopPropagation(); openMaps(b.direccion); }}
                      style={{ width:30, height:30, borderRadius:7, background:T.accent+"22", border:"1.5px solid "+T.accent, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista mantenimientos */}
      {tab==="mantenimientos" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sortedMants.length===0 && <div style={{ textAlign:"center", color:T.muted, padding:"60px 0", fontSize:14 }}>No hay mantenimientos en esta categoría</div>}
          {sortedMants.map(m=>{
            const c  = cl(m.cliente_id);
            const s  = MS[m.status];
            const pf = m.status==="pendiente_facturar";
            const evMt = (data.eventos||[]).find(e=>e.averia_id==="mant_"+m.id);
            return (
              <div key={m.id} onClick={()=>onSelectMant?.(m)}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderLeft: `6px solid ${s?.color||T.muted}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:6, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{m.descripcion}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, fontWeight:500, color:T.text }}>{c?.nombre}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{m.equipo}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{m.fecha_visita}</span>
                    <span style={{ color:T.border, fontSize:10 }}>·</span>
                    <span style={{ fontSize:12, color:T.muted }}>{new Date(m.created_at).toLocaleDateString("es-ES")}</span>
                    {m.from_form && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:T.purpleLight, color:T.purple, fontWeight:600 }}>Web</span>}
                    <BadgeProg fecha={evMt?.fecha}/>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:(s?.color||T.muted)+"dd", color:"#fff" }}>{s?.label||m.status}</span>
                    <span style={{ fontSize:11, color:T.muted, marginLeft:6 }}>{new Date(m.created_at).toLocaleDateString("es-ES")}</span>
                    {actionBtns(c)}
                    <button onClick={e=>{ e.stopPropagation(); openMaps(m.direccion); }}
                      style={{ width:30,height:30,borderRadius:7,background:T.accent+"22",border:"1.5px solid "+T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NuevoAvisoModal data={data} user={user} techs={techs} refresh={refresh} onClose={()=>setShowNew(false)}/>}
    </div>
  );
}


function AveriasList({ data, user, techs, refresh, onSelect }) {
  const isMobile  = useIsMobile();
  const isAdmin   = user.role === "admin";
  const [filter, setFilter]   = useState("activas");
  const [showNew, setShowNew] = useState(false);

  // Visibilidad: admin ve todo; técnico ve las suyas + las sin asignar
  const all = (data.averias||[]).filter(b=>{
    if (isAdmin) return true;
    return !b.tecnico_id || b.tecnico_id === user.id;
  });

  // Filtros
  const filtros = [
    { key:"activas",            label:"Activas",          items: all.filter(b=>!["cerrada","pendiente_facturar","facturado"].includes(b.status)) },
    { key:"pendiente_facturar", label:"Pend. facturar",   items: all.filter(b=>b.status==="pendiente_facturar") },
    { key:"facturado",          label:"Facturadas",       items: all.filter(b=>b.status==="facturado") },
    { key:"todas",              label:"Todas",            items: all },
  ];
  const filtroActual = filtros.find(f=>f.key===filter) || filtros[0];
  const sorted = [...filtroActual.items].sort((a,b)=>(SO_B[a.status]??5)-(SO_B[b.status]??5));
  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  return (
    <div style={{ padding:isMobile?12:28 }}>
      {/* Cabecera */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Averías</h1>
        <Btn ch={isMobile?"+ Nueva":"+ Nueva avería"} onClick={()=>setShowNew(true)}/>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {filtros.map(f=>{
          const isActive = filter===f.key;
          const fColors = {activas:T.accent, pendiente_facturar:"#7c3aed", facturadas:"#16a34a", todas:T.sub};
          const fBgs    = {activas:T.accentLight, pendiente_facturar:"#fff7ed", facturadas:T.surface, todas:T.bg};
          const c  = fColors[f.key]||T.sub;
          const bg = fBgs[f.key]||T.bg;
          return (
            <button key={f.key} onClick={()=>setFilter(f.key)}
              style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${isActive?c:T.border}`, background:isActive?c+"22":T.card, color:isActive?c:T.sub, fontSize:12, fontWeight:isActive?700:400, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
              {f.label} <span style={{ fontSize:11, opacity:0.8 }}>({f.items.length})</span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sorted.length===0 && (
          <div style={{ textAlign:"center", color:T.muted, padding:"60px 0", fontSize:14 }}>
            No hay averías en esta categoría
          </div>
        )}
        {sorted.map(b=>{
          const c  = cl(b.cliente_id);
          const s  = BS[b.status];
          const esPendFacturar = b.status === "pendiente_facturar";
          return (
            <div key={b.id} onClick={()=>onSelect(b)}
              style={{ background:esPendFacturar?"#fffdf0":T.card, border:`1px solid ${esPendFacturar?"#fde68a":T.border}`, borderLeft:`4px solid ${s?.color||T.muted}`, borderRadius:11, padding:"13px 15px", cursor:"pointer", boxShadow:esPendFacturar?"0 0 0 1px #fde68a":"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.boxShadow=esPendFacturar?"0 0 0 1px #fde68a":"0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
              {/* Línea principal */}
              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.descripcion}</div>
              {/* Info */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:500, color:T.text }}>{c?.nombre}</span>
                  <span style={{ color:T.border, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:T.muted }}>{b.equipo}</span>
                  <span style={{ color:T.border, fontSize:10 }}>·</span>
                  <span style={{ fontSize:12, color:T.muted }}>{b.fecha_visita}</span>
                  {b.from_form && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:T.purpleLight, color:T.purple, fontWeight:600 }}>Web</span>}
                </div>
                {/* Acciones rápidas */}
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:(s?.color||T.muted)+"15", color:s?.color||T.muted }}>
                    {s?.label || b.status}
                  </span>
                  <span style={{ fontSize:11, color:T.muted, marginLeft:6 }}>{new Date(b.created_at).toLocaleDateString("es-ES")}</span>
                  {c?.telefono && (
                    <a href={`https://wa.me/34${c.telefono.replace(/\s/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                      style={{ width:30, height:30, borderRadius:7, background:T.greenLight, border:"1.5px solid "+T.border, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  )}
                  {c?.telefono && (
                    <a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()}
                      style={{ width:30, height:30, borderRadius:7, background:T.greenLight, border:"1.5px solid "+T.border, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    </a>
                  )}
                  <button onClick={e=>{ e.stopPropagation(); openMaps(b.direccion); }}
                    style={{ width:30, height:30, borderRadius:7, background:T.accentLight, border:"1.5px solid "+T.accent+"40", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <NuevaAveriaModal data={data} user={user} techs={techs} refresh={refresh} onClose={()=>setShowNew(false)}/>}
    </div>
  );
}


/* ─── PRESUPUESTOS ───────────────────────────────────────────────────────── */
function NuevoPresupuestoModal({ data, user, techs, refresh, onClose }) {
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


function PresupuestoDetalle({ pres:initP, data, user, refresh, empresa, onClose }) {
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
    const {error}=await supabase.from("presupuestos").update({
      descripcion:editForm.descripcion, notas:editForm.notas||null,
      lineas:editForm.lineas, aplicar_iva:editForm.aplicar_iva, importe:editTotal,
    }).eq("id",p.id);
    if(!error){ setP(prev=>({...prev,...editForm,importe:editTotal})); setEditMode(false); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function guardarYPDF() {
    const {error}=await supabase.from("presupuestos").update({
      descripcion:editForm.descripcion, notas:editForm.notas||null,
      lineas:editForm.lineas, aplicar_iva:editForm.aplicar_iva, importe:editTotal,
    }).eq("id",p.id);
    if(!error){
      const updated={...p,...editForm,importe:editTotal};
      setP(prev=>({...prev,...editForm,importe:editTotal}));
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


function PresupuestosList({ data, refresh, user, onSelect, empresa={} }) {
  const isMobile=useIsMobile(); const [filter,setFilter]=useState("all"); const [showNew,setShowNew]=useState(false); const [selPresu,setSelPresu]=useState(null);
  const all = data.presupuestos||[];
  const filtros = PS_ORDER.map(k=>({ key:k, label:PS[k].label, items:all.filter(b=>b.status===k) }));
  const filtroActual = filtros.find(f=>f.key===filter) || filtros[0];
  const sorted = [...filtroActual.items].sort((a,b)=>b.created_at?.localeCompare(a.created_at||"")||0);
  const cl=id=>(data.clientes||[]).find(c=>c.id===id);
  const total=sorted.reduce((s,b)=>s+(b.importe||0),0);
  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
        <div><h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 3px",fontFamily:"'Sora',sans-serif" }}>Presupuestos</h1><p style={{ color:T.muted,fontSize:12,margin:0 }}>{sorted.length} · <span style={{ color:T.accent,fontWeight:600 }}>{total.toLocaleString("es-ES")} €</span></p></div>
        <button onClick={()=>_setTooltip("presupuestos")} title="Ayuda de Presupuestos" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        <Btn ch={isMobile?"+ Nuevo":"+ Nuevo presupuesto"} onClick={()=>setShowNew(true)}/>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4 }}>
        {filtros.map(f=>(<button key={f.key} onClick={()=>setFilter(f.key)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:20,border:filter===f.key?`1px solid ${PS[f.key].color}`:`1.5px solid ${PS[f.key].color+"88"}`,background:filter===f.key?PS[f.key].color+"22":T.card,color:filter===f.key?PS[f.key].color:T.sub,fontSize:12,fontWeight:filter===f.key?700:400,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>{f.label}<span style={{ minWidth:18,height:18,borderRadius:9,background:PS[f.key].color,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",lineHeight:1,flexShrink:0 }}>{f.items.length}</span></button>))}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {sorted.length===0&&<div style={{ textAlign:"center",color:T.muted,padding:"50px 0",fontSize:13 }}>Sin presupuestos en este estado</div>}
        {sorted.map(bu=>{ const c=cl(bu.cliente_id); const s=PS[bu.status]; const evPr=(data.eventos||[]).find(e=>e.presupuesto_id===bu.id); return <div key={bu.id} onClick={()=>setSelPresu(bu)} style={{
  background: T.card,
  border: `1px solid ${T.border}`,
  borderLeft: `6px solid ${s?.color||T.muted}`,
  borderRadius: 11,
  padding: "13px 15px",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  transition: "all 0.15s"
}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="translateY(0)";}}>
          <div style={{ fontSize:13,fontWeight:600,color:T.text,marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{bu.descripcion}</div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}><span style={{ fontSize:11,color:T.muted,fontWeight:500 }}>{c?.nombre||"Sin cliente"}</span><span style={{ fontSize:10,color:T.border }}>·</span><span style={{ fontSize:11,color:T.muted }}>{bu.averia_id?`Avería #${bu.averia_id}`:"Directo"}</span><BadgeProg fecha={evPr?.fecha}/></div>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:18,fontWeight:700,color:T.accent,fontFamily:"'Sora',sans-serif" }}>{bu.importe} €</span>
              <Badge status={bu.status} type="p"/>
              <span style={{ fontSize:11, color:T.muted, marginLeft:6 }}>{new Date(bu.created_at).toLocaleDateString("es-ES")}</span>
              {c?.telefono&&<a href={`https://wa.me/34${c.telefono.replace(/\s/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="15" height="15" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
              {c?.telefono&&<a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()} style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
              {(bu.direccion||c?.direccion)&&<button onClick={e=>{ e.stopPropagation(); openMaps(bu.direccion||c.direccion); }} style={{ width:30,height:30,borderRadius:7,background:T.accent+"22",border:"1.5px solid "+T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></button>}
            </div>
          </div>
        </div>; })}
      </div>
      {showNew&&<NuevoPresupuestoModal data={data} user={user} techs={(data.profiles||[]).filter(p=>p.activo!==false)} refresh={refresh} onClose={()=>setShowNew(false)}/>}
      {selPresu&&<PresupuestoDetalle pres={selPresu} data={data} user={user} refresh={()=>{ refresh?.(); setSelPresu(null); }} empresa={empresa} onClose={()=>setSelPresu(null)}/>}
    </div>
  );
}

/* ─── IMPORTAR EXCEL ─────────────────────────────────────────────────────── */
function ImportarExcelModal({ data, refresh, onClose }) {
  const isMobile = useIsMobile();
  const [paso, setPaso]               = useState(1);
  const [clienteFile, setClienteFile] = useState(null);
  const [xlsCols, setXlsCols]         = useState([]);
  const [xlsRows, setXlsRows]         = useState([]);   // preview 3 filas (display)
  const [xlsAllRows, setXlsAllRows]   = useState([]);   // todas las filas (import)
  const [map, setMap]                 = useState({ nombre:"", apellidos:"", telefono:"", telefonoFijo:"", email:"", direccion:"", ciudad:"", provincia:"", dni:"", notas:"" });
  const [equipoFile, setEquipoFile]   = useState(null);
  const [eqCols, setEqCols]           = useState([]);
  const [eqRows, setEqRows]           = useState([]);   // preview 3 filas (display)
  const [eqAllRows, setEqAllRows]     = useState([]);   // todas las filas (import)
  const [eqMap, setEqMap]             = useState({ clienteRef:"", nombre:"", marca:"", modelo:"", numero_serie:"", año_instalacion:"", direccion:"", ubicacion:"" });
  const [importing, setImporting]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [result, setResult]           = useState(null);
  const fileRef   = useRef();
  const eqFileRef = useRef();

  async function loadXlsx() {
    if(window.XLSX) return window.XLSX;
    return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload=()=>res(window.XLSX); s.onerror=rej; document.head.appendChild(s); });
  }

  async function parseFile(file) {
    const XLSX = await loadXlsx();
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, {type:"array"});
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
    const cols = rows.length > 0 ? rows[0].map(String) : [];
    return { cols, preview: rows.slice(1,4), allRows: rows.slice(1) };
  }

  function autoMapCols(cols, type) {
    const m = type === "cliente"
      ? { nombre:"", apellidos:"", telefono:"", telefonoFijo:"", email:"", direccion:"", ciudad:"", provincia:"", dni:"", notas:"" }
      : { clienteRef:"", nombre:"", marca:"", modelo:"", numero_serie:"", año_instalacion:"", direccion:"", ubicacion:"" };
    cols.forEach(c => {
      const cl = c.toLowerCase();
      if(type==="cliente") {
        if(!m.nombre       && (cl.includes("nombre")||cl.includes("razon")||cl.includes("razón")||cl.includes("name"))) m.nombre = c;
        if(!m.apellidos    && cl.includes("apellido")) m.apellidos = c;
        if(!m.telefono     && (cl.includes("móvil")||cl.includes("movil")||cl.includes("celular"))) m.telefono = c;
        if(!m.telefono     && (cl.includes("telef")||cl.includes("phone")) && !cl.includes("fijo")) m.telefono = c;
        if(!m.telefonoFijo && (cl.includes("fijo")||cl.includes("landline"))) m.telefonoFijo = c;
        if(!m.email        && (cl.includes("email")||cl.includes("mail")||cl.includes("correo"))) m.email = c;
        if(!m.direccion    && (cl.includes("direcc")||cl.includes("domicilio")||cl.includes("address")||cl.includes("calle"))) m.direccion = c;
        if(!m.ciudad       && (cl.includes("ciudad")||cl.includes("poblac")||cl.includes("municipio")||cl.includes("localidad"))) m.ciudad = c;
        if(!m.provincia    && (cl.includes("provincia")||cl.includes("region")||cl.includes("región")||cl.includes("comunidad"))) m.provincia = c;
        if(!m.dni          && (cl.includes("dni")||cl.includes("nif")||cl.includes("cif")||cl.includes("fiscal"))) m.dni = c;
        if(!m.notas        && (cl.includes("nota")||cl.includes("observ")||cl.includes("comment"))) m.notas = c;
      } else {
        if(!m.clienteRef      && (cl.includes("cliente")||cl.includes("titular")||cl.includes("propiet"))) m.clienteRef = c;
        if(!m.nombre          && (cl.includes("equipo")||cl.includes("aparato")||cl.includes("nombre"))) m.nombre = c;
        if(!m.marca           && cl.includes("marca")) m.marca = c;
        if(!m.modelo          && cl.includes("modelo")) m.modelo = c;
        if(!m.numero_serie    && (cl.includes("serie")||cl.includes("serial")||cl.includes("num"))) m.numero_serie = c;
        if(!m.año_instalacion && (cl.includes("año")||cl.includes("anio")||cl.includes("instalac")||cl.includes("fecha"))) m.año_instalacion = c;
        if(!m.direccion       && (cl.includes("direcc")||cl.includes("domicilio"))) m.direccion = c;
        if(!m.ubicacion       && (cl.includes("ubicac")||cl.includes("lugar")||cl.includes("zona"))) m.ubicacion = c;
      }
    });
    return m;
  }

  async function handleClienteFile(e) {
    const file = e.target.files[0]; if(!file) return;
    setClienteFile(file);
    const { cols, preview, allRows } = await parseFile(file);
    console.log(`[Importar] Archivo clientes: ${file.name} — ${allRows.length} filas de datos, ${cols.length} columnas`);
    setXlsCols(cols); setXlsRows(preview); setXlsAllRows(allRows);
    setMap(autoMapCols(cols,"cliente"));
  }

  async function handleEquipoFile(e) {
    const file = e.target.files[0]; if(!file) return;
    setEquipoFile(file);
    const { cols, preview, allRows } = await parseFile(file);
    console.log(`[Importar] Archivo equipos: ${file.name} — ${allRows.length} filas de datos, ${cols.length} columnas`);
    setEqCols(cols); setEqRows(preview); setEqAllRows(allRows);
    setEqMap(autoMapCols(cols,"equipo"));
  }

  function mappedClientes() {
    const idx = xlsCols.indexOf(map.nombre);
    return xlsAllRows.filter(r => idx>=0 && String(r[idx]||"").trim());
  }

  function getRow(row, cols, col) { return col ? String(row[cols.indexOf(col)]||"").trim() : ""; }

  function buildNombre(row) {
    const n = getRow(row, xlsCols, map.nombre);
    const a = map.apellidos ? getRow(row, xlsCols, map.apellidos) : "";
    return [n, a].filter(Boolean).join(" ");
  }
  function buildTelefono(row) { return getRow(row, xlsCols, map.telefono).replace(/\s/g,""); }
  function buildDireccion(row) {
    return [map.direccion, map.ciudad, map.provincia]
      .map(col => col ? getRow(row, xlsCols, col) : "")
      .filter(Boolean).join(", ");
  }
  function buildNotas(row) {
    const fijo  = map.telefonoFijo ? getRow(row,xlsCols,map.telefonoFijo).replace(/\s/g,"") : "";
    const extra = map.notas        ? getRow(row,xlsCols,map.notas)        : "";
    return [fijo?"Tel. fijo: "+fijo:"", extra].filter(Boolean).join(" | ") || null;
  }

  function previewClientes() {
    return mappedClientes().slice(0,5).map(row => ({
      nombre:   buildNombre(row),
      telefono: buildTelefono(row),
      email:    getRow(row, xlsCols, map.email),
      direccion:buildDireccion(row),
    }));
  }

  function previewEquipos() {
    if(!eqRows.length) return [];
    const idx = eqCols.indexOf(eqMap.nombre);
    return eqRows.filter(r=>idx>=0&&String(r[idx]||"").trim()).slice(0,5).map(row => ({
      nombre:     getRow(row, eqCols, eqMap.nombre),
      clienteRef: getRow(row, eqCols, eqMap.clienteRef),
      marca:      getRow(row, eqCols, eqMap.marca),
      modelo:     getRow(row, eqCols, eqMap.modelo),
    }));
  }

  async function ejecutarImportacion() {
    setImporting(true); setProgress(0);
    const BATCH = 50;
    const existentes = data.clientes || [];
    const byPhone  = {}; const byEmail = {}; const byNombre = {};
    existentes.forEach(c => {
      if(c.telefono) byPhone[c.telefono.replace(/\s/g,"")] = c.id;
      if(c.email)    byEmail[c.email.toLowerCase()] = c.id;
      byNombre[(c.nombre||"").toLowerCase()] = c.id;
    });

    const clienteRows = mappedClientes();
    console.log(`[Importar] Total filas con nombre válido: ${clienteRows.length} (existentes en BD: ${existentes.length})`);
    let importados = 0; let duplicados = 0; let incompletos = 0;

    for(let i=0; i<clienteRows.length; i+=BATCH) {
      const batch = clienteRows.slice(i,i+BATCH);
      const toInsert = [];
      batch.forEach(row => {
        const nombre   = buildNombre(row);
        const tel      = buildTelefono(row);
        const telefonoFijo = map.telefonoFijo ? getRow(row,xlsCols,map.telefonoFijo).replace(/\s/g,"") : "";
        const tieneNombre   = !!nombre;
        const tieneTelefono = !!(tel || telefonoFijo);
        const tieneDireccion= !!(buildDireccion(row));
        if(!tieneNombre || !tieneTelefono || !tieneDireccion) {
          console.log(`[Importar] Incompleto — nombre:"${nombre}" tel:"${tel||telefonoFijo}" dir:"${buildDireccion(row)}"`);
          incompletos++; return;
        }
        const email = getRow(row,xlsCols,map.email).toLowerCase();
        if((tel && byPhone[tel]) || (email && byEmail[email]) || byNombre[nombre.toLowerCase()]) { duplicados++; return; }
        const dniVal = map.dni ? getRow(row,xlsCols,map.dni) : "";
        toInsert.push({ nombre, telefono:tel||telefonoFijo||null, email:email||null, direccion:buildDireccion(row)||null, dni:dniVal||null, notas:buildNotas(row) });
      });
      console.log(`[Importar] Lote ${Math.floor(i/BATCH)+1}: ${toInsert.length} a insertar, ${batch.length-toInsert.length} duplicados en este lote`);
      if(toInsert.length>0) {
        const { data:ins, error } = await supabase.from("clientes").insert(toInsert).select("id,nombre,telefono,email");
        if(error) console.error(`[Importar] Error en lote ${Math.floor(i/BATCH)+1}:`, error);
        if(ins) { importados+=ins.length; ins.forEach(c=>{ if(c.telefono) byPhone[c.telefono.replace(/\s/g,"")]=c.id; if(c.email) byEmail[c.email.toLowerCase()]=c.id; byNombre[(c.nombre||"").toLowerCase()]=c.id; }); }
        console.log(`[Importar] Lote ${Math.floor(i/BATCH)+1} insertado: ${ins?.length??0} ok — acumulado: ${importados}`);
      }
      setProgress(Math.min(70, Math.round(((i+BATCH)/clienteRows.length)*70)));
    }

    let equiposImportados = 0; let equiposSinCliente = 0;
    if(eqAllRows.length>0 && eqMap.nombre) {
      const eqIdx = eqCols.indexOf(eqMap.nombre);
      const equipoRows = eqAllRows.filter(r=>eqIdx>=0&&String(r[eqIdx]||"").trim());
      console.log(`[Importar] Total filas de equipos con nombre válido: ${equipoRows.length}`);
      for(let i=0; i<equipoRows.length; i+=BATCH) {
        const batch = equipoRows.slice(i,i+BATCH);
        const toInsert = [];
        batch.forEach(row => {
          const ref = getRow(row,eqCols,eqMap.clienteRef);
          const refN = ref.toLowerCase().replace(/\s/g,"");
          let clienteId = byPhone[refN] || byEmail[refN] || null;
          if(!clienteId) { const k=Object.keys(byNombre).find(k=>k.includes(refN)||refN.includes(k)); if(k) clienteId=byNombre[k]; }
          if(!clienteId) { equiposSinCliente++; return; }
          const añoStr = getRow(row,eqCols,eqMap.año_instalacion);
          const año = añoStr ? parseInt(añoStr) : null;
          toInsert.push({ cliente_id:clienteId, nombre:getRow(row,eqCols,eqMap.nombre), marca:getRow(row,eqCols,eqMap.marca)||null, modelo:getRow(row,eqCols,eqMap.modelo)||null, numero_serie:getRow(row,eqCols,eqMap.numero_serie)||null, año_instalacion:(año&&!isNaN(año))?año:null, direccion:getRow(row,eqCols,eqMap.direccion)||null, ubicacion:getRow(row,eqCols,eqMap.ubicacion)||null });
        });
        if(toInsert.length>0) { const { error }=await supabase.from("equipos").insert(toInsert); if(!error) equiposImportados+=toInsert.length; }
        setProgress(70+Math.min(30,Math.round(((i+BATCH)/equipoRows.length)*30)));
      }
    }

    setProgress(100);
    setResult({ importados, duplicados, incompletos, equiposImportados, equiposSinCliente });
    setImporting(false);
    refresh?.();
  }

  const CL_CAMPOS = [
    {key:"nombre",      label:"Nombre",          required:true},
    {key:"apellidos",   label:"Apellidos",        info:"Se concatena al nombre con espacio"},
    {key:"telefono",    label:"Teléfono / Móvil", info:"Teléfono principal del cliente"},
    {key:"telefonoFijo",label:"Teléfono fijo",    info:"Se añade a las notas"},
    {key:"email",       label:"Email"},
    {key:"direccion",   label:"Dirección / Calle"},
    {key:"ciudad",      label:"Ciudad",           info:"Se añade tras la dirección"},
    {key:"provincia",   label:"Provincia",        info:"Se añade al final de la dirección"},
    {key:"dni",         label:"CIF / DNI",        info:"Se guarda en el campo DNI/NIF del cliente"},
    {key:"notas",       label:"Notas"},
  ];
  const EQ_CAMPOS = [
    {key:"clienteRef",label:"Cliente (referencia)",required:true},{key:"nombre",label:"Nombre equipo",required:true},
    {key:"marca",label:"Marca"},{key:"modelo",label:"Modelo"},{key:"numero_serie",label:"Nº serie"},
    {key:"año_instalacion",label:"Año instalación"},{key:"direccion",label:"Dirección"},{key:"ubicacion",label:"Ubicación"},
  ];

  const ColSel = ({value, onChange, cols, rows}) => {
    const exampleVal = value && rows?.length ? rows.map(r=>String(r[cols.indexOf(value)]||"").trim()).find(v=>v)||"" : "";
    return (
      <div>
        <select value={value} onChange={e=>onChange(e.target.value)} style={{...inp({padding:"7px 10px",fontSize:12}),width:"100%"}}>
          <option value="">— No importar —</option>
          {cols.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {exampleVal&&<div style={{fontSize:11,color:T.accent,marginTop:3,paddingLeft:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {exampleVal}</div>}
      </div>
    );
  };

  const PreviewTable = ({cols, rows}) => (
    <div style={{ overflowX:"auto",borderRadius:8,border:`1px solid ${T.border}`,marginTop:8 }}>
      <table style={{ borderCollapse:"collapse",width:"100%",fontSize:11 }}>
        <thead><tr style={{ background:T.surface }}>{cols.map(c=><th key={c} style={{ padding:"6px 10px",textAlign:"left",color:T.sub,fontWeight:600,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",maxWidth:120 }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=><tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>{cols.map((c,j)=><td key={j} style={{ padding:"5px 10px",color:T.text,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{String(row[j]||"")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

  if(result) return (
    <Modal onClose={onClose} w={480}>
      <MHead title="Importación completada" onClose={onClose}/>
      <div style={{ padding:"24px 28px 28px",display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ background:T.greenLight,border:"1px solid #bbf7d0",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start" }}>
          <span style={{ fontSize:28 }}></span>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:T.green,marginBottom:4 }}>Clientes</div>
            <div style={{ fontSize:13,color:T.text }}><strong>{result.importados}</strong> clientes importados correctamente</div>
            {result.duplicados>0&&<div style={{ fontSize:12,color:T.muted,marginTop:3 }}>{result.duplicados} duplicados saltados (ya existían)</div>}
            {result.incompletos>0&&<div style={{ fontSize:12,color:"#b45309",marginTop:3 }}>{result.incompletos} incompletos saltados (falta nombre, teléfono o dirección)</div>}
          </div>
        </div>
        {(result.equiposImportados>0||result.equiposSinCliente>0)&&(
          <div style={{ background:T.accentLight,border:"1px solid #bfdbfe",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start" }}>
            <span style={{ fontSize:28 }}></span>
            <div>
              <div style={{ fontSize:15,fontWeight:700,color:T.accent,marginBottom:4 }}>Equipos</div>
              <div style={{ fontSize:13,color:T.text }}><strong>{result.equiposImportados}</strong> equipos importados correctamente</div>
              {result.equiposSinCliente>0&&<div style={{ fontSize:12,color:T.muted,marginTop:3 }}>{result.equiposSinCliente} sin cliente encontrado (saltados)</div>}
            </div>
          </div>
        )}
        <div style={{ display:"flex",justifyContent:"flex-end" }}>
          <Btn ch="Cerrar" onClick={onClose}/>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} w={660}>
      <MHead title="Importar desde Excel" onClose={onClose}/>
      {/* Steps indicator */}
      <div style={{ padding:"14px 28px 0",display:"flex",alignItems:"center" }}>
        {[1,2,3,4].map((s,i)=>(
          <React.Fragment key={s}>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:paso>=s?T.accent:T.border,color:paso>=s?"#fff":T.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,transition:"all 0.2s" }}>{paso>s?"":s}</div>
              <span style={{ fontSize:9,color:paso>=s?T.accent:T.muted,fontWeight:paso===s?700:400,whiteSpace:"nowrap" }}>{["Archivo","Columnas","Equipos","Confirmar"][i]}</span>
            </div>
            {i<3&&<div style={{ flex:1,height:2,background:paso>s?T.accent:T.border,margin:"0 6px 18px",transition:"background 0.3s" }}/>}
          </React.Fragment>
        ))}
      </div>

      <div style={{ padding:"16px 28px 28px",display:"flex",flexDirection:"column",gap:16,maxHeight:"70vh",overflowY:"auto" }}>

        {/* PASO 1 */}
        {paso===1&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Sube un archivo Excel (.xlsx) o CSV con los datos de tus clientes. La primera fila debe contener los nombres de las columnas.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleClienteFile}/>
          <button onClick={()=>fileRef.current?.click()} style={{ padding:"32px",borderRadius:12,border:`2px dashed ${clienteFile?T.green:T.border}`,background:clienteFile?T.greenLight:"#fafafa",color:clienteFile?T.green:T.sub,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center",transition:"all 0.15s" }}>
            {clienteFile?`${clienteFile.name}`:"Haz clic para seleccionar archivo .xlsx o .csv"}
          </button>
          {xlsCols.length>0&&<div style={{ background:T.surface,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.sub }}><strong style={{ color:T.text }}>Columnas detectadas ({xlsCols.length}):</strong> {xlsCols.join(" · ")}</div>}
          <div style={{ display:"flex",justifyContent:"flex-end" }}>
            <Btn ch="Siguiente →" onClick={()=>setPaso(2)} disabled={xlsCols.length===0}/>
          </div>
        </>)}

        {/* PASO 2 */}
        {paso===2&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Indica qué columna del Excel corresponde a cada campo. Los campos marcados con * son obligatorios.</p>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10 }}>
            {CL_CAMPOS.map(f=>(
              <div key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:T.sub}}>{f.label}{f.required?" *":""}</label>
                <ColSel value={map[f.key]} onChange={v=>setMap(p=>({...p,[f.key]:v}))} cols={xlsCols} rows={xlsRows}/>
                {f.info&&<div style={{fontSize:10,color:T.muted,lineHeight:1.3}}>{f.info}</div>}
              </div>
            ))}
          </div>
          {xlsRows.length>0&&(<>
            <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em" }}>Vista previa del archivo (3 filas)</div>
            <PreviewTable cols={xlsCols} rows={xlsRows}/>
          </>)}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(1)} v="g"/>
            <Btn ch="Siguiente →" onClick={()=>setPaso(3)} disabled={!map.nombre}/>
          </div>
        </>)}

        {/* PASO 3 */}
        {paso===3&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Opcionalmente sube un archivo con los equipos de los clientes. La columna "Cliente" debe contener el nombre, teléfono o email del cliente para vincularlos.</p>
          <input ref={eqFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleEquipoFile}/>
          <button onClick={()=>eqFileRef.current?.click()} style={{ padding:"24px",borderRadius:12,border:`2px dashed ${equipoFile?T.green:T.border}`,background:equipoFile?T.greenLight:"#fafafa",color:equipoFile?T.green:T.sub,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center",transition:"all 0.15s" }}>
            {equipoFile?`${equipoFile.name}`:"Seleccionar archivo de equipos (opcional)"}
          </button>
          {eqCols.length>0&&(<>
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10 }}>
              {EQ_CAMPOS.map(f=>(
                <Field key={f.key} label={f.label+(f.required?" *":"")}>
                  <ColSel value={eqMap[f.key]} onChange={v=>setEqMap(p=>({...p,[f.key]:v}))} cols={eqCols}/>
                </Field>
              ))}
            </div>
            {eqRows.length>0&&(<>
              <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em" }}>Vista previa del archivo (3 filas)</div>
              <PreviewTable cols={eqCols} rows={eqRows}/>
            </>)}
          </>)}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(2)} v="g"/>
            <div style={{ display:"flex",gap:8 }}>
              <Btn ch="Saltar equipos" onClick={()=>setPaso(4)} v="g"/>
              <Btn ch="Siguiente →" onClick={()=>setPaso(4)}/>
            </div>
          </div>
        </>)}

        {/* PASO 4 */}
        {paso===4&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Revisa los datos antes de importar. Se saltarán automáticamente los clientes con teléfono, email o nombre completo duplicado.</p>
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:8 }}>
              Clientes a importar — <span style={{ color:T.accent }}>{mappedClientes().length} registros</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {previewClientes().map((c,i)=>(
                <div key={i} style={{ background:T.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
                  <span style={{ fontSize:13,fontWeight:600,color:T.text,minWidth:130 }}>{c.nombre||"—"}</span>
                  {c.telefono&&<span style={{ fontSize:12,color:T.sub }}>{c.telefono}</span>}
                  {c.email&&<span style={{ fontSize:12,color:T.sub }}>{c.email}</span>}
                  {c.direccion&&<span style={{ fontSize:11,color:T.muted,flex:1 }}>{c.direccion}</span>}
                </div>
              ))}
              {mappedClientes().length>5&&<div style={{ fontSize:11,color:T.muted,textAlign:"center" }}>… y {mappedClientes().length-5} más</div>}
            </div>
          </div>
          {previewEquipos().length>0&&(
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:8 }}>
                Equipos a importar — <span style={{ color:T.accent }}>{eqRows.filter(r=>{ const i=eqCols.indexOf(eqMap.nombre); return i>=0&&String(r[i]||"").trim(); }).length} registros</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {previewEquipos().map((e,i)=>(
                  <div key={i} style={{ background:"#eff6ff",borderRadius:8,padding:"8px 12px",border:"1px solid #bfdbfe",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
                    <span style={{ fontSize:13,fontWeight:600,color:T.accent,minWidth:130 }}>{e.nombre}</span>
                    <span style={{ fontSize:12,color:T.sub }}>→ {e.clienteRef||"sin cliente"}</span>
                    {e.marca&&<span style={{ fontSize:11,color:T.muted }}>{e.marca}{e.modelo?` · ${e.modelo}`:""}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {importing&&(
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:12,color:T.sub }}>Importando datos...</span>
                <span style={{ fontSize:12,fontWeight:700,color:T.accent }}>{progress}%</span>
              </div>
              <div style={{ background:T.border,borderRadius:99,height:8,overflow:"hidden" }}>
                <div style={{ background:T.accent,height:8,borderRadius:99,width:`${progress}%`,transition:"width 0.4s" }}/>
              </div>
            </div>
          )}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(3)} v="g" disabled={importing}/>
            <Btn ch={importing?"Importando...":"Importar ahora"} onClick={ejecutarImportacion} disabled={importing}/>
          </div>
        </>)}

      </div>
    </Modal>
  );
}

/* ─── CLIENTES ───────────────────────────────────────────────────────────── */
function ClientesList({ data, refresh, user }) {
  const isMobile=useIsMobile(); const [showNew,setShowNew]=useState(false); const [showImport,setShowImport]=useState(false); const [clienteSel,setClienteSel]=useState(null); const [form,setForm]=useState({nombre:"",telefono:"",email:"",direccion:""}); const [selAveria,setSelAveria]=useState(null); const [selPresu,setSelPresu]=useState(null); const [selAveriaGlobal,setSelAveriaGlobal]=useState(null); const [selPresuGlobal,setSelPresuGlobal]=useState(null); const [search,setSearch]=useState("");
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  async function borrarTodos(){
    const ok=window.confirm("¿Estás seguro? Se eliminarán TODOS los clientes y todos sus datos asociados (averías, presupuestos, equipos, contratos). Esta acción no se puede deshacer.");
    if(!ok) return;
    const steps=[
      "partes","notas_averias","fotos_averias","averias",
      "presupuestos","revisiones","instalaciones","instalaciones_obras",
      "equipos","eventos","mantenimientos","clientes",
    ];
    for(const tabla of steps){
      const {data:ids}=await supabase.from(tabla).select("id");
      if(!ids?.length){ console.log(`[BorrarTodos] "${tabla}" vacía, saltando`); continue; }
      let ok=true;
      for(let i=0;i<ids.length;i+=50){
        const lote=ids.slice(i,i+50).map(r=>r.id);
        const {error}=await supabase.from(tabla).delete().in("id",lote);
        if(error){ console.error(`[BorrarTodos] Error en "${tabla}" lote ${i}:`,error); ok=false; }
      }
      if(ok) console.log(`[BorrarTodos] "${tabla}" borrada OK (${ids.length} filas)`);
    }
    refresh?.();
  }

  async function add(){
    if(!form.nombre.trim()) return;
    // Check for duplicates
    if(form.telefono||form.email){
      const existing=(data.clientes||[]).find(c=>
        (form.telefono&&c.telefono&&c.telefono.replace(/\s/g,"")===form.telefono.replace(/\s/g,""))||
        (form.email&&c.email&&c.email.toLowerCase()===form.email.toLowerCase())
      );
      if(existing){
        const ok=window.confirm(`Ya existe un cliente con estos datos:\n"${existing.nombre}"\n\n¿Quieres crear uno nuevo de todas formas?`);
        if(!ok) return;
      }
    }
    const { error }=await supabase.from("clientes").insert([{...form}]); if(!error){ refresh?.(); setShowNew(false); setForm({nombre:"",telefono:"",email:"",direccion:""}); } else alert("Error: "+error.message); }
  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 3px",fontFamily:"'Sora',sans-serif" }}>Clientes</h1>
          <p style={{ color:T.muted,fontSize:12,margin:0 }}>{(data.clientes||[]).length} clientes en total</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          {user?.role==="admin"&&<Btn ch="Borrar todos" onClick={borrarTodos} v="d"/>}
          <Btn ch="Importar Excel" onClick={()=>setShowImport(true)} v="g"/>
          <button onClick={()=>_setTooltip("clientes")} title="Ayuda de Clientes" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
          <Btn ch="+ Nuevo cliente" onClick={()=>setShowNew(true)}/>
        </div>
      </div>
      {/* Buscador */}
      <div style={{ position:"relative", marginBottom:16 }}>
        <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono, email o dirección..." style={{...inp({paddingLeft:38})}} autoComplete="off"/>
        {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:18 }}>×</button>}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12 }}>
        {(data.clientes||[]).filter(c=>{
          if(!search||search.length<3) return true;
          const q=search.toLowerCase();
          return (c.nombre||"").toLowerCase().includes(q)||(c.telefono||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q)||(c.direccion||"").toLowerCase().includes(q)||((c.notas||"").toLowerCase().includes(q));
        }).map(c=>{ const bds=(data.averias||[]).filter(b=>b.cliente_id===c.id).length; const open=(data.averias||[]).filter(b=>b.cliente_id===c.id&&b.status!=="cerrada").length; const ins=(data.instalaciones||[]).filter(i=>i.cliente_id===c.id).length;
          return <div key={c.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"18px",cursor:"pointer",transition:"all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)";}} onClick={()=>setClienteSel(c)}>
            <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}><Ava name={c.nombre} size={40}/><div><div style={{ fontSize:13,fontWeight:600,color:T.text }}>{c.nombre}</div><div style={{ fontSize:11,color:T.muted }}>{c.telefono}</div><div style={{ fontSize:11,color:T.muted }}>{c.email}</div></div></div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}><span style={{ fontSize:11,color:T.sub,flex:1 }}>{c.direccion}</span><button onClick={e=>{e.stopPropagation();openMaps(c.direccion);}} style={{ padding:"3px 9px",borderRadius:6,border:"1.5px solid #bfdbfe",background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontWeight:600,marginLeft:8 }}>Ver ruta</button></div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}><span style={{ fontSize:10,padding:"2px 9px",borderRadius:20,background:T.accentLight,border:"1px solid #bfdbfe",color:T.accent,fontWeight:600 }}>{bds} averías</span>{open>0&&<span style={{ fontSize:10,padding:"2px 9px",borderRadius:20,background:T.redLight,border:"1px solid #fecaca",color:T.red,fontWeight:600 }}>{open} abiertas</span>}{ins>0&&<span style={{ fontSize:10,padding:"2px 9px",borderRadius:20,background:T.tealLight,border:`1px solid ${T.teal}28`,color:T.teal,fontWeight:600 }}>{ins} instalación{ins!==1?"es":""}</span>}</div>
          </div>; })}
      </div>
      {showImport&&<ImportarExcelModal data={data} refresh={()=>{ refresh?.(); setShowImport(false); }} onClose={()=>setShowImport(false)}/>}
      {showNew&&<Modal onClose={()=>setShowNew(false)} w={420}><MHead title="Nuevo cliente" onClose={()=>setShowNew(false)}/><div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:13 }}><Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Nombre o razón social"/></Field><Field label="DNI / NIF / CIF"><input value={form.dni||""} onChange={e=>upd("dni",e.target.value)} style={inp()} placeholder="12345678A (opcional)"/></Field><Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="6XX XXX XXX"/></Field><Field label="Email"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="correo@ejemplo.com"/></Field><Field label="Dirección"><input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Calle, número..."/></Field><div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}><Btn ch="Cancelar" onClick={()=>setShowNew(false)} v="g"/><Btn ch="Añadir cliente" onClick={add} disabled={!form.nombre.trim()}/></div></div></Modal>}
      {selAveriaGlobal&&<AveriaDetalle averia={selAveriaGlobal} data={data} user={user} techs={[]} empresa={{}} refresh={refresh} onClose={()=>setSelAveriaGlobal(null)}/>}
      {selPresuGlobal&&<PresupuestoDetalle pres={selPresuGlobal} data={data} user={user} refresh={refresh} empresa={{}} onClose={()=>setSelPresuGlobal(null)}/>}
      {clienteSel&&<ClienteDetalle cliente={clienteSel} data={data} refresh={refresh} onClose={()=>setClienteSel(null)} onSelectAveria={b=>{setClienteSel(null);setTimeout(()=>setSelAveriaGlobal(b),50);}} onSelectPresu={p=>{setClienteSel(null);setTimeout(()=>setSelPresuGlobal(p),50);}}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EQUIPOS — Historial de máquinas
   ══════════════════════════════════════════════════════════════════════════ */


function NuevoEquipoModal({ clienteId, instalacionId, onSave, onClose }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    nombre: "", tipo: "", marca: "", modelo: "",
    potencia: "", numero_serie: "", año_fabricacion: "",
    ubicacion: "", notas: "",
  });
  const [periodicidad, setPeriodicidad] = useState({
    mensual: false, trimestral: false, semestral: false, anual: false
  });
  const [proximas, setProximas] = useState({
    mensual: "", trimestral: "", semestral: "", anual: ""
  });
  const [checklist, setChecklist] = useState([]);
  const [nuevoItem, setNuevoItem] = useState("");
  const [saving, setSaving] = useState(false);

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // Al cambiar tipo de equipo carga checklist RITE automáticamente
  const onTipoChange = (tipo) => {
    upd("tipo", tipo);
    const items = RITE_CHECKLIST[tipo] || [];
    setChecklist(items.map(item => ({ texto: item, activo: true })));
  };

  const toggleItem = (i) => {
    setChecklist(p => p.map((it,idx) => idx===i ? {...it, activo:!it.activo} : it));
  };

  const addItem = () => {
    if(!nuevoItem.trim()) return;
    setChecklist(p => [...p, { texto: nuevoItem.trim(), activo: true }]);
    setNuevoItem("");
  };

  const removeItem = (i) => {
    setChecklist(p => p.filter((_,idx) => idx!==i));
  };

  const save = async () => {
    if(!form.nombre.trim()){ alert("El nombre del equipo es obligatorio"); return; }
    setSaving(true);
    const itemsGuardar = checklist.filter(it=>it.activo).map(it=>it.texto);
    const payload = {
      cliente_id: clienteId,
      instalacion_id: instalacionId||null,
      nombre: form.nombre,
      tipo: form.tipo||null,
      marca: form.marca||null,
      modelo: form.modelo||null,
      potencia: form.potencia||null,
      numero_serie: form.numero_serie||null,
      año_instalacion: form.año_fabricacion ? parseInt(form.año_fabricacion) : null,
      ubicacion: form.ubicacion||null,
      notas: form.notas||null,
      activa_mensual: periodicidad.mensual,
      activa_trimestral: periodicidad.trimestral,
      activa_semestral: periodicidad.semestral,
      activa_anual: periodicidad.anual,
      proxima_mensual: proximas.mensual||null,
      proxima_trimestral: proximas.trimestral||null,
      proxima_semestral: proximas.semestral||null,
      proxima_anual: proximas.anual||null,
      items_mensual: periodicidad.mensual ? itemsGuardar : [],
      items_trimestral: periodicidad.trimestral ? itemsGuardar : [],
      items_semestral: periodicidad.semestral ? itemsGuardar : [],
      items_anual: periodicidad.anual ? itemsGuardar : [],
    };
    const { error } = await supabase.from("equipos").insert([payload]);
    setSaving(false);
    if(error){ alert("Error: "+error.message); return; }
    onSave?.(); onClose();
  };

  return (
    <Modal onClose={onClose} w={600}>
      <MHead title="Nuevo equipo" onClose={onClose}/>
      <div style={{padding: isMobile?"14px":"20px 24px", display:"flex",
        flexDirection:"column", gap:14, maxHeight:"80vh", overflowY:"auto"}}>

        {/* Tipo de equipo */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>TIPO DE EQUIPO</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {TIPO_EQUIPO_OPTIONS.map(opt=>(
              <button key={opt.value} onClick={()=>onTipoChange(opt.value)}
                style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                  cursor:"pointer",border:`1.5px solid ${form.tipo===opt.value ? T.accent : T.border}`,
                  background: form.tipo===opt.value ? T.accentLight : T.surface,
                  color: form.tipo===opt.value ? T.accent : T.text}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datos del equipo */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOMBRE *</div>
            <input value={form.nombre} onChange={e=>upd("nombre",e.target.value)}
              placeholder="Ej: Caldera sala principal" style={inp()}/>
          </div>
          {[
            {k:"marca",l:"MARCA",pl:"Ej: Roca"},
            {k:"modelo",l:"MODELO",pl:"Ej: Condens Gold"},
            {k:"potencia",l:"POTENCIA (kW)",pl:"Ej: 24"},
            {k:"numero_serie",l:"Nº SERIE",pl:"Ej: ABC123456"},
            {k:"año_fabricacion",l:"AÑO FABRICACIÓN",pl:"Ej: 2018"},
            {k:"ubicacion",l:"UBICACIÓN",pl:"Ej: Sala de calderas"},
          ].map(f=>(
            <div key={f.k}>
              <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>{f.l}</div>
              <input value={form[f.k]} onChange={e=>upd(f.k,e.target.value)}
                placeholder={f.pl} style={inp()}/>
            </div>
          ))}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOTAS TÉCNICAS</div>
            <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)}
              placeholder="Observaciones técnicas..." style={{...inp(),minHeight:60}}/>
          </div>
        </div>

        {/* Periodicidad */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>PERIODICIDAD DE REVISIÓN</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {["mensual","trimestral","semestral","anual"].map(tipo=>{
              const mt = MT[tipo];
              const activa = periodicidad[tipo];
              return (
                <div key={tipo} style={{borderRadius:10,overflow:"hidden",
                  border:`1.5px solid ${activa ? mt.color+"60" : T.border}`}}>
                  <div onClick={()=>setPeriodicidad(p=>({...p,[tipo]:!p[tipo]}))}
                    style={{padding:"10px 14px",cursor:"pointer",
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      background: activa ? mt.color+"15" : T.surface}}>
                    <span style={{fontSize:13,fontWeight:600,
                      color: activa ? mt.color : T.text,textTransform:"capitalize"}}>{tipo}</span>
                    <div style={{width:36,height:20,borderRadius:10,position:"relative",
                      background: activa ? mt.color : T.border,transition:"all 0.2s"}}>
                      <div style={{position:"absolute",top:2,
                        left: activa ? 18 : 2,width:16,height:16,
                        borderRadius:"50%",background:"#fff",transition:"all 0.2s"}}/>
                    </div>
                  </div>
                  {activa && (
                    <div style={{padding:"10px 14px",background:T.card,
                      borderTop:`1px solid ${T.border}`}}>
                      <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Primera revisión</div>
                      <input type="date" value={proximas[tipo]}
                        onChange={e=>setProximas(p=>({...p,[tipo]:e.target.value}))}
                        style={inp()}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checklist */}
        {checklist.length>0 && (
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>
              CHECKLIST DE REVISIÓN — marca los que aplican
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {checklist.map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                  padding:"8px 12px",borderRadius:8,
                  background: item.activo ? T.accentLight : T.surface,
                  border:`1px solid ${item.activo ? T.accent+"40" : T.border}`}}>
                  <div onClick={()=>toggleItem(i)}
                    style={{width:18,height:18,borderRadius:4,flexShrink:0,cursor:"pointer",
                      border:`2px solid ${item.activo ? T.accent : T.border}`,
                      background: item.activo ? T.accent : "none",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {item.activo && <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline points="1,5 4,8 9,2" stroke="#fff" strokeWidth="2" fill="none"/>
                    </svg>}
                  </div>
                  <span style={{flex:1,fontSize:12,color: item.activo ? T.text : T.muted}}>
                    {item.texto}
                  </span>
                  <button onClick={()=>removeItem(i)}
                    style={{background:"none",border:"none",color:T.muted,
                      cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <input value={nuevoItem} onChange={e=>setNuevoItem(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addItem()}
                placeholder="Añadir ítem al checklist..."
                style={{...inp(),flex:1,fontSize:12}}/>
              <button onClick={addItem}
                style={{padding:"0 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontWeight:600}}>+</button>
            </div>
          </div>
        )}

        {form.tipo==="otro" && checklist.length===0 && (
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>
              CHECKLIST DE REVISIÓN
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={nuevoItem} onChange={e=>setNuevoItem(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addItem()}
                placeholder="Añadir ítem al checklist..."
                style={{...inp(),flex:1,fontSize:12}}/>
              <button onClick={addItem}
                style={{padding:"0 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontWeight:600}}>+</button>
            </div>
          </div>
        )}

        {/* Botón guardar */}
        <button onClick={save} disabled={saving}
          style={{padding:"12px",borderRadius:10,border:"none",
            background: saving ? T.border : T.accent,
            color:"#fff",cursor: saving?"not-allowed":"pointer",
            fontSize:14,fontWeight:700,marginTop:4}}>
          {saving ? "Guardando..." : "Guardar equipo"}
        </button>
      </div>
    </Modal>
  );
}

function EquipoDetalle({ equipo, data, refresh, onClose }) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...equipo, garantia_hasta:equipo.garantia_hasta||"", notas_tecnicas:equipo.notas_tecnicas||""});
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // Averías vinculadas directamente + partes asociados
  const averias = (data.averias||[]).filter(b=>
    b.equipo_id===equipo.id
  ).sort((a,b)=>b.id-a.id);
  
  // Revisiones del contrato si existe instalación para este equipo
  const revisiones = (data.revisiones||[]).filter(r=>
    (data.instalaciones||[]).find(i=>i.cliente_id===equipo.cliente_id && i.id===r.instalacion_id)
  ).sort((a,b)=>b.fecha?.localeCompare(a.fecha||"")||0).slice(0,5);

  async function save() {
    const { error } = await supabase.from("equipos").update({
      nombre:form.nombre, marca:form.marca, modelo:form.modelo,
      numero_serie:form.numero_serie, año_instalacion:form.año_instalacion?parseInt(form.año_instalacion):null,
      direccion:form.direccion, ubicacion:form.ubicacion, notas:form.notas,
      garantia_hasta:form.garantia_hasta||null, notas_tecnicas:form.notas_tecnicas||null,
    }).eq("id",equipo.id);
    if(!error) { refresh?.(); setEditing(false); }
    else alert("Error: "+error.message);
  }

  async function eliminar() {
    if(!window.confirm("¿Eliminar este equipo? No se pueden deshacer.")) return;
    await supabase.from("equipos").delete().eq("id",equipo.id);
    refresh?.(); onClose();
  }

  return (
    <Modal onClose={onClose} w={620}>
      <MHead title={equipo.nombre} sub={[equipo.marca,equipo.modelo].filter(Boolean).join(" · ")} onClose={onClose}/>
      <div style={{ padding:"18px 20px 22px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Info del equipo */}
        {!editing ? (
          <div style={{ background:T.surface, borderRadius:12, padding:"16px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              {[
                ["Marca", equipo.marca],
                ["Modelo", equipo.modelo],
                ["Nº serie", equipo.numero_serie],
                ["Año instalación", equipo.año_instalacion],
                ["Dirección", equipo.direccion],
                ["Ubicación", equipo.ubicacion],
              ].filter(([,v])=>v).map(([l,v])=>(
                <div key={l}>
                  <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13,color:T.text,fontWeight:500 }}>{v}</div>
                </div>
              ))}
            </div>
            {equipo.notas&&<div style={{ fontSize:13,color:T.sub,fontStyle:"italic",borderTop:`1px solid ${T.border}`,paddingTop:10 }}>{equipo.notas}</div>}
            {equipo.garantia_hasta && <Field label="Garantía hasta">{new Date(equipo.garantia_hasta).toLocaleDateString("es-ES")}</Field>}
            {equipo.notas_tecnicas && <Field label="Notas técnicas">{equipo.notas_tecnicas}</Field>}
            <div style={{ display:"flex",gap:8,marginTop:12 }}>
              <Btn ch="Editar" onClick={()=>setEditing(true)} v="g" sm/>
              <Btn ch="Eliminar equipo" onClick={eliminar} v="d" sm/>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()}/></Field>
              <Field label="Marca"><input value={form.marca||""} onChange={e=>upd("marca",e.target.value)} style={inp()}/></Field>
              <Field label="Modelo"><input value={form.modelo||""} onChange={e=>upd("modelo",e.target.value)} style={inp()}/></Field>
              <Field label="Nº serie"><input value={form.numero_serie||""} onChange={e=>upd("numero_serie",e.target.value)} style={inp()}/></Field>
              <Field label="Año"><input type="number" value={form.año_instalacion||""} onChange={e=>upd("año_instalacion",e.target.value)} style={inp()}/></Field>
            </div>
            <Field label="Dirección"><input value={form.direccion||""} onChange={e=>upd("direccion",e.target.value)} style={inp()}/></Field>
            <Field label="Ubicación"><input value={form.ubicacion||""} onChange={e=>upd("ubicacion",e.target.value)} style={inp()}/></Field>
            <Field label="Notas"><textarea value={form.notas||""} onChange={e=>upd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}}/></Field>
            <Field label="Garantía hasta">
              <input type="date" value={form.garantia_hasta} onChange={e=>setForm(p=>({...p,garantia_hasta:e.target.value}))} style={inp()}/>
            </Field>
            <Field label="Notas técnicas">
              <textarea value={form.notas_tecnicas} onChange={e=>setForm(p=>({...p,notas_tecnicas:e.target.value}))} style={{...inp(),minHeight:80}} placeholder="Observaciones técnicas del equipo"/>
            </Field>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <Btn ch="Cancelar" onClick={()=>setEditing(false)} v="g"/>
              <Btn ch="Guardar" onClick={save}/>
            </div>
          </div>
        )}

        {/* Timeline técnico */}
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,marginBottom:10}}>HISTORIAL TÉCNICO</div>
          {(()=>{
            const eventos = [
              ...(data.equipo_eventos||[]).filter(e=>e.equipo_id===equipo.id),
              ...(data.averias||[]).filter(a=>a.equipo_id===equipo.id).map(a=>({
                id:"av_"+a.id, tipo:"averia", titulo:a.descripcion,
                tecnico_nombre:a.tecnico_nombre||"", fecha:a.created_at,
                descripcion: "Estado: "+(BS[a.status]?.label||a.status||"")
              })),
              ...(data.mantenimientos||[]).filter(m=>m.equipo_id===equipo.id).map(m=>({
                id:"mt_"+m.id, tipo:"mantenimiento", titulo:m.descripcion,
                tecnico_nombre:m.tecnico_nombre||"", fecha:m.created_at,
                descripcion: "Estado: "+(MS[m.status]?.label||m.status||"")
              })),
              ...(data.presupuestos||[]).filter(p=>p.equipo_id===equipo.id).map(p=>({
                id:"pr_"+p.id, tipo:"presupuesto", titulo:p.descripcion,
                tecnico_nombre:"", fecha:p.created_at,
                descripcion: (PS[p.status]?.label||p.status||"")+(p.importe?" · "+p.importe.toFixed(2)+"€":"")
              })),
            ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

            if(eventos.length===0) return (
              <div style={{textAlign:"center",padding:"30px 20px",color:T.muted,fontSize:13,
                background:T.surface,borderRadius:10,border:`2px dashed ${T.border}`}}>
                Sin historial técnico registrado
              </div>
            );

            const cfg = {
              averia:        {color:T.red,    label:"Avería"},
              mantenimiento: {color:T.accent, label:"Mantenimiento"},
              presupuesto:   {color:T.purple, label:"Presupuesto"},
              parte:         {color:T.green,  label:"Parte"},
              observacion:   {color:T.muted,  label:"Observación"},
            };

            return eventos.map(ev=>{
              const c = cfg[ev.tipo]||{color:T.muted,label:ev.tipo};
              return (
                <div key={ev.id} style={{display:"flex",gap:12,marginBottom:12}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0,marginTop:4}}/>
                    <div style={{width:2,flex:1,background:T.border,marginTop:4}}/>
                  </div>
                  <div style={{flex:1,paddingBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div>
                        <span style={{fontSize:11,fontWeight:700,color:c.color}}>{c.label}</span>
                        {ev.tecnico_nombre && <span style={{fontSize:11,color:T.muted,marginLeft:8}}>{ev.tecnico_nombre}</span>}
                      </div>
                      <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>
                        {new Date(ev.fecha).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    {ev.titulo && <div style={{fontSize:13,color:T.text,marginTop:2,lineHeight:1.4}}>{ev.titulo}</div>}
                    {ev.descripcion && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{ev.descripcion}</div>}
                  </div>
                </div>
              );
            });
          })()}
        </div>

      </div>
    </Modal>
  );
}


function ClienteDetalle({ cliente, data, refresh, onClose, onSelectAveria, onSelectPresu, onSelectMant, onSelectInst }) {
  const isMobile=useIsMobile();
  const [tab,setTab]=useState("info");
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({...cliente});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));

  const averias=(data.averias||[]).filter(b=>b.cliente_id===cliente.id).sort((a,b)=>b.id-a.id);
  const presupuestos=(data.presupuestos||[]).filter(p=>p.cliente_id===cliente.id).sort((a,b)=>b.id-a.id);
  const instalaciones=(data.instalaciones||[]).filter(i=>i.cliente_id===cliente.id);
  const [selInst,setSelInst]=useState(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [partes, setPartes] = useState([]);
  const [loadingPartes, setLoadingPartes] = useState(false);

  const equipos=(data.equipos||[]).filter(e=>e.cliente_id===cliente.id);
  const [selEquipo,setSelEquipo]=useState(null);
  const [showNuevoEquipo,setShowNuevoEquipo]=useState(false);

  const historial = [
    ...averias.filter(a => ["cerrada","pendiente_facturar","facturado"].includes(a.status)).map(a => ({
      id: "av_"+a.id, tipo: "averia", fecha: a.created_at,
      descripcion: a.descripcion, estado: a.status,
      importe: (a.importe_mo||0)+(a.importe_materiales||0),
      ref: a
    })),
    ...(data.mantenimientos||[]).filter(m => m.cliente_id === cliente.id).filter(m => ["cerrado","pendiente_facturar","facturado"].includes(m.status)).map(m => ({
      id: "mt_"+m.id, tipo: "mantenimiento", fecha: m.created_at,
      descripcion: m.descripcion, estado: m.status,
      importe: (m.importe_mo||0)+(m.importe_materiales||0),
      ref: m
    })),
    ...presupuestos.filter(p => ["aceptado","rechazado"].includes(p.status)).map(p => ({
      id: "pr_"+p.id, tipo: "presupuesto", fecha: p.created_at,
      descripcion: p.descripcion, estado: p.status,
      importe: p.importe||0,
      ref: p
    })),
    ...(data.instalaciones_obras||[]).filter(i => i.cliente_id === cliente.id && ["pendiente_facturar","facturada"].includes(i.status)).map(i => ({
      id: "in_"+i.id, tipo: "instalacion", fecha: i.created_at,
      descripcion: i.descripcion||i.nombre, estado: i.status,
      importe: i.importe||0,
      ref: i
    })),
  ].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  const cargarPartes = async () => {
    setLoadingPartes(true);
    const idsAverias = averias.map(a => a.id);
    const idsMants = (data.mantenimientos||[]).filter(m => m.cliente_id === cliente.id).map(m => m.id);
    const idsObras = (data.instalaciones_obras||[]).filter(i => i.cliente_id === cliente.id).map(i => i.id);
    let q = supabase.from("partes").select("*");
    const ors = [];
    if(idsAverias.length) ors.push(`averia_id.in.(${idsAverias.join(",")})`);
    if(idsMants.length) ors.push(`mantenimiento_id.in.(${idsMants.join(",")})`);
    if(idsObras.length) ors.push(`instalacion_id.in.(${idsObras.join(",")})`);
    if(ors.length === 0) { setPartes([]); setLoadingPartes(false); return; }
    const { data: ps } = await q.or(ors.join(",")).order("created_at", { ascending: false });
    setPartes(ps||[]);
    setLoadingPartes(false);
  };

  const tabs=[
    {k:"info",     l:"Información"},
    {k:"averias",  l:`Averías (${averias.length})`},
    {k:"presu",    l:`Presupuestos (${presupuestos.length})`},
    {k:"equipos",  l:`Equipos (${equipos.length})`},
    {k:"contratos",l:`Contratos (${instalaciones.length})`},
  ];

  async function save(){
    const tipoPart=(form.notas||"").split("||TIPO:")[1]?.split("||")[0]||"";
    const { error }=await supabase.from("clientes").update({
      nombre:form.nombre, telefono:form.telefono||null, email:form.email||null, direccion:form.direccion||null,
      dni:form.dni||null,
      notas:tipoPart?`||TIPO:${tipoPart}||`:null,
    }).eq("id",cliente.id);
    if(!error){ refresh?.(); setEditing(false); }
    else alert("Error: "+error.message);
  }

  const dni=cliente.dni||"";
  const tipo=cliente.notas?.split("||TIPO:")[1]?.split("||")[0]||"";

  return (
    <Modal onClose={onClose} w={680}>
      {/* CABECERA */}
      <div style={{padding: isMobile?"16px 16px 12px":"20px 24px 16px", borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex", alignItems:"flex-start", gap:12, marginBottom:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:T.accentLight,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:16,fontWeight:700,color:T.accent,flexShrink:0}}>
            {(cliente.nombre||"?")[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:isMobile?16:18,color:T.text,lineHeight:1.2}}>
              {cliente.nombre}{cliente.apellidos?" "+cliente.apellidos:""}
            </div>
            {cliente.telefono && <div style={{fontSize:13,color:T.muted,marginTop:3}}>{cliente.telefono}</div>}
            {cliente.direccion && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{cliente.direccion}</div>}
            {cliente.email && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{cliente.email}</div>}
            {cliente.dni && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{cliente.dni}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",
            cursor:"pointer",color:T.muted,fontSize:20,padding:4,flexShrink:0}}>✕</button>
        </div>
        {/* Botones contacto */}
        <div style={{display:"flex",gap:8}}>
          {cliente.telefono && <>
            <a href={"https://wa.me/"+cliente.telefono.replace(/\D/g,"")}
              target="_blank" rel="noopener noreferrer"
              style={{width:36,height:36,borderRadius:9,background:T.greenLight,
                border:"1.5px solid "+T.green,display:"flex",alignItems:"center",
                justifyContent:"center",textDecoration:"none"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={T.green}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.021.502 3.927 1.385 5.604L0 24l6.545-1.371A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.032-1.387l-.361-.214-3.733.979.998-3.648-.235-.374A9.818 9.818 0 1112 21.818z"/>
              </svg>
            </a>
            <a href={"tel:"+cliente.telefono}
              style={{width:36,height:36,borderRadius:9,background:T.greenLight,
                border:"1.5px solid "+T.green,display:"flex",alignItems:"center",
                justifyContent:"center",textDecoration:"none"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </a>
          </>}
          {cliente.direccion && (
            <button onClick={()=>window.open("https://maps.google.com/?q="+encodeURIComponent(cliente.direccion),"_blank")}
              style={{width:36,height:36,borderRadius:9,background:T.accentLight,
                border:"1.5px solid "+T.accent+"40",display:"flex",alignItems:"center",
                justifyContent:"center",cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div style={{overflowY:"auto", padding: isMobile?"12px 16px 24px":"16px 24px 24px",
        display:"flex", flexDirection:"column", gap:16}}>

        {!editing && (
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowNuevoEquipo(true)}
              style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13,fontWeight:600}}>
              + Añadir equipo
            </button>
            <button onClick={()=>setTab("contratos")}
              style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13,fontWeight:600}}>
              + Añadir contrato
            </button>
          </div>
        )}

        {/* CONTADORES — averías, presupuestos, contratos */}
        {!editing && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              { label:"Averías", count: (data.averias||[]).filter(a=>a.cliente_id===cliente.id&&!["cerrada","facturado"].includes(a.status)).length, color:T.red, key:"averias" },
              { label:"Presupuestos", count: (data.presupuestos||[]).filter(p=>p.cliente_id===cliente.id&&["nuevo","enviado"].includes(p.status)).length, color:T.purple, key:"presu" },
              { label:"Contratos", count: instalaciones.length, color:T.accent, key:"contratos" },
            ].map(item=>(
              <div key={item.key} onClick={()=>setTab(item.key)}
                style={{background: tab===item.key ? item.color+"22" : T.surface,
                  border:`1.5px solid ${tab===item.key ? item.color : T.border}`,
                  borderRadius:12,padding:"14px 8px",textAlign:"center",cursor:"pointer",
                  transition:"all 0.15s"}}>
                <div style={{fontSize:isMobile?22:26,fontWeight:800,color:item.color,lineHeight:1}}>
                  {item.count}
                </div>
                <div style={{fontSize:11,color:T.muted,marginTop:4,fontWeight:600}}>{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑAS — solo cuando están activas */}
        {tab==="averias" && !editing && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,marginBottom:4}}>AVERÍAS ACTIVAS</div>
            {averias.filter(a=>!["cerrada","facturado"].includes(a.status)).length===0 ? (
              <div style={{textAlign:"center",padding:"20px",color:T.muted,fontSize:13,
                background:T.surface,borderRadius:10}}>Sin averías activas</div>
            ) : averias.filter(a=>!["cerrada","facturado"].includes(a.status)).map(a=>(
              <div key={a.id} onClick={()=>{onClose(); setTimeout(()=>onSelectAveria?.(a),50);}}
                style={{background:T.surface,borderRadius:10,padding:"12px 14px",
                  border:`1px solid ${T.border}`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.card}
                onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
                <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>{a.descripcion}</div>
                <div style={{fontSize:11,color:T.muted,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{padding:"1px 8px",borderRadius:20,background:T.red+"22",
                    color:T.red,fontWeight:600}}>{BS[a.status]?.label||a.status}</span>
                  <span>{new Date(a.created_at).toLocaleDateString("es-ES")}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="presu" && !editing && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,marginBottom:4}}>PRESUPUESTOS ACTIVOS</div>
            {presupuestos.filter(p=>["nuevo","enviado"].includes(p.status)).length===0 ? (
              <div style={{textAlign:"center",padding:"20px",color:T.muted,fontSize:13,
                background:T.surface,borderRadius:10}}>Sin presupuestos activos</div>
            ) : presupuestos.filter(p=>["nuevo","enviado"].includes(p.status)).map(p=>(
              <div key={p.id} onClick={()=>{onClose(); setTimeout(()=>onSelectPresu?.(p),50);}}
                style={{background:T.surface,borderRadius:10,padding:"12px 14px",
                  border:`1px solid ${T.border}`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.card}
                onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
                <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>{p.descripcion}</div>
                <div style={{fontSize:11,color:T.muted,display:"flex",gap:8,alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{padding:"1px 8px",borderRadius:20,background:T.purple+"22",
                    color:T.purple,fontWeight:600}}>{PS[p.status]?.label||p.status}</span>
                  {p.importe>0 && <span style={{fontWeight:700,color:T.text}}>{p.importe.toFixed(2)}€</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="contratos" && !editing && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,marginBottom:4}}>CONTRATOS ACTIVOS</div>
            {instalaciones.length===0 ? (
              <div style={{textAlign:"center",padding:"20px",color:T.muted,fontSize:13,
                background:T.surface,borderRadius:10}}>Sin contratos activos</div>
            ) : instalaciones.map(i=>(
              <div key={i.id} style={{background:T.surface,borderRadius:10,padding:"12px 14px",
                border:`1px solid ${T.border}`}}>
                <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:4}}>{i.nombre}</div>
                <div style={{fontSize:11,color:T.muted}}>{i.tipo||""}</div>
              </div>
            ))}
          </div>
        )}

        {/* DATOS DEL CLIENTE — edición */}
        {editing && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              {k:"nombre",l:"Nombre",pl:"Nombre del cliente"},
              {k:"telefono",l:"Teléfono",pl:"Teléfono"},
              {k:"email",l:"Email",pl:"Email",t:"email"},
              {k:"direccion",l:"Dirección",pl:"Dirección completa"},
              {k:"dni",l:"DNI/NIF",pl:"DNI o CIF"},
            ].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>{f.l}</div>
                <input type={f.t||"text"} value={form[f.k]||""} placeholder={f.pl}
                  onChange={e=>upd(f.k,e.target.value)} style={inp()}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>setEditing(false)}
                style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,
                  background:T.surface,color:T.text,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={save}
                style={{flex:1,padding:"10px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>Guardar</button>
            </div>
          </div>
        )}

        {/* INFO BÁSICA — visible cuando no está editando y no hay pestaña activa */}
        {!editing && tab==="info" && (
          <div style={{background:T.surface,borderRadius:10,padding:"12px 14px",
            border:`1px solid ${T.border}`}}>
            {cliente.email && <div style={{fontSize:13,color:T.text,marginBottom:6}}>
              <span style={{color:T.muted,fontSize:11,fontWeight:600}}>EMAIL </span>{cliente.email}
            </div>}
            {cliente.dni && <div style={{fontSize:13,color:T.text,marginBottom:6}}>
              <span style={{color:T.muted,fontSize:11,fontWeight:600}}>DNI/NIF </span>{cliente.dni}
            </div>}
            {cliente.notas && <div style={{fontSize:13,color:T.text}}>
              <span style={{color:T.muted,fontSize:11,fontWeight:600}}>NOTAS </span>{cliente.notas}
            </div>}
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        {!editing && (
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            <button onClick={()=>setEditing(true)}
              style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Editar datos
            </button>
            <button onClick={()=>setTab("equipos")}
              style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${T.accent}40`,
                background:T.accentLight,color:T.accent,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Historial equipos
            </button>
            <button onClick={()=>{ setShowHistorial(true); cargarPartes(); }}
              style={{padding:"8px 16px",borderRadius:8,border:"none",
                background:T.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
              Historial cliente
            </button>
            {cliente.portal_token ? (
              <button onClick={()=>{
                navigator.clipboard.writeText(window.location.origin+"/cliente/"+cliente.portal_token);
                alert("Enlace copiado");
              }} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13}}>
                Copiar enlace portal
              </button>
            ) : (
              <button onClick={async()=>{
                const token = crypto.randomUUID();
                await supabase.from("clientes").update({portal_token:token}).eq("id",cliente.id);
                refresh?.();
              }} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${T.accent}40`,
                background:T.accentLight,color:T.accent,cursor:"pointer",fontSize:13}}>
                Activar portal cliente
              </button>
            )}
            <button onClick={async()=>{
              if(!window.confirm("¿Eliminar cliente y todos sus datos?")) return;
              const id = cliente.id;
              await supabase.from("partes").delete().in("averia_id",(data.averias||[]).filter(a=>a.cliente_id===id).map(a=>a.id));
              await supabase.from("averias").delete().eq("cliente_id",id);
              await supabase.from("presupuestos").delete().eq("cliente_id",id);
              await supabase.from("revisiones").delete().eq("cliente_id",id);
              await supabase.from("instalaciones").delete().eq("cliente_id",id);
              await supabase.from("equipos").delete().eq("cliente_id",id);
              await supabase.from("eventos").delete().eq("cliente_id",id);
              await supabase.from("clientes").delete().eq("id",id);
              refresh?.(); onClose();
            }} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${T.red}40`,
              background:T.redLight,color:T.red,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Eliminar cliente
            </button>
          </div>
        )}
      </div>

      {/* Modales hijos */}
      {showNuevoEquipo && (
        <NuevoEquipoModal clienteId={cliente.id} onSave={()=>refresh?.()} onClose={()=>setShowNuevoEquipo(false)}/>
      )}
      {selEquipo && (
        <EquipoDetalle equipo={selEquipo} data={data} refresh={()=>{refresh?.();setSelEquipo(null);}} onClose={()=>setSelEquipo(null)}/>
      )}

      {/* Panel historial */}
      {showHistorial && (
        <div style={{position:"fixed",top:0,right:0,width:"min(420px,100vw)",height:"100vh",
          background:T.card,borderLeft:`1px solid ${T.border}`,zIndex:1100,
          display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px #0004"}}>
          <div style={{padding:"18px 20px",borderBottom:`1px solid ${T.border}`,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:16,color:T.text}}>Historial</div>
              <div style={{fontSize:12,color:T.muted}}>{cliente.nombre} {cliente.apellidos||""}</div>
            </div>
            <button onClick={()=>setShowHistorial(false)}
              style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:20}}>✕</button>
          </div>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12}}>
            {[
              {l:"Total facturado",v:historial.reduce((s,h)=>s+(h.importe||0),0)},
              {l:"Registros",v:historial.length}
            ].map(item=>(
              <div key={item.l} style={{flex:1,background:T.surface,borderRadius:10,
                padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,color:T.muted,marginBottom:4}}>{item.l}</div>
                <div style={{fontWeight:700,fontSize:15,color:T.text}}>
                  {typeof item.v==="number"&&item.l!=="Registros"?item.v.toFixed(2)+"€":item.v}
                </div>
              </div>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",
            flexDirection:"column",gap:10}}>
            {loadingPartes && <div style={{textAlign:"center",padding:20,color:T.muted,fontSize:13}}>Cargando...</div>}
            {!loadingPartes && historial.length===0 && (
              <div style={{textAlign:"center",color:T.muted,fontSize:13,marginTop:40}}>Sin registros históricos</div>
            )}
            {historial.map(h=>{
              const cfg={
                averia:{color:T.red,label:"Avería"},
                mantenimiento:{color:T.accent,label:"Mantenimiento"},
                presupuesto:{color:T.purple,label:"Presupuesto"},
                instalacion:{color:T.orange,label:"Instalación"},
              }[h.tipo];
              const estadoLabel=h.tipo==="averia"?(BS[h.estado]?.label||h.estado)
                :h.tipo==="mantenimiento"?(MS[h.estado]?.label||h.estado)
                :h.tipo==="presupuesto"?(PS[h.estado]?.label||h.estado)
                :h.estado||null;
              const partesVinculados=partes.filter(p=>
                (h.tipo==="averia"&&p.averia_id===h.ref.id)||
                (h.tipo==="mantenimiento"&&p.mantenimiento_id===h.ref.id)||
                (h.tipo==="instalacion"&&p.instalacion_id===h.ref.id)
              );
              const obraVinculada=h.tipo==="presupuesto"
                ?(data.instalaciones_obras||[]).find(o=>o.presupuesto_id===h.ref.id&&["pendiente_facturar","facturada"].includes(o.status))
                :null;
              const partesObra=obraVinculada?partes.filter(p=>p.instalacion_id===obraVinculada.id):[];
              return (
                <div key={h.id} style={{background:T.surface,borderRadius:12,padding:"14px 16px",
                  border:`1px solid ${T.border}`,cursor:"pointer"}}
                  onClick={()=>{
                    setShowHistorial(false);
                    if(h.tipo==="averia") onSelectAveria?.(h.ref);
                    else if(h.tipo==="presupuesto") onSelectPresu?.(h.ref);
                    else if(h.tipo==="mantenimiento") onSelectMant?.(h.ref);
                    else if(h.tipo==="instalacion") onSelectInst?.(h.ref);
                  }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:cfg.color,flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:700,color:cfg.color}}>{cfg.label}</span>
                      {estadoLabel&&<span style={{fontSize:11,padding:"1px 8px",borderRadius:20,
                        background:cfg.color+"22",color:cfg.color,fontWeight:600}}>{estadoLabel}</span>}
                    </div>
                    <span style={{fontSize:11,color:T.muted}}>{new Date(h.fecha).toLocaleDateString("es-ES")}</span>
                  </div>
                  <div style={{fontSize:13,color:T.text,lineHeight:1.4,
                    marginBottom:partesVinculados.length||obraVinculada?10:0}}>
                    {h.descripcion||"Sin descripción"}
                  </div>
                  {h.importe>0&&partesVinculados.length===0&&!obraVinculada&&(
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{h.importe.toFixed(2)}€</div>
                  )}
                  {partesVinculados.map(p=>(
                    <div key={p.id} onClick={e=>e.stopPropagation()}
                      style={{marginTop:8,paddingLeft:16,borderLeft:`2px solid ${T.border}`}}>
                      <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:4}}>
                        Parte — {p.fecha?new Date(p.fecha).toLocaleDateString("es-ES"):""}{p.tecnico_nombre?" · "+p.tecnico_nombre:""}
                      </div>
                      {p.trabajo&&<div style={{fontSize:12,color:T.text,lineHeight:1.4,marginBottom:4}}>{p.trabajo}</div>}
                      {p.observaciones&&<div style={{fontSize:11,color:T.muted,marginBottom:4}}>{p.observaciones}</div>}
                      {(p.materiales||[]).length>0&&(
                        <div style={{fontSize:11,color:T.muted,marginBottom:4}}>
                          <span style={{fontWeight:600}}>Materiales: </span>
                          {p.materiales.map(m=>`${m.desc||m.nombre||""} x${m.qty||m.cantidad||1}`).join(" · ")}
                        </div>
                      )}
                      <div style={{display:"flex",gap:12,fontSize:12,marginTop:4}}>
                        {p.importe_mo>0&&<span style={{color:T.muted}}>MO: <b style={{color:T.text}}>{p.importe_mo.toFixed(2)}€</b></span>}
                        {p.importe_materiales>0&&<span style={{color:T.muted}}>Mat: <b style={{color:T.text}}>{p.importe_materiales.toFixed(2)}€</b></span>}
                        {p.importe_total>0&&<span style={{color:T.accent,fontWeight:700}}>{p.importe_total.toFixed(2)}€</span>}
                      </div>
                    </div>
                  ))}
                  {obraVinculada&&(
                    <div style={{marginTop:8,paddingLeft:16,borderLeft:`2px solid ${T.orange}44`}}>
                      <div style={{fontSize:11,fontWeight:600,color:T.orange,marginBottom:4}}>
                        Instalación vinculada — {obraVinculada.status||""}
                      </div>
                      {obraVinculada.descripcion&&<div style={{fontSize:12,color:T.text,marginBottom:4}}>{obraVinculada.descripcion}</div>}
                      {partesObra.map(p=>(
                        <div key={p.id} style={{marginTop:6,paddingLeft:12,borderLeft:`2px solid ${T.border}`}}>
                          <div style={{fontSize:11,fontWeight:600,color:T.muted,marginBottom:2}}>
                            Parte — {p.fecha?new Date(p.fecha).toLocaleDateString("es-ES"):""}{p.tecnico_nombre?" · "+p.tecnico_nombre:""}
                          </div>
                          {p.trabajo&&<div style={{fontSize:12,color:T.text,lineHeight:1.4,marginBottom:4}}>{p.trabajo}</div>}
                          {(p.materiales||[]).length>0&&(
                            <div style={{fontSize:11,color:T.muted,marginBottom:4}}>
                              <span style={{fontWeight:600}}>Materiales: </span>
                              {p.materiales.map(m=>`${m.desc||m.nombre||""} x${m.qty||m.cantidad||1}`).join(" · ")}
                            </div>
                          )}
                          <div style={{display:"flex",gap:12,fontSize:12,marginTop:4}}>
                            {p.importe_mo>0&&<span style={{color:T.muted}}>MO: <b style={{color:T.text}}>{p.importe_mo.toFixed(2)}€</b></span>}
                            {p.importe_materiales>0&&<span style={{color:T.muted}}>Mat: <b style={{color:T.text}}>{p.importe_materiales.toFixed(2)}€</b></span>}
                            {p.importe_total>0&&<span style={{color:T.accent,fontWeight:700}}>{p.importe_total.toFixed(2)}€</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}


function ClienteSelector({ clientes, value, onChange, onNewCliente }) {
  const [modo, setModo] = useState("existente");
  const [form, setForm] = useState({ nombre:"", telefono:"", email:"", direccion:"" });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Cliente</div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[{k:"existente",l:"Cliente existente"},{k:"nuevo",l:"+ Nuevo cliente"}].map(o=>(
          <button key={o.k} onClick={()=>{ setModo(o.k); if(o.k==="nuevo") onChange(""); }} style={{ padding:"5px 13px",borderRadius:20,border:`1.5px solid ${modo===o.k?T.accent:T.border}`,background:modo===o.k?T.accent+"22":T.card,color:modo===o.k?T.accent:T.sub,fontSize:11,fontWeight:modo===o.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{o.l}</button>
        ))}
      </div>
      {modo==="existente" ? (
        <select value={value} onChange={e=>onChange(e.target.value)} style={inp()}>
          <option value="">— Selecciona cliente —</option>
          {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Nombre o empresa"/></Field>
            <Field label="DNI / NIF / CIF"><input value={form.dni||""} onChange={e=>upd("dni",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="12345678A"/></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="6XX XXX XXX"/></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="correo@ejemplo.com"/></Field>
          </div>
          <Field label="Dirección"><input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Calle, número, piso..."/></Field>
          {form.nombre.trim() && (
            <Btn ch="Crear y seleccionar" onClick={()=>onNewCliente(form)} v="s"/>
          )}
        </div>
      )}
    </div>
  );
}

// Buscador de cliente con autocompletado + formulario inline de nuevo cliente
// Misma UX que NuevoAvisoModal. onSelect(id, cliente), onDeselect(), onCreated(nc)
function ClienteBuscadorField({ clientes, clienteId, onSelect, onDeselect, onCreated, refresh }) {
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

/* ─── CALENDARIO ─────────────────────────────────────────────────────────── */
function CalendarView({ data, user, refresh }) {
  const isMobile = useIsMobile();
  const now = new Date();
  const pad = n => String(n).padStart(2,"0");
  const todayDS = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState("month");
  const [weekStart, setWeekStart] = useState(()=>{ const d=new Date(now); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); return d; });
  const [selDay, setSelDay]   = useState(null);
  const [popover, setPopover] = useState(null);
  const [showEv, setShowEv]   = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [mobilePanelDay, setMobilePanelDay]   = useState(null);
  const [showReprog, setShowReprog] = useState(null);
  const [reprogDate, setReprogDate] = useState("");
  const [savingReprog, setSavingReprog] = useState(false);

  const DOW    = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const ET = {
    instalacion:      { label:"Instalación",  color:"#16a34a" },
    revision:         { label:"Revisión",     color:"#d97706" },
    averia_programada:{ label:"Avería",       color:"#dc2626" },
    mantenimiento:    { label:"Mantenimiento",color:"#2563eb" },
    otro:             { label:"Otro",         color:"#7c3aed" },
  };

  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  function getEvs(dateStr) {
    if(!dateStr) return [];
    return (data.eventos||[])
      .filter(e=>e.fecha===dateStr)
      .map(e=>({...e, _t:"ev", _color:e.color||ET[e.tipo]?.color||T.accent}));
  }

  // Month grid
  const prefix = `${year}-${pad(month+1)}`;
  const daysInMonth = new Date(year,month+1,0).getDate();
  let sdow = new Date(year,month,1).getDay(); sdow = sdow===0?6:sdow-1;
  const cells = Array.from({length:Math.ceil((sdow+daysInMonth)/7)*7},(_,i)=>{ const d=i-sdow+1; return(d>=1&&d<=daysInMonth)?d:null; });

  // Week grid
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d; });

  function prevNav() {
    if(viewMode==="week"){ const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
    else{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  }
  function nextNav() {
    if(viewMode==="week"){ const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }
    else{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
  }

  const emptyEForm = {tipo:"instalacion",titulo:"",clienteId:"",direccion:"",fecha:"",tecnicoId:"",notas:""};
  const [eForm, setEForm] = useState(emptyEForm);
  const eUpd = (k,v)=>{ const n={...eForm,[k]:v}; if(k==="clienteId"){const c=cl(v); n.direccion=c?.direccion||"";} setEForm(n); };
  const closeEv = ()=>{ setShowEv(false); setEForm(emptyEForm); };

  async function addEvento() {
    if(!eForm.titulo.trim()||!eForm.fecha) return;
    const payload = { tipo:eForm.tipo, titulo:eForm.titulo, cliente_id:eForm.clienteId||null, direccion:eForm.direccion, fecha:eForm.fecha, tecnico_id:eForm.tecnicoId||null, notas:eForm.notas, color:ET[eForm.tipo]?.color||T.accent };
    const {error} = eForm.editId
      ? await supabase.from("eventos").update(payload).eq("id",eForm.editId)
      : await supabase.from("eventos").insert([payload]);
    if(!error){ refresh?.(); closeEv(); } else alert("Error: "+error.message);
  }

  async function delEvento(id) { await supabase.from("eventos").delete().eq("id",id); refresh?.(); setPopover(null); setSelDay(null); }

  async function reprogramar() {
    if(!reprogDate||!showReprog) return;
    setSavingReprog(true);
    await supabase.from("eventos").update({fecha:reprogDate}).eq("id",showReprog.id);
    refresh?.(); setShowReprog(null); setPopover(null); setSavingReprog(false);
  }

  function openNewEv(dateStr) {
    if(isMobile){ setMobilePanelDay(dateStr); setShowMobilePanel(true); }
    else{ setEForm({...emptyEForm, fecha:dateStr}); setShowEv(true); }
  }

  function handleEvClick(e, ev) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ ev, x:rect.left, y:rect.bottom+8 });
  }

  // ── Pill component
  function Pill({ ev, onClick, dot }) {
    if(dot) return <div style={{ width:7,height:7,borderRadius:"50%",background:ev._color,flexShrink:0 }}/>;
    return (
      <div onClick={e=>onClick&&onClick(e,ev)}
        style={{ padding:"2px 6px",borderRadius:4,background:ev._color+"22",color:ev._color,fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",border:`1px solid ${ev._color}33` }}>
        {ev.titulo}
      </div>
    );
  }

  // ── Event card for sidebar / panel
  function EvCard({ ev, onReprog }) {
    const c = cl(ev.cliente_id);
    return (
      <div style={{ background:T.surface,borderRadius:9,padding:"10px 13px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${ev._color}` }}>
        <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:c?3:6 }}>{ev.titulo}</div>
        {c&&<div style={{ fontSize:11,color:T.muted,marginBottom:6 }}>{c.nombre}</div>}
        {ev.direccion&&<button onClick={()=>openMaps(ev.direccion)} style={{ padding:"3px 9px",borderRadius:6,border:"1.5px solid #bfdbfe",background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontWeight:600,display:"block",marginBottom:7 }}>Cómo llegar</button>}
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <button onClick={onReprog} style={{ padding:"4px 11px",borderRadius:7,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Reprogramar</button>
          {user.role==="admin"&&<>
            <button onClick={()=>{ setEForm({tipo:ev.tipo||"instalacion",titulo:ev.titulo,clienteId:ev.cliente_id||"",direccion:ev.direccion||"",fecha:ev.fecha,tecnicoId:ev.tecnico_id||"",notas:ev.notas||"",editId:ev.id}); setShowEv(true); }} style={{ background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",padding:0,fontWeight:600 }}>Editar</button>
            <button onClick={()=>delEvento(ev.id)} style={{ background:"none",border:"none",color:T.red,fontSize:11,cursor:"pointer",padding:0 }}>Eliminar</button>
          </>}
        </div>
      </div>
    );
  }

  const navTitle = viewMode==="month"
    ? `${MONTHS[month]} ${year}`
    : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  return (
    <div style={{ padding:isMobile?12:28 }}>

      {/* ── Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Calendario</h1>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <div style={{ display:"flex",borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden" }}>
            {[["month","Mes"],["week","Semana"]].map(([k,l])=>(
              <button key={k} onClick={()=>setViewMode(k)}
                style={{ padding:"6px 14px",border:`1px solid ${viewMode===k?T.accent:T.border}`,background:viewMode===k?T.accent+"22":T.card,color:viewMode===k?T.accent:T.sub,fontSize:12,fontWeight:viewMode===k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{l}</button>
            ))}
          </div>
          {user.role==="admin"&&<Btn ch="+ Evento" onClick={()=>{ setEForm({...emptyEForm,fecha:todayDS}); setShowEv(true); }}/>}
        </div>
      </div>

      {/* ── Nav bar */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,background:T.card,borderRadius:10,padding:"10px 16px",border:`1px solid ${T.border}` }}>
        <button onClick={prevNav} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:isMobile?26:20,padding:"0 10px",fontWeight:700,lineHeight:1 }}>‹</button>
        <button onClick={()=>{ setYear(now.getFullYear()); setMonth(now.getMonth()); const d=new Date(now); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); setWeekStart(d); }}
          style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif",background:"none",border:"none",cursor:"pointer" }}>
          {navTitle}
        </button>
        <button onClick={nextNav} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:isMobile?26:20,padding:"0 10px",fontWeight:700,lineHeight:1 }}>›</button>
      </div>

      <div style={{ display:"flex",gap:18,flexDirection:isMobile?"column":"row",alignItems:"flex-start" }}>
        <div style={{ flex:1,minWidth:0 }}>

          {/* ══ VISTA MENSUAL ══ */}
          {viewMode==="month"&&(<>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr",gap:2,marginBottom:2 }}>
              {DOW.map((d,i)=><div key={d} style={{ textAlign:"center",fontSize:i>=5?9:11,fontWeight:700,color:i>=5?T.muted:T.sub,padding:"6px 0",textTransform:"uppercase",letterSpacing:"0.05em" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr",gap:2 }}>
              {cells.map((d,i)=>{
                const isWe = i%7>=5;
                const ds   = d?`${prefix}-${pad(d)}`:null;
                const isToday = ds===todayDS;
                const isSel   = ds===selDay;
                const evs  = getEvs(ds);
                const shown = evs.slice(0,isMobile?0:3);
                const extra = evs.length-shown.length;
                return (
                  <div key={i}
                    onClick={()=>{ if(!d) return; if(isMobile){setMobilePanelDay(ds);setShowMobilePanel(true);}else setSelDay(ds===selDay?null:ds); }}
                    onMouseEnter={e=>{ if(d) e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; }}
                    style={{ minHeight:isMobile?52:80,borderRadius:8,padding:isMobile?"4px":"6px 6px 4px",background:!d?"transparent":isSel?"#eff6ff":isWe?T.bg:T.card,border:`1px solid ${isSel?T.accent:isToday?T.accent+"80":d?T.border:"transparent"}`,cursor:d?"pointer":"default",position:"relative",overflow:"hidden",transition:"box-shadow 0.15s" }}>
                    {d&&<>
                      {isToday&&<div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:T.accent,borderRadius:"8px 8px 0 0" }}/>}
                      <div style={{ fontSize:isMobile?10:12,fontWeight:isToday?700:500,color:isToday?T.accent:T.text,marginBottom:isMobile?2:4,marginTop:isToday?4:0 }}>{d}</div>
                      {isMobile?(
                        <div style={{ display:"flex",gap:2,flexWrap:"wrap" }}>
                          {evs.slice(0,5).map((ev,j)=><Pill key={j} ev={ev} dot/>)}
                          {evs.length>5&&<div style={{ width:6,height:6,borderRadius:"50%",background:T.muted }}/>}
                        </div>
                      ):(
                        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                          {shown.map((ev,j)=><Pill key={j} ev={ev} onClick={handleEvClick}/>)}
                          {extra>0&&<div style={{ fontSize:9,color:T.muted,fontWeight:600,paddingLeft:2 }}>+{extra} más</div>}
                        </div>
                      )}
                    </>}
                  </div>
                );
              })}
            </div>
          </>)}

          {/* ══ VISTA SEMANAL ══ */}
          {viewMode==="week"&&(
            <div style={{ overflowX:"auto" }}>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
                {weekDays.map((d,i)=>{
                  const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                  const isToday = ds===todayDS;
                  const isSel   = ds===selDay;
                  const dow = d.getDay();
                  const isWe = dow===0||dow===6;
                  const evs = getEvs(ds);
                  return (
                    <div key={i} style={{ borderRadius:10,overflow:"hidden",border:`1px solid ${isSel?T.accent:isToday?T.accent+"80":T.border}`,background:isWe?T.bg:T.card }}>
                      <div onClick={()=>setSelDay(ds===selDay?null:ds)}
                        style={{ padding:"8px 8px 6px",textAlign:"center",background:isToday?T.accentLight:isWe?T.surface:T.card,borderBottom:`2px solid ${isToday?T.accent:T.border}`,cursor:"pointer" }}>
                        <div style={{ fontSize:9,fontWeight:700,color:isWe?T.muted:T.sub,textTransform:"uppercase" }}>{DOW[i===6?6:i]}</div>
                        <div style={{ fontSize:16,fontWeight:isToday?800:500,color:isToday?T.accent:T.text }}>{d.getDate()}</div>
                      </div>
                      <div style={{ padding:"6px 4px",display:"flex",flexDirection:"column",gap:3,minHeight:120 }}
                        onClick={()=>{ if(evs.length===0) openNewEv(ds); }}>
                        {evs.map((ev,j)=><Pill key={j} ev={ev} onClick={handleEvClick}/>)}
                        {evs.length===0&&<div style={{ fontSize:9,color:T.border,textAlign:"center",paddingTop:30 }}>+</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop sidebar */}
        {!isMobile&&selDay&&(
          <div style={{ width:260,flexShrink:0 }}>
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",position:"sticky",top:20 }}>
              <div style={{ padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div style={{ fontSize:12,fontWeight:600,color:T.sub }}>{new Date(selDay+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
                <button onClick={()=>setSelDay(null)} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:16 }}>×</button>
              </div>
              <div style={{ padding:"12px",display:"flex",flexDirection:"column",gap:8 }}>
                {getEvs(selDay).length===0?(
                  <div>
                    <p style={{ color:T.muted,fontSize:12,margin:"0 0 10px" }}>Sin eventos este día.</p>
                    {user.role==="admin"&&<Btn ch="+ Crear evento" onClick={()=>openNewEv(selDay)} sm/>}
                  </div>
                ):(
                  <>
                    {getEvs(selDay).map((ev,i)=>(
                      <EvCard key={i} ev={ev} onReprog={()=>{ setReprogDate(selDay); setShowReprog(ev); }}/>
                    ))}
                    {user.role==="admin"&&<Btn ch="+ Añadir evento" onClick={()=>openNewEv(selDay)} v="g" sm/>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Popover */}
      {popover&&(<>
        <div onClick={()=>setPopover(null)} style={{ position:"fixed",inset:0,zIndex:199 }}/>
        <div style={{ position:"fixed",left:Math.min(popover.x,window.innerWidth-280),top:Math.min(popover.y,window.innerHeight-200),zIndex:200,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:"0 8px 30px rgba(0,0,0,0.15)",padding:"14px 16px",width:264 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{popover.ev.titulo}</div>
              {cl(popover.ev.cliente_id)&&<div style={{ fontSize:11,color:T.muted,marginTop:2 }}>{cl(popover.ev.cliente_id)?.nombre}</div>}
            </div>
            <button onClick={()=>setPopover(null)} style={{ background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",padding:0,flexShrink:0 }}>×</button>
          </div>
          <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
            <button onClick={()=>{ setReprogDate(popover.ev.fecha||""); setShowReprog(popover.ev); setPopover(null); }}
              style={{ padding:"5px 12px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>
              Reprogramar
            </button>
            {user.role==="admin"&&<>
              <button onClick={()=>{ setEForm({tipo:popover.ev.tipo||"instalacion",titulo:popover.ev.titulo,clienteId:popover.ev.cliente_id||"",direccion:popover.ev.direccion||"",fecha:popover.ev.fecha,tecnicoId:popover.ev.tecnico_id||"",notas:popover.ev.notas||"",editId:popover.ev.id}); setShowEv(true); setPopover(null); }}
                style={{ padding:"5px 12px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.card,color:T.accent,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Editar</button>
              <button onClick={()=>delEvento(popover.ev.id)}
                style={{ padding:"5px 12px",borderRadius:8,border:"1.5px solid #fecaca",background:"#fff5f5",color:T.red,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Eliminar</button>
            </>}
          </div>
        </div>
      </>)}

      {/* ── Mobile bottom panel */}
      {isMobile&&showMobilePanel&&mobilePanelDay&&(<>
        <div onClick={()=>setShowMobilePanel(false)} style={{ position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,0.45)" }}/>
        <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 20px 44px",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.22)" }}>
          <div style={{ width:44,height:5,borderRadius:3,background:T.border,margin:"0 auto 16px" }}/>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>
            {new Date(mobilePanelDay+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
          </div>
          {getEvs(mobilePanelDay).length===0?(
            <div>
              <p style={{ color:T.muted,fontSize:13,margin:"0 0 14px" }}>Sin eventos este día.</p>
              {user.role==="admin"&&<Btn ch="+ Crear evento" onClick={()=>{ setShowMobilePanel(false); setEForm({...emptyEForm,fecha:mobilePanelDay}); setShowEv(true); }}/>}
            </div>
          ):(
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {getEvs(mobilePanelDay).map((ev,i)=>(
                <EvCard key={i} ev={ev} onReprog={()=>{ setReprogDate(mobilePanelDay); setShowReprog(ev); setShowMobilePanel(false); }}/>
              ))}
              {user.role==="admin"&&<Btn ch="+ Añadir evento" onClick={()=>{ setShowMobilePanel(false); setEForm({...emptyEForm,fecha:mobilePanelDay}); setShowEv(true); }} v="g"/>}
            </div>
          )}
        </div>
      </>)}

      {/* ── Reprogramar modal */}
      {showReprog&&(
        <Modal onClose={()=>setShowReprog(null)} w={360}>
          <MHead title="Reprogramar" onClose={()=>setShowReprog(null)}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,borderLeft:`3px solid ${showReprog._color}`,paddingLeft:10 }}>{showReprog.titulo}</div>
            <Field label="Nueva fecha *"><input type="date" value={reprogDate} onChange={e=>setReprogDate(e.target.value)} style={inp()}/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setShowReprog(null)} v="g"/>
              <Btn ch={savingReprog?"Guardando...":"Guardar"} onClick={reprogramar} disabled={savingReprog||!reprogDate}/>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Nuevo / Editar evento modal */}
      {showEv&&(
        <Modal onClose={closeEv} w={480}>
          <MHead title={eForm.editId?"Editar evento":"Nuevo evento"} onClose={closeEv}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:13 }}>
            <Field label="Tipo"><select value={eForm.tipo} onChange={e=>eUpd("tipo",e.target.value)} style={inp()}>{Object.entries(ET).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}</select></Field>
            <Field label="Título *"><input value={eForm.titulo} onChange={e=>eUpd("titulo",e.target.value)} style={inp()} placeholder="Descripción del evento"/></Field>
            <Field label="Fecha *"><input type="date" value={eForm.fecha} onChange={e=>eUpd("fecha",e.target.value)} style={inp()}/></Field>
            <Field label="Cliente"><select value={eForm.clienteId} onChange={e=>eUpd("clienteId",e.target.value)} style={inp()}><option value="">— Sin cliente —</option>{(data.clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
            <Field label="Dirección"><input value={eForm.direccion} onChange={e=>eUpd("direccion",e.target.value)} style={inp()} placeholder="Dirección del trabajo"/></Field>
            <Field label="Notas"><textarea value={eForm.notas} onChange={e=>eUpd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Observaciones..."/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={closeEv} v="g"/>
              <Btn ch={eForm.editId?"Guardar cambios":"Añadir evento"} onClick={addEvento} disabled={!eForm.titulo.trim()||!eForm.fecha}/>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── INST DETALLE ───────────────────────────────────────────────────────── */
function InstDetalle({ inst, data, refresh, onClose }) {
  const isMobile = useIsMobile();
  const equipos = (data.equipos||[]).filter(eq => eq.instalacion_id === inst.id);
  const cliente = (data.clientes||[]).find(c => c.id === inst.cliente_id);
  const [showNuevoEquipo, setShowNuevoEquipo] = useState(false);
  const [selEquipo, setSelEquipo] = useState(null);
  const [showVincular, setShowVincular] = useState(false);

  // Equipos del cliente sin contrato asignado (para vincular)
  const equiposSinContrato = (data.equipos||[]).filter(eq =>
    eq.cliente_id === inst.cliente_id && !eq.instalacion_id
  );

  const vincularEquipo = async (eq) => {
    await supabase.from("equipos").update({ instalacion_id: inst.id }).eq("id", eq.id);
    refresh?.();
    setShowVincular(false);
  };

  const desvincularEquipo = async (eq) => {
    if(!window.confirm("¿Quitar este equipo del contrato? El equipo y su historial se conservan.")) return;
    await supabase.from("equipos").update({ instalacion_id: null }).eq("id", eq.id);
    refresh?.();
  };

  return (
    <Modal onClose={onClose} w={640}>
      <MHead title={inst.nombre} sub={cliente?.nombre||""} onClose={onClose}/>
      <div style={{padding: isMobile?"14px":"20px 24px", display:"flex", flexDirection:"column", gap:16}}>

        {/* Estado del contrato */}
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <div style={{width:8,height:8,borderRadius:"50%",
            background: inst.activo!==false ? T.green : T.muted}}/>
          <span style={{fontSize:12,color: inst.activo!==false ? T.green : T.muted, fontWeight:600}}>
            {inst.activo!==false ? "Contrato activo" : "Contrato inactivo"}
          </span>
          {inst.notas && <span style={{fontSize:12,color:T.muted,marginLeft:8}}>{inst.notas}</span>}
        </div>

        {/* Cabecera equipos */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1}}>
            EQUIPOS DEL CONTRATO ({equipos.length})
          </div>
          <div style={{display:"flex",gap:8}}>
            {equiposSinContrato.length>0 && (
              <button onClick={()=>setShowVincular(true)}
                style={{fontSize:12,padding:"6px 12px",borderRadius:8,
                  border:`1px solid ${T.accent}40`,background:T.accentLight,
                  color:T.accent,cursor:"pointer",fontWeight:600}}>
                Añadir existente
              </button>
            )}
            <button onClick={()=>setShowNuevoEquipo(true)}
              style={{fontSize:12,padding:"6px 12px",borderRadius:8,
                border:"none",background:T.accent,
                color:"#fff",cursor:"pointer",fontWeight:600}}>
              + Nuevo equipo
            </button>
          </div>
        </div>

        {/* Lista de equipos */}
        {equipos.length===0 ? (
          <div style={{textAlign:"center",padding:"30px 20px",color:T.muted,fontSize:13,
            background:T.surface,borderRadius:10,border:`2px dashed ${T.border}`}}>
            Sin equipos en este contrato. Añade uno para empezar.
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {equipos.map(eq => {
              const frecuencias = ["mensual","trimestral","semestral","anual"]
                .filter(t => eq["activa_"+t]);
              return (
                <div key={eq.id} style={{background:T.surface,borderRadius:10,
                  padding:"12px 14px",border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14,color:T.text}}>{eq.nombre}</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                        {[eq.marca,eq.modelo,eq.ubicacion].filter(Boolean).join(" · ")}
                      </div>
                      {frecuencias.length>0 ? (
                        <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                          {frecuencias.map(t => {
                            const mt = MT[t];
                            const info = urgInfo(eq["proxima_"+t]||null);
                            const uc = UCOL[info.level]||T.muted;
                            return (
                              <span key={t} style={{fontSize:11,padding:"2px 8px",borderRadius:20,
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
                      ) : (
                        <div style={{fontSize:11,color:T.muted,marginTop:6}}>
                          Sin frecuencia de revisión asignada
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:6,marginLeft:8}}>
                      <button onClick={()=>setSelEquipo(eq)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,
                          border:`1px solid ${T.border}`,background:T.card,
                          color:T.text,cursor:"pointer"}}>
                        Editar
                      </button>
                      <button onClick={()=>desvincularEquipo(eq)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,
                          border:`1px solid ${T.red}40`,background:T.redLight,
                          color:T.red,cursor:"pointer"}}>
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Panel vincular equipo existente */}
        {showVincular && (
          <div style={{background:T.surface,borderRadius:10,padding:"14px",
            border:`1px solid ${T.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:10}}>
              EQUIPOS DISPONIBLES DEL CLIENTE
            </div>
            {equiposSinContrato.map(eq=>(
              <div key={eq.id} onClick={()=>vincularEquipo(eq)}
                style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  border:`1px solid ${T.border}`,marginBottom:6,background:T.card}}
                onMouseEnter={e=>e.currentTarget.style.background=T.accentLight}
                onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{eq.nombre}</div>
                  <div style={{fontSize:11,color:T.muted}}>
                    {[eq.marca,eq.modelo,eq.ubicacion].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span style={{fontSize:12,color:T.accent,fontWeight:600}}>Añadir →</span>
              </div>
            ))}
            <button onClick={()=>setShowVincular(false)}
              style={{marginTop:6,fontSize:12,color:T.muted,background:"none",
                border:"none",cursor:"pointer"}}>Cancelar</button>
          </div>
        )}
      </div>

      {showNuevoEquipo && (
        <NuevoEquipoModal
          clienteId={inst.cliente_id}
          instalacionId={inst.id}
          onSave={()=>refresh?.()}
          onClose={()=>setShowNuevoEquipo(false)}
        />
      )}
      {selEquipo && (
        <EquipoDetalle
          equipo={selEquipo}
          data={data}
          refresh={()=>{refresh?.();setSelEquipo(null);}}
          onClose={()=>setSelEquipo(null)}
        />
      )}
    </Modal>
  );
}

/* ─── MANTENIMIENTO ──────────────────────────────────────────────────────── */
function MantenimientoView({ data, user, refresh, empresa={} }) {
  const isMobile=useIsMobile(); const [tab,setTab]=useState("pendientes"); const [showInst,setShowInst]=useState(null); const [showRev,setShowRev]=useState(null); const [expanded,setExpanded]=useState(null); const [selInst,setSelInst]=useState(null);
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
      {selInst&&<InstDetalle inst={selInst} data={data} refresh={()=>{ refresh?.(); setSelInst(null); }} onClose={()=>setSelInst(null)}/>}
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



/* ── generarPartePDF ───────────────────────────────────────────────────── */
async function generarPartePDF(parte, averia, cliente, empresa={}, titulo="PARTE DE TRABAJO") {
  try {
    const JsPDF = await (async()=>{
      if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); });
    })();
    const doc = new JsPDF({unit:"mm",format:"a4"});
    const corp = empresa.color_corporativo||"#1d4ed8";
    const hr = h=>{ const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return [r,g,b]; };
    const [O,D,G,L] = [hr(corp),[15,23,42],[100,116,139],[248,250,252]];
    const W = getTextColor(empresa.color_corporativo || '#1d4ed8');
    const horas = (parte.hora_inicio&&parte.hora_fin)?(()=>{ const [h1,m1]=parte.hora_inicio.split(":").map(Number),[h2,m2]=parte.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0;
    const ph = parseFloat(parte.precio_hora||0);
    const tMO = horas*ph;
    const mats = (parte.materiales||[]).filter(m=>m.desc);
    const tMat = mats.reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0);
    const base = tMO+tMat;
    const iva = parte.aplicar_iva!==false ? base*0.21 : 0;
    const total = base+iva;

    // ── 1. CABECERA EMPRESA ──
    doc.setFillColor(...O); doc.rect(0,0,210,36,"F");
    if(empresa.logo_url) {
      try {
        const logoImg = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = empresa.logo_url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        canvas.getContext("2d").drawImage(logoImg, 0, 0);
        const logoData = canvas.toDataURL("image/png");
        const maxW = 22, maxH = 16;
        const ratio = Math.min(maxW/logoImg.naturalWidth*3.7795, maxH/logoImg.naturalHeight*3.7795);
        const lw = (logoImg.naturalWidth * ratio)/3.7795;
        const lh = (logoImg.naturalHeight * ratio)/3.7795;
        doc.addImage(logoData, "PNG", 12, 6, lw, lh);
        doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
        doc.text(empresa.nombre||"BLCH", 12, 6+lh+4);
        doc.setFontSize(7); doc.setFont("helvetica","normal");
        if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,6+lh+9);
        if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,6+lh+14);
        if(empresa.direccion)doc.text(empresa.direccion,12,6+lh+19);
      } catch(e) {
        doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
        doc.text(empresa.nombre||"BLCH", 12, 13);
        doc.setFontSize(8); doc.setFont("helvetica","normal");
        if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,20);
        if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
        if(empresa.direccion)doc.text(empresa.direccion,12,33);
      }
    } else {
      doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
      doc.text(empresa.nombre||"BLCH", 12, 13);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,20);
      if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
      if(empresa.direccion)doc.text(empresa.direccion,12,33);
    }
    doc.setFontSize(12); doc.setFont("helvetica","bold");
    doc.text(titulo,198,12,{align:"right"});
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("Nº: "+String(averia.id||""),198,20,{align:"right"});
    doc.text("Fecha: "+(parte.fecha||new Date().toLocaleDateString("es-ES")),198,27,{align:"right"});
    if(parte.forma_pago) doc.text("Pago: "+({efectivo:"Efectivo",tarjeta:"Tarjeta",transferencia:"Transferencia"}[parte.forma_pago]||""),198,34,{align:"right"});

    // ── 2. CLIENTE + AVERÍA ──
    let y=42;
    const extraClienteLines=(cliente?.dni?1:0)+(cliente?.email?1:0)+(cliente?.direccion?1:0);
    const clienteBoxH=20+extraClienteLines*5;
    doc.setFillColor(...L); doc.rect(10,y,190,clienteBoxH,"F");
    doc.setTextColor(...D); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("CLIENTE",14,y+6); doc.text("EQUIPO / AVERÍA",105,y+6);
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.text(cliente?.nombre?(cliente.nombre+(cliente.apellidos?" "+cliente.apellidos:"")):"—",14,y+13);
    doc.setFontSize(8); doc.setTextColor(...G);
    let cy=y+13;
    if(cliente?.telefono){ cy+=5; doc.text(cliente.telefono,14,cy); }
    if(cliente?.dni){ cy+=5; doc.text("DNI/NIF: "+cliente.dni,14,cy); }
    if(cliente?.email){ cy+=5; doc.text(cliente.email,14,cy); }
    if(cliente?.direccion){ cy+=5; doc.text(cliente.direccion.slice(0,45),14,cy); }
    doc.setFontSize(9); doc.setTextColor(...D);
    doc.text((averia.equipo||"—").slice(0,35),105,y+13);
    y+=clienteBoxH+6;

    // ── 3. DESCRIPCIÓN DEL TRABAJO ──
    if(parte.trabajo) {
      doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("DESCRIPCIÓN DEL TRABAJO",14,y+5); y+=10;
      const lines=doc.splitTextToSize(parte.trabajo,182);
      doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text(lines,14,y); y+=lines.length*5.5+6;
    }

    // ── 4. TÉCNICO + HORAS ──
    doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("TÉCNICO Y HORAS DE SERVICIO",14,y+5); y+=9;
    doc.setFillColor(226,232,240); doc.rect(10,y,190,6,"F");
    doc.setTextColor(...G);
    ["Técnico","H. Inicio","H. Fin","Horas","€/hora","M.O."].forEach((h,i)=>doc.text(h,[14,70,100,130,155,178][i],y+4));
    y+=7; doc.setFont("helvetica","normal"); doc.setTextColor(...D); doc.setFontSize(9);
    [parte.tecnico_nombre||"—",parte.hora_inicio||"—",parte.hora_fin||"—",horas>0?horas.toFixed(2)+"h":"—",ph>0?ph+"€":"—",tMO>0?tMO.toFixed(2)+"€":"0.00€"].forEach((v,i)=>doc.text(v,[14,70,100,130,155,178][i],y+4));
    y+=10;

    // ── 5. MATERIALES ──
    if(mats.length>0){
      doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("MATERIALES UTILIZADOS",14,y+5); y+=9;
      doc.setFillColor(226,232,240); doc.rect(10,y,190,6,"F");
      doc.setTextColor(...G);
      ["Descripción","Cantidad","Precio ud.","Total"].forEach((h,i)=>doc.text(h,[14,130,155,182][i],y+4));
      y+=7;
      mats.forEach((m,idx)=>{
        if(idx%2===0){ doc.setFillColor(...L); doc.rect(10,y-1,190,7,"F"); }
        doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9);
        const tot=(parseFloat(m.qty||0)*parseFloat(m.precio||0)).toFixed(2);
        [m.desc?.slice(0,45)||"—",String(m.qty||0),parseFloat(m.precio||0).toFixed(2)+" €",tot+" €"].forEach((v,i)=>doc.text(v,[14,130,155,182][i],y+4));
        y+=7; if(y>250){ doc.addPage(); y=20; }
      });
      // Total materiales
      doc.setFillColor(240,244,248); doc.rect(130,y,70,7,"F");
      doc.setFont("helvetica","bold"); doc.setTextColor(...D);
      doc.text("Total materiales:",132,y+5); doc.text(tMat.toFixed(2)+" €",198,y+5,{align:"right"});
      y+=12;
    }

    // ── 6. TOTALES ──
    doc.setFillColor(...L); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...G); doc.setFont("helvetica","bold"); doc.setFontSize(8);
    doc.text("Base imponible:",14,y+5); doc.text(base.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
    if(parte.aplicar_iva!==false){
      doc.setFillColor(...L); doc.rect(10,y,190,7,"F");
      doc.text("IVA (21%):",14,y+5); doc.text(iva.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
    }
    doc.setFillColor(...O); doc.rect(10,y,190,14,"F");
    doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("TOTAL"+(parte.aplicar_iva!==false?" (IVA inc.)":""),14,y+10);
    doc.text(total.toFixed(2)+" €",198,y+10,{align:"right"}); y+=20;

    // ── 7. FIRMA ──
    const firmaData = parte.firma_base64 || parte.firma_url;
    if(firmaData){
      try {
        const loadImg = (src) => new Promise(res=>{
          const img=new Image(); img.crossOrigin="anonymous";
          img.onload=()=>res(img); img.onerror=()=>res(null);
          img.src=src;
        });
        const img = await loadImg(firmaData);
        if(img){
          doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G);
          doc.text("FIRMA DEL CLIENTE:",14,y+4);
          doc.addImage(img,"PNG",14,y+6,80,28);
          doc.line(14,y+36,94,y+36);
          doc.setFont("helvetica","normal"); doc.text(cliente?.nombre||"",14,y+40);
          y+=44;
        }
      } catch(e){}
    } else {
      // Espacio para firma manual
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G);
      doc.text("FIRMA DEL CLIENTE:",14,y+4);
      doc.rect(14,y+6,80,28);
      doc.line(14,y+36,94,y+36);
      y+=44;
    }

    // ── 8. OBSERVACIONES ──
    if(parte.observaciones){
      doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(...G);
      const obs=doc.splitTextToSize("Observaciones: "+parte.observaciones,182);
      doc.text(obs,14,y); y+=obs.length*5+4;
    }

    // ── PIE ──
    const ph2=doc.internal.pageSize.height;
    doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(102,102,102);
    doc.setFillColor(...D); doc.rect(0,ph2-10,210,10,"F");
    doc.setTextColor(100,116,139); doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text((empresa.nombre||"")+(empresa.cif?" · CIF:"+empresa.cif:""),14,ph2-4);
    if(empresa.cuenta_iban) doc.text("IBAN: "+empresa.cuenta_iban,105,ph2-4,{align:"center"});
    doc.text((empresa.telefono||"")+(empresa.email?" · "+empresa.email:""),198,ph2-4,{align:"right"});

    const textLOPD = `De acuerdo con lo establecido en el artículo 7 del Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos, el interesado concede su consentimiento libre y expreso en el tratamiento de sus datos personales, por parte del responsable del tratamiento ${empresa.nombre||""}.\n\nEn base al derecho de información establecido en el artículo 12 del mismo RGPD y en base al artículo 11 de la LOPD GDD, se le facilita la siguiente información, puede consultar la información ampliada en el siguiente enlace (https://intranet.laboralrgpd.com/rgpdA/index.php?id=26337.73963).\n\nFinalidades a tratar: Gestión contable, administrativa, de facturación y gestión de cobros, Prestarles un servicio, Tramitación de presupuestos, Envíos de información recíproca mediante la plataforma Whatsapp, sin que el Responsable pueda asegurar que dicha plataforma tome medidas de seguridad y realicen tratamientos adecuados al RGPD y la LOPDGDD.\n\nLegitimación: consentimiento inequívoco.\n\nDestinatarios: Administración tributaria, Bancos y entidades financieras, Gestoría/Asesoría, Encargados de destrucción de documentación, Entidades de Consultoría/Auditoría, Otros encargados del tratamiento.\n\nTiene derecho a acceder, rectificar y suprimir los datos, así como otros derechos, como se explica en la información adicional. Puede consultar la información adicional y detallada sobre Protección de Datos en el siguiente enlace: (Información Adicional). Sólo conservaremos su información por el periodo de tiempo necesario para cumplir con la finalidad para la que fuere cogida, dar cumplimiento a las obligaciones legales que nos vienen impuestas y atender las posibles responsabilidades que pudieran derivar del cumplimiento de la finalidad por la que los datos fueron recabados.`;

    doc.addPage();
    doc.setFillColor(...O);
    doc.rect(0,0,210,20,"F");
    doc.setTextColor(...W);
    doc.setFontSize(10);
    doc.setFont("helvetica","bold");
    doc.text("INFORMACIÓN SOBRE PROTECCIÓN DE DATOS", 14, 13);
    doc.setFontSize(7);
    doc.setFont("helvetica","normal");
    doc.setTextColor(30,30,30);
    const lopd = doc.splitTextToSize(textLOPD, 182);
    doc.text(lopd, 14, 30);

    doc.save(`parte_${String(averia.id||"")}_${(cliente?.nombre||"cliente").replace(/ /g,"_")}.pdf`);
  } catch(e){ console.error("PDF error:",e); alert("Error al generar PDF: "+e.message); }
}




function CatalogoMaterialesView({ onClose }) {
  const isMobile=useIsMobile();
  const [rows,setRows]=useState([]);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ load(); },[]);

  async function load(){
    setLoading(true);
    const {data:d}=await supabase.from("materiales").select("*").eq("activo",true).order("nombre",{ascending:true});
    setRows((d||[]).map(m=>({id:m.id,nombre:m.nombre,precio:m.precio,_del:false})));
    setLoading(false);
  }

  function addRow(){ setRows(r=>[...r,{id:null,nombre:"",precio:"",_del:false}]); }

  function updRow(i,k,v){ setRows(r=>r.map((row,j)=>j===i?{...row,[k]:v}:row)); }

  function removeRow(i){
    setRows(r=>{
      if(r[i].id===null) return r.filter((_,j)=>j!==i);
      return r.map((row,j)=>j===i?{...row,_del:true}:row);
    });
  }

  async function guardar(){
    setSaving(true);
    const ops=[
      ...rows.filter(r=>r.id===null&&!r._del&&r.nombre.trim()).map(r=>
        supabase.from("materiales").insert([{nombre:r.nombre.trim(),precio:parseFloat(r.precio||0)}])
      ),
      ...rows.filter(r=>r.id!==null&&!r._del).map(r=>
        supabase.from("materiales").update({nombre:r.nombre.trim(),precio:parseFloat(r.precio||0)}).eq("id",r.id)
      ),
      ...rows.filter(r=>r.id!==null&&r._del).map(r=>
        supabase.from("materiales").update({activo:false}).eq("id",r.id)
      ),
    ];
    const results=await Promise.all(ops);
    const err=results.find(r=>r.error);
    if(err) alert("Error: "+err.error.message);
    else await load();
    setSaving(false);
  }

  const visible=rows.reduce((acc,r,i)=>{
    if(!r._del&&(!search||r.nombre.toLowerCase().includes(search.toLowerCase()))) acc.push({r,i});
    return acc;
  },[]);

  return (
    <Modal onClose={onClose} w={680}>
      <MHead title="Catálogo de materiales" sub='Los cambios se guardan al pulsar "Guardar cambios"' onClose={onClose}/>
      <div style={{ padding:isMobile?"12px 10px":"14px 20px",display:"flex",flexDirection:"column",gap:12 }}>

        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar material..." style={{...inp({padding:"8px 12px",fontSize:13}),flex:1}}/>
          <Btn ch="+ Añadir material" onClick={addRow} v="b" sm/>
        </div>

        {loading?(
          <div style={{ padding:"30px",textAlign:"center",color:T.muted,fontSize:13 }}>Cargando...</div>
        ):(
          <div style={{ background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 120px 36px",gap:8,padding:"7px 12px",borderBottom:`1px solid ${T.border}`,background:T.card }}>
              {["Nombre","Precio (€)",""].map((h,i)=><span key={i} style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase" }}>{h}</span>)}
            </div>
            {visible.length===0?(
              <div style={{ padding:"28px",textAlign:"center",color:T.muted,fontSize:13 }}>
                {search?"Sin coincidencias para «"+search+"»":"Sin materiales. Pulsa «+ Añadir material» para empezar."}
              </div>
            ):visible.map(({r,i})=>(
              <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 120px 36px",gap:8,padding:"6px 12px",borderBottom:`1px solid ${T.border}`,alignItems:"center" }}>
                <input value={r.nombre} onChange={e=>updRow(i,"nombre",e.target.value)} placeholder="Nombre del material" style={inp({padding:"5px 9px",fontSize:13})}/>
                <input type="number" step="0.01" value={r.precio} onChange={e=>updRow(i,"precio",e.target.value)} placeholder="0.00" style={inp({padding:"5px 9px",fontSize:13})}/>
                <button onClick={()=>removeRow(i)} title="Eliminar" style={{ width:28,height:28,borderRadius:6,border:`1px solid ${T.red}40`,background:T.redLight,color:T.red,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex",gap:10,justifyContent:"flex-end",paddingTop:6,borderTop:`1px solid ${T.border}` }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Guardando...":"Guardar cambios"} onClick={guardar} disabled={saving||loading}/>
        </div>

      </div>
    </Modal>
  );
}

function EmpresaConfig({ empresa, setEmpresa }) {
  const isMobile=useIsMobile();
  const [form,setForm]=useState({...empresa});
  const [saved,setSaved]=useState(false);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef();
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const [showCatalogo,setShowCatalogo]=useState(false);

  async function uploadLogo(e) {
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    const ext=file.name.split(".").pop().toLowerCase();
    const path=`logos/empresa_logo_${Date.now()}.${ext}`;
    let publicUrl="";
    // Intentar primero en bucket "fotos"
    const { error:err1 }=await supabase.storage.from("fotos").upload(path,file,{upsert:true});
    if(!err1){
      const { data:urlData }=supabase.storage.from("fotos").getPublicUrl(path);
      publicUrl=urlData.publicUrl;
      console.log("Logo URL (bucket fotos):", publicUrl);
      setForm(prev=>({...prev, logo_url: publicUrl}));
      setEmpresa(prev=>({...prev, logo_url: publicUrl}));
    } else {
      console.log("uploadLogo error en bucket 'fotos':", err1);
      // Fallback al bucket "logos"
      const { error:err2 }=await supabase.storage.from("logos").upload(path,file,{upsert:true});
      if(!err2){
        const { data:urlData }=supabase.storage.from("logos").getPublicUrl(path);
        publicUrl=urlData.publicUrl;
        console.log("Logo URL (bucket logos):", publicUrl);
        setForm(prev=>({...prev, logo_url: publicUrl}));
        setEmpresa(prev=>({...prev, logo_url: publicUrl}));
      } else {
        console.log("uploadLogo error en bucket 'logos':", err2);
        alert("Error subiendo logo: "+err2.message);
      }
    }
    if(publicUrl){
      const { error:dbErr }=await supabase.from("empresa").update({ logo_url: publicUrl }).eq("id",1);
      if(dbErr) console.log("Error guardando logo_url en BD:", dbErr);
      else console.log("logo_url guardado en BD correctamente");
    }
    setUploading(false);
    e.target.value="";
  }

  async function save() {
    const payload={...form,id:1};
    console.log("Guardando empresa:", payload);
    const { error }=await supabase.from("empresa").upsert([payload]);
    if(!error){ setEmpresa(form); setSaved(true); setTimeout(()=>setSaved(false),3000); }
    else alert("Error: "+error.message);
  }

  const color = form.color_corporativo||"#1d4ed8";

  return (
    <>
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 4px",fontFamily:"'Sora',sans-serif" }}>Mi empresa</h1>
        <p style={{ color:T.muted,fontSize:13,margin:0 }}>Estos datos aparecerán en los partes y formularios enviados al cliente.</p>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:16,maxWidth:700 }}>

        {/* Imagen corporativa */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:16 }}>Imagen corporativa</div>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16 }}>
            {/* Logo */}
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:8 }}>Logo de la empresa</label>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {form.logo_url ? (
                  <div style={{ position:"relative",width:160,height:80,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",background:T.surface,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <img src={form.logo_url} alt="logo" style={{ maxWidth:"100%",maxHeight:"100%",objectFit:"contain" }}/>
                    <button onClick={()=>upd("logo_url","")} style={{ position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
                  </div>
                ) : (
                  <div onClick={()=>fileRef.current.click()} style={{ width:160,height:80,borderRadius:10,border:`2px dashed ${T.border}`,background:T.surface,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:4 }}>
                    <span style={{ fontSize:22 }}></span>
                    <span style={{ fontSize:11,color:T.muted }}>Subir logo</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display:"none" }} onChange={uploadLogo}/>
                <Btn ch={uploading?"Subiendo...":"Cambiar logo"} onClick={()=>fileRef.current.click()} v="g" sm disabled={uploading}/>
                <p style={{ fontSize:11,color:T.muted,margin:0 }}>PNG, JPG o SVG. Fondo transparente recomendado.</p>
              </div>
            </div>
            {/* Color corporativo */}
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:T.sub,display:"block",marginBottom:8 }}>Color corporativo</label>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                  <input type="color" value={color} onChange={e=>upd("color_corporativo",e.target.value)}
                    style={{ width:56,height:56,borderRadius:10,border:`1px solid ${T.border}`,cursor:"pointer",padding:4 }}/>
                  <div>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:2 }}>{color.toUpperCase()}</div>
                    <div style={{ fontSize:11,color:T.muted }}>Color principal</div>
                  </div>
                </div>
                {/* Preview */}
                <div style={{ borderRadius:10,overflow:"hidden",border:`1px solid ${T.border}` }}>
                  <div style={{ background:color,padding:"10px 14px",display:"flex",alignItems:"center",gap:10 }}>
                    {form.logo_url ? <img src={form.logo_url} alt="" style={{ height:28,objectFit:"contain" }}/> : <div style={{ width:28,height:28,borderRadius:7,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:getTextColor(color||'#1d4ed8').map(v=>v.toString(16).padStart(2,'0')).reduce((a,b)=>'#'+a+b) }}>{(form.nombre||"E")[0]}</div>}
                    <span style={{ fontSize:13,fontWeight:700,color:'#'+getTextColor(color||'#1d4ed8').map(v=>v.toString(16).padStart(2,'0')).join(''),fontFamily:"'Sora',sans-serif" }}>{form.nombre||"Mi empresa"}</span>
                  </div>
                  <div style={{ background:T.bg,padding:"8px 14px" }}>
                    <div style={{ fontSize:11,color:T.muted }}>Vista previa de cabecera PDF</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de la empresa */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:16 }}>Datos de la empresa</div>
          <div style={{ display:"flex",flexDirection:"column",gap:13 }}>
            <Field label="Nombre / Razón social">
              <input value={form.nombre||""} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Nombre de tu empresa"/>
            </Field>
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12 }}>
              <Field label="CIF / NIF"><input value={form.cif||""} onChange={e=>upd("cif",e.target.value)} style={inp()} placeholder="B12345678"/></Field>
              <Field label="Teléfono"><input value={form.telefono||""} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="968 XXX XXX"/></Field>
              <Field label="Email"><input type="email" value={form.email||""} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="info@empresa.com"/></Field>
              <Field label="Web"><input value={form.web||""} onChange={e=>upd("web",e.target.value)} style={inp()} placeholder="www.empresa.com"/></Field>
            </div>
            <Field label="Dirección fiscal">
              <input value={form.direccion||""} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Calle, número, municipio, CP"/>
            </Field>
          </div>
        </div>

        {/* Datos bancarios */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:16 }}>Datos bancarios</div>
          <Field label="IBAN">
            <input value={form.cuenta_iban||""} onChange={e=>upd("cuenta_iban",e.target.value)} style={inp()} placeholder="ES00 0000 0000 0000 0000 0000"/>
          </Field>
        </div>

        {/* Configuración de fichajes */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px" }}>
          <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:4 }}>Configuración de fichajes</div>
          <p style={{ fontSize:12,color:T.muted,margin:"0 0 16px" }}>Ajusta cómo registran la jornada tus empleados.</p>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderRadius:10,border:`1px solid ${T.border}`,background:T.surface }}>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:T.text,marginBottom:2 }}>¿Tu empresa tiene pausa para comer?</div>
              <div style={{ fontSize:12,color:T.muted }}>Actívalo si tus empleados fichan entrada, pausa y vuelta del descanso.</div>
            </div>
            <div onClick={()=>upd("tiene_descanso",!form.tiene_descanso)}
              style={{ width:44,height:24,borderRadius:12,background:form.tiene_descanso?T.accent:"#cbd5e1",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0 }}>
              <div style={{ position:"absolute",top:3,left:form.tiene_descanso?23:3,width:18,height:18,borderRadius:"50%",background:T.card,boxShadow:"0 1px 4px rgba(0,0,0,0.2)",transition:"left 0.2s" }}/>
            </div>
          </div>
        </div>

        {/* Catálogo de materiales */}
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16 }}>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:2 }}>Catálogo de materiales</div>
            <div style={{ fontSize:12,color:T.muted }}>Materiales y precios disponibles en partes y presupuestos</div>
          </div>
          <Btn ch="Gestionar catálogo" onClick={()=>setShowCatalogo(true)} v="b" sm/>
        </div>

        {/* Guardar */}
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <Btn ch="Guardar cambios" onClick={save} full/>
          {saved && <span style={{ fontSize:13,color:T.green,fontWeight:600 }}>Guardado correctamente</span>}
        </div>

      </div>
    </div>
    {showCatalogo&&<CatalogoMaterialesView onClose={()=>setShowCatalogo(false)}/>}
    </>
  );
}



/* ══════════════════════════════════════════════════════════════════════════
   SECCIÓN INSTALACIONES — Trabajos de instalación nuevos
   ══════════════════════════════════════════════════════════════════════════ */

const mkOB_ESTADOS = SC => ({
  pendiente:           { label:"Pendiente",         color:SC.pendiente },
  en_curso:            { label:"En curso",          color:SC.en_curso },
  completada:          { label:"Completada",        color:SC.completada },
  pendiente_facturar:  { label:"Pend. facturar",    color:SC.pendiente_facturar },
  facturada:           { label:"Facturada",         color:SC.facturada },
});
let OB_ESTADOS = mkOB_ESTADOS(SC_LIGHT);

function NuevaObraModal({ data, user, techs, refresh, onClose, presupuestoId }) {
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];
  const pres     = data.presupuestos || [];

  const [clienteId, setClienteId] = useState("");
  const [presupId, setPresupId]   = useState("");
  const [form, setForm] = useState({
    descripcion: "", direccion: "", fechaInicio: todayStr(), fechaFin: "", tecnicoId: "", notas: "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
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

  const presCliente = pres.filter(p=>p.cliente_id===clienteId && p.status==="aceptado");

  async function save() {
    if(!form.descripcion.trim()||!clienteId){ alert("Selecciona un cliente y añade descripción."); return; }
    setSaving(true);
    const { error } = await supabase.from("instalaciones_obras").insert([{
      cliente_id:     clienteId,
      presupuesto_id: presupId||null,
      tecnico_id:     form.tecnicoId||null,
      descripcion:    form.descripcion.trim(),
      direccion:      form.direccion,
      fecha_inicio:   form.fechaInicio,
      fecha_fin:      form.fechaFin||null,
      status: "pendiente",
      notas:          form.notas||null,
    }]);
    if(!error){ refresh?.(); onClose(); }
    else alert("Error: "+error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={580}>
      <MHead title="Nueva instalación" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <ClienteBuscadorField clientes={cls} clienteId={clienteId}
          onSelect={(id,c)=>{ setClienteId(id); setPresupId(""); upd("direccion",c?.direccion||""); }}
          onDeselect={()=>{ setClienteId(""); setPresupId(""); upd("direccion",""); }}
          onCreated={(nc)=>{ setClienteId(nc.id); upd("direccion",nc.direccion||""); }}
          refresh={refresh}/>

        {/* Presupuesto relacionado */}
        {presCliente.length>0&&(
          <Field label="Presupuesto relacionado (opcional)">
            <select value={presupId} onChange={e=>{ setPresupId(e.target.value); const p=pres.find(x=>String(x.id)===e.target.value); if(p) upd("descripcion",p.descripcion); }} style={inp()}>
              <option value="">Sin presupuesto relacionado</option>
              {presCliente.map(p=><option key={p.id} value={p.id}>#{p.id} — {p.descripcion?.slice(0,50)} ({(p.importe||0).toFixed(2)}€)</option>)}
            </select>
          </Field>
        )}

        <Field label="Descripción del trabajo *">
          <div style={{ display:"flex",gap:6,alignItems:"flex-start" }}>
            <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)} style={{...inp(),minHeight:70,resize:"vertical",flex:1}} placeholder="Describe la instalación a realizar..."/>
            <MicBtn onResult={t=>setForm(p=>({...p,descripcion:p.descripcion?p.descripcion+" "+t:t}))}/>
          </div>
        </Field>

        <Field label="Dirección">
          <input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Dirección de la instalación"/>
        </Field>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Fecha inicio"><input type="date" value={form.fechaInicio} onChange={e=>upd("fechaInicio",e.target.value)} style={inp()}/></Field>
          <Field label="Fecha fin prevista"><input type="date" value={form.fechaFin} onChange={e=>upd("fechaFin",e.target.value)} style={inp()}/></Field>
        </div>

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
          <Btn ch={saving?"Creando...":"Crear instalación"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>
    </Modal>
  );
}

function ObraDetalle({ obra:initO, data, user, techs, empresa, refresh, onClose }) {
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const [obra, setObra] = useState(initO);
  const [tab, setTab]   = useState("info");
  const [partes, setPartes]   = useState([]);
  const [fotos, setFotos]     = useState([]);
  const [notas, setNotas]     = useState([]);
  const [nota, setNota]       = useState("");
  const [showParte, setShowParte] = useState(false);
  const [showEquipo, setShowEquipo] = useState(false);
  const [showProgram, setShowProgram] = useState(false);
  const [progDate, setProgDate]       = useState("");
  const [progNota, setProgNota]       = useState("");
  const [savingProg, setSavingProg]   = useState(false);
  const fileRef = useRef();
  const notaRef = useRef();

  const cl    = (data.clientes||[]).find(c=>c.id===obra.cliente_id);
  const presu = (data.presupuestos||[]).find(p=>p.id===obra.presupuesto_id);

  const SO_OB   = { pendiente:0, en_curso:1, completada:2, pendiente_facturar:3, facturada:10 };
  const OB_FLOW = ["pendiente","en_curso","completada","pendiente_facturar"];
  const OB_LABELS = { pendiente:"Pendiente", en_curso:"En curso", completada:"Completada", pendiente_facturar:"Pend. facturar", facturada:"Facturada" };
  const isPendFacturar = obra.status === "pendiente_facturar";
  const isFacturada    = obra.status === "facturada";

  useEffect(()=>{ loadPartes(); loadFotos(); loadNotas(); },[obra.id]);

  async function loadPartes() { const {data:d}=await supabase.from("partes").select("*").eq("averia_id","obra_"+obra.id).order("created_at",{ascending:false}); setPartes(d||[]); }
  async function loadFotos()  { const {data:d}=await supabase.from("fotos_averias").select("*").eq("averia_id","obra_"+obra.id); setFotos(d||[]); }
  async function loadNotas()  { const {data:d}=await supabase.from("notas_averias").select("*").eq("averia_id","obra_"+obra.id).order("created_at",{ascending:true}); setNotas(d||[]); }

  async function updStatus(s) {
    const upd = { status: s==="completada" ? "pendiente_facturar" : s };
    const {error}=await supabase.from("instalaciones_obras").update(upd).eq("id",obra.id);
    if(!error){ setObra(p=>({...p,...upd})); refresh?.(); }
    else alert("Error: "+error.message);
  }

  async function addNota() {
    if(!nota.trim()) return;
    await supabase.from("notas_averias").insert([{averia_id:"obra_"+obra.id,autor_id:user.id,autor_nombre:user.nombre,texto:nota.trim()}]);
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

  async function subirFoto(e) {
    const files=Array.from(e.target.files).slice(0,4-fotos.length);
    for(const file of files){ const ext=file.name.split(".").pop(); const path=`obras/${obra.id}/${Date.now()}.${ext}`; const {error}=await supabase.storage.from("fotos").upload(path,file,{upsert:false}); if(!error) await supabase.from("fotos_averias").insert([{averia_id:"obra_"+obra.id,storage_path:path}]); }
    loadFotos(); e.target.value="";
  }

  function getFotoUrl(path){ const {data}=supabase.storage.from("fotos").getPublicUrl(path); return data?.publicUrl||""; }

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
          {[{k:"info",l:"Info"},{k:"fotos",l:`Fotos (${fotos.length})`},{k:"notas",l:`Notas (${notas.length})`},{k:"partes",l:`Partes (${partes.length})`}].map(t=>(
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

        {tab==="fotos"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
              <span style={{ fontSize:12,color:T.sub }}>{fotos.length}/4 fotos</span>
              {fotos.length<4&&<Btn ch="Añadir foto" onClick={()=>fileRef.current.click()} v="g" sm/>}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={subirFoto}/>
            </div>
            {fotos.length===0?<div onClick={()=>fileRef.current.click()} style={{ border:`2px dashed ${T.border}`,borderRadius:10,padding:30,textAlign:"center",cursor:"pointer",color:T.muted }}>Pulsa para añadir fotos</div>:<div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8 }}>{fotos.map(f=><div key={f.id} style={{ position:"relative",aspectRatio:"4/3",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}` }}><img src={getFotoUrl(f.storage_path)} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/><button onClick={async()=>{ await supabase.storage.from("fotos").remove([f.storage_path]); await supabase.from("fotos_averias").delete().eq("id",f.id); loadFotos(); }} style={{ position:"absolute",top:6,right:6,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer" }}>×</button></div>)}</div>}
          </div>
        )}

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

function InstalacionesObrasView({ data, user, techs, refresh, empresa }) {
  const isMobile  = useIsMobile();
  const isAdmin   = user.role === "admin";
  const [filter, setFilter]     = useState("en_curso");
  const [showNew, setShowNew]   = useState(false);
  const [selected, setSelected] = useState(null);

  const all = data.instalaciones_obras || [];
  const filtros = [
    { key:"pendiente",          label:"Pendientes",     color:OB_ESTADOS.pendiente.color,          items: all.filter(o=>o.status==="pendiente") },
    { key:"en_curso",           label:"En curso",       color:OB_ESTADOS.en_curso.color,            items: all.filter(o=>o.status==="en_curso") },
    { key:"pendiente_facturar", label:"Pend. facturar", color:OB_ESTADOS.pendiente_facturar.color,  items: all.filter(o=>o.status==="pendiente_facturar") },
    { key:"facturadas",         label:"Facturadas",     color:OB_ESTADOS.facturada.color,           items: all.filter(o=>o.status==="facturada") },
    { key:"todas",              label:"Todas",          color:T.sub,                            items: all },
  ];
  const filtroActual = filtros.find(f=>f.key===filter)||filtros[0];
  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Instalaciones</h1>
        <button onClick={()=>_setTooltip("instalaciones_obras")} title="Ayuda de Instalaciones" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        <Btn ch="+ Nueva instalación" onClick={()=>setShowNew(true)}/>
      </div>

      <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4 }}>
        {filtros.map(f=>{ const isAct=filter===f.key; return <button key={f.key} onClick={()=>setFilter(f.key)} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:20,border:isAct?`1px solid ${f.color}`:`1.5px solid ${f.color+"88"}`,background:isAct?f.color+"22":T.card,color:isAct?f.color:T.sub,fontSize:12,fontWeight:isAct?700:400,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>{f.label}<span style={{ minWidth:18,height:18,borderRadius:9,background:f.color,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",lineHeight:1,flexShrink:0 }}>{f.items.length}</span></button>; })}
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {filtroActual.items.length===0&&<div style={{ textAlign:"center",color:T.muted,padding:"60px 0",fontSize:14 }}>No hay instalaciones en esta categoría</div>}
        {filtroActual.items.map(o=>{ const c=cl(o.cliente_id); const s=OB_ESTADOS[o.status]; const evOb=(data.eventos||[]).find(e=>e.instalacion_id===o.id); return (
          <div key={o.id} onClick={()=>setSelected(o)}
            style={{
  background: T.card,
  border: `1px solid ${T.border}`,
  borderLeft: `6px solid ${s?.color||T.muted}`,
  borderRadius: 11,
  padding: "13px 15px",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  transition: "all 0.15s"
}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="translateY(0)";}}>
            <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:6,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{o.descripcion}</div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <span style={{ fontSize:12,fontWeight:500,color:T.text }}>{c?.nombre}</span>
                {o.fecha_inicio&&<><span style={{ color:T.border,fontSize:10 }}>·</span><span style={{ fontSize:12,color:T.muted }}>{o.fecha_inicio}</span></>}
                <span style={{ color:T.border,fontSize:10 }}>·</span>
                <span style={{ fontSize:12,color:T.muted }}>{new Date(o.created_at).toLocaleDateString("es-ES")}</span>
                {o.presupuesto_id&&<span style={{ fontSize:10,padding:"1px 7px",borderRadius:20,background:T.accentLight,color:T.accent,fontWeight:600 }}>Con presupuesto</span>}
                <BadgeProg fecha={evOb?.fecha}/>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <span style={{ padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:(s?.color||T.muted)+"dd",color:"#fff" }}>{s?.label||o.status}</span>
                <span style={{ fontSize:11, color:T.muted, marginLeft:6 }}>{new Date(o.created_at).toLocaleDateString("es-ES")}</span>
                {c?.telefono&&<a href={`https://wa.me/34${c.telefono.replace(/\s/g,"")}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="13" height="13" viewBox="0 0 24 24" fill={T.green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                {c?.telefono&&<a href={`tel:${c.telefono}`} onClick={e=>e.stopPropagation()} style={{ width:30,height:30,borderRadius:7,background:T.green+"22",border:"1.5px solid "+T.green,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></a>}
                {o.direccion&&<button onClick={e=>{ e.stopPropagation(); openMaps(o.direccion); }} style={{ width:30,height:30,borderRadius:7,background:T.accent+"22",border:"1.5px solid "+T.accent,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></button>}
              </div>
            </div>
          </div>
        ); })}
      </div>

      {showNew&&<NuevaObraModal data={data} user={user} techs={techs} refresh={refresh} onClose={()=>setShowNew(false)}/>}
      {selected&&<ObraDetalle obra={selected} data={data} user={user} techs={techs} empresa={empresa} refresh={refresh} onClose={()=>setSelected(null)}/>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   SECCIÓN FICHAJES — Registro de jornada laboral
   ══════════════════════════════════════════════════════════════════════════ */

function FichajesView({ data, user, refresh, empresa={} }) {
  const TIENE_DESCANSO = !!empresa.tiene_descanso;
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const [fichaje, setFichaje]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [ahora, setAhora]         = useState(new Date());
  const [tabAdmin, setTabAdmin]   = useState("hoy");
  const [fichajes, setFichajes]   = useState([]);
  const [mesVer, setMesVer]       = useState(new Date().toISOString().slice(0,7));
  const [editando, setEditando]   = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [showAusencia, setShowAusencia] = useState(false);
  const [ausenciaForm, setAusenciaForm] = useState({ empleadoId:"", fechaInicio:todayStr(), fechaFin:todayStr(), tipo:"vacaciones", notas:"" });
  const [tabMain, setTabMain]           = useState("fichajes");
  const [nominas, setNominas]           = useState([]);
  const [subiendoNomina, setSubiendoNomina] = useState(false);
  const [nominaForm, setNominaForm]     = useState({ empleadoId:"", mes:String(new Date().getMonth()+1).padStart(2,"0"), año:String(new Date().getFullYear()) });
  const nominaFileRef = useRef();

  useEffect(()=>{ const t=setInterval(()=>setAhora(new Date()),1000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ cargarFichaje(); cargarFichajes(); cargarNominas(); },[user.id]);

  async function cargarFichaje() {
    setLoading(true);
    const hoy = new Date().toISOString().slice(0,10);
    const { data:f } = await supabase.from("fichajes").select("*").eq("empleado_id",user.id).eq("fecha",hoy).single();
    setFichaje(f||null); setLoading(false);
  }

  async function cargarFichajes() {
    const { data:fs } = await supabase.from("fichajes").select("*").order("fecha",{ascending:false}).order("entrada",{ascending:false});
    setFichajes(fs||[]);
  }

  async function cargarNominas() {
    let q = supabase.from("nominas").select("*").order("año",{ascending:false}).order("mes",{ascending:false});
    if(!isAdmin) q = q.eq("empleado_id", user.id);
    const { data:ns } = await q;
    setNominas(ns||[]);
  }

  async function subirNomina(file) {
    if(!file||!nominaForm.empleadoId||!nominaForm.mes||!nominaForm.año) return;
    setSubiendoNomina(true);
    const emp = (data.profiles||[]).find(p=>p.id===nominaForm.empleadoId);
    const path = `nominas/${nominaForm.empleadoId}/${nominaForm.mes}_${nominaForm.año}.pdf`;
    const { error:upErr } = await supabase.storage.from("pdfs").upload(path, file, {upsert:true});
    if(upErr){ alert("Error subiendo nómina: "+upErr.message); setSubiendoNomina(false); return; }
    // archivo_url almacena el storage path, no una URL pública
    await supabase.from("nominas").delete().eq("empleado_id",nominaForm.empleadoId).eq("mes",nominaForm.mes).eq("año",nominaForm.año);
    const { error:dbErr } = await supabase.from("nominas").insert([{
      empleado_id: nominaForm.empleadoId,
      empleado_nombre: emp?.nombre||"—",
      mes: nominaForm.mes,
      año: nominaForm.año,
      archivo_url: path,
    }]);
    if(dbErr) alert("Error guardando nómina: "+dbErr.message);
    else await cargarNominas();
    if(nominaFileRef.current) nominaFileRef.current.value="";
    setSubiendoNomina(false);
  }

  async function accion(campo) {
    const hoy = new Date().toISOString().slice(0,10);
    const ahora_iso = new Date().toISOString();
    if (!fichaje) {
      const { data:nuevo, error } = await supabase.from("fichajes").insert([{ empleado_id:user.id, empleado_nombre:user.nombre, fecha:hoy, entrada:ahora_iso }]).select().single();
      if (!error) { setFichaje(nuevo); cargarFichajes(); } else alert("Error: "+error.message);
    } else {
      const updates = { [campo]: ahora_iso };
      if (campo === "salida" && fichaje.entrada) {
        let ms = new Date(ahora_iso) - new Date(fichaje.entrada);
        if (TIENE_DESCANSO && fichaje.inicio_descanso && fichaje.fin_descanso) ms -= new Date(fichaje.fin_descanso) - new Date(fichaje.inicio_descanso);
        updates.horas_totales = Math.max(0, ms/3600000).toFixed(2);
      }
      const { data:actualizado, error } = await supabase.from("fichajes").update(updates).eq("id",fichaje.id).select().single();
      if (!error) { setFichaje(actualizado); cargarFichajes(); } else alert("Error: "+error.message);
    }
  }

  async function registrarAusencia() {
    if(!ausenciaForm.empleadoId||!ausenciaForm.fechaInicio||!ausenciaForm.tipo) return;
    const emp = (data.profiles||[]).find(p=>p.id===ausenciaForm.empleadoId);
    const fechaFin = ausenciaForm.fechaFin || ausenciaForm.fechaInicio;
    // Generar todos los días del rango
    const dias = [];
    let current = new Date(ausenciaForm.fechaInicio+"T12:00:00");
    const fin = new Date(fechaFin+"T12:00:00");
    while(current <= fin) {
      dias.push(current.toISOString().slice(0,10));
      current.setDate(current.getDate()+1);
    }
    const rows = dias.map(fecha=>({
      empleado_id: ausenciaForm.empleadoId,
      empleado_nombre: emp?.nombre||"—",
      fecha,
      entrada: null, salida: null, horas_totales: 0,
      notas: `[AUSENCIA: ${ausenciaForm.tipo.toUpperCase()}]${ausenciaForm.notas?" — "+ausenciaForm.notas:""}`,
      modificado_por: user.id,
    }));
    const { error } = await supabase.from("fichajes").insert(rows);
    if(!error){ cargarFichajes(); setShowAusencia(false); setAusenciaForm({empleadoId:"",fechaInicio:todayStr(),fechaFin:todayStr(),tipo:"vacaciones",notas:""}); }
    else alert("Error: "+error.message);
  }

  async function guardarEdicion() {
    const updates = {};
    if (editForm.entrada_str) updates.entrada = new Date(editando.fecha+"T"+editForm.entrada_str).toISOString();
    if (editForm.salida_str)  updates.salida  = new Date(editando.fecha+"T"+editForm.salida_str).toISOString();
    if (TIENE_DESCANSO) {
      if (editForm.inicio_descanso_str) updates.inicio_descanso = new Date(editando.fecha+"T"+editForm.inicio_descanso_str).toISOString();
      if (editForm.fin_descanso_str)    updates.fin_descanso    = new Date(editando.fecha+"T"+editForm.fin_descanso_str).toISOString();
    }
    const entrada = updates.entrada || editando.entrada;
    const salida  = updates.salida  || editando.salida;
    if (entrada && salida) {
      let ms = new Date(salida) - new Date(entrada);
      if (TIENE_DESCANSO) {
        const iniDesc = updates.inicio_descanso || editando.inicio_descanso;
        const finDesc = updates.fin_descanso    || editando.fin_descanso;
        if (iniDesc && finDesc) ms -= new Date(finDesc) - new Date(iniDesc);
      }
      updates.horas_totales = Math.max(0, ms/3600000).toFixed(2);
    }
    // Construir entrada [MOD ...] con el nuevo formato estructurado
    const ahora = new Date();
    const dd  = String(ahora.getDate()).padStart(2,"0");
    const mm  = String(ahora.getMonth()+1).padStart(2,"0");
    const hh  = String(ahora.getHours()).padStart(2,"0");
    const min = String(ahora.getMinutes()).padStart(2,"0");
    const parts = [];
    if (editForm.entrada_str && editForm.entrada_str !== formatHora(editando.entrada)) parts.push(`Entrada: ${formatHora(editando.entrada)||"—"}→${editForm.entrada_str}`);
    if (editForm.salida_str  && editForm.salida_str  !== formatHora(editando.salida))  parts.push(`Salida: ${formatHora(editando.salida)||"—"}→${editForm.salida_str}`);
    if (TIENE_DESCANSO) {
      if (editForm.inicio_descanso_str && editForm.inicio_descanso_str !== formatHora(editando.inicio_descanso)) parts.push(`Ini.desc: ${formatHora(editando.inicio_descanso)||"—"}→${editForm.inicio_descanso_str}`);
      if (editForm.fin_descanso_str    && editForm.fin_descanso_str    !== formatHora(editando.fin_descanso))    parts.push(`Fin.desc: ${formatHora(editando.fin_descanso)||"—"}→${editForm.fin_descanso_str}`);
    }
    const motivo = editForm.notas?.trim() || "";
    if (parts.length > 0 || motivo) {
      const linea = `[MOD ${dd}/${mm} ${hh}:${min}]${parts.length > 0 ? " "+parts.join(" | ") : ""}${motivo ? " | Motivo: "+motivo : ""}`;
      updates.notas = (editando.notas ? editando.notas + "\n" : "") + linea;
    }
    updates.modificado_por = user.id;
    if (!editando.id) {
      updates.empleado_id     = editando.empleado_id;
      updates.empleado_nombre = editando.empleado_nombre;
      updates.fecha           = editando.fecha;
      const { error } = await supabase.from("fichajes").insert([updates]);
      if (!error) { await cargarFichajes(); setEditando(null); } else alert("Error: "+error.message);
    } else {
      const { error } = await supabase.from("fichajes").update(updates).eq("id",editando.id);
      if (!error) { await Promise.all([cargarFichajes(), cargarFichaje()]); setEditando(null); } else alert("Error: "+error.message);
    }
  }

  function formatHora(iso) { if(!iso) return "—"; return new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}); }
  function calcHoras(f) {
    if(!f.entrada||!f.salida) return null;
    let ms = new Date(f.salida)-new Date(f.entrada);
    if(TIENE_DESCANSO && f.inicio_descanso&&f.fin_descanso) ms -= new Date(f.fin_descanso)-new Date(f.inicio_descanso);
    return Math.max(0,ms/3600000);
  }

  const estadoFichaje = !fichaje || !fichaje.entrada ? "sin_fichar"
    : fichaje.salida ? "completado"
    : !TIENE_DESCANSO ? "trabajando"
    : !fichaje.inicio_descanso ? "trabajando"
    : !fichaje.fin_descanso ? "en_descanso"
    : "trabajando";

  const botonesAccion = {
    sin_fichar:  [{label:"Fichar entrada", campo:"entrada", color:T.green, bg:T.greenLight, border:"#bbf7d0"}],
    trabajando:  TIENE_DESCANSO
      ? [{label:"Inicio descanso", campo:"inicio_descanso", color:"#d97706", bg:"#fffbeb", border:"#fde68a"},{label:"Fichar salida",campo:"salida",color:T.red,bg:T.redLight,border:"#fecaca"}]
      : [{label:"Fichar salida", campo:"salida", color:T.red, bg:T.redLight, border:"#fecaca"}],
    en_descanso: [{label:"▶ Fin descanso", campo:"fin_descanso", color:T.green, bg:T.greenLight, border:"#bbf7d0"}],
    completado:  [],
  };

  const fichajesHoy = fichajes.filter(f=>f.fecha===new Date().toISOString().slice(0,10));
  const fichajesMes = fichajes.filter(f=>(f.fecha||"").startsWith(mesVer));

  // Estado de cada empleado hoy
  function estadoEmpleadoHoy(empId) {
    const f = fichajesHoy.find(x=>x.empleado_id===empId);
    if(!f) return "ausente";
    const isAus = (f.notas||"").startsWith("[AUSENCIA:");
    if(isAus) return "ausencia";
    if(f.salida) return "completado";
    if(TIENE_DESCANSO && f.inicio_descanso && !f.fin_descanso) return "descanso";
    if(f.entrada) return "trabajando";
    return "ausente";
  }

  const ESTADO_CONFIG = {
    trabajando:  { label:"Trabajando",  color:T.green,   bg:"#dcfce7", dot:"#16a34a" },
    descanso:    { label:"Descanso",    color:"#d97706", bg:"#fef9c3", dot:"#ca8a04" },
    completado:  { label:"Completado",  color:"#64748b", bg:T.surface, dot:T.muted },
    ausencia:    { label:"Ausencia",    color:"#0284c7", bg:"#e0f2fe", dot:"#0284c7" },
    ausente:     { label:"Sin fichar",  color:T.muted,   bg:T.bg, dot:T.border  },
  };

  async function exportarPDF(lista, titulo) {
    try {
      const JsPDF = await (async()=>{ if(window.jspdf?.jsPDF) return window.jspdf.jsPDF; return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); }); })();
      const doc = new JsPDF({unit:"mm",format:"a4"});
      const [O,W,D,G] = [[29,78,216],[255,255,255],[15,23,42],[100,116,139]];
      doc.setFillColor(...O); doc.rect(0,0,210,28,"F");
      doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
      doc.text("REGISTRO DE JORNADA LABORAL",12,12);
      doc.setFontSize(9); doc.setFont("helvetica","normal");
      doc.text(titulo,12,20); doc.text("Generado: "+new Date().toLocaleDateString("es-ES"),198,20,{align:"right"});
      let y=34;
      doc.setFillColor(226,232,240); doc.rect(10,y,190,8,"F");
      doc.setTextColor(...D); doc.setFontSize(8); doc.setFont("helvetica","bold");
      if(TIENE_DESCANSO){
        ["Empleado","Fecha","Entrada","Salida","Descanso","Horas"].forEach((h,i)=>{ doc.text(h,[14,48,82,106,130,168][i],y+5.5); });
      } else {
        ["Empleado","Fecha","Entrada","Salida","Horas"].forEach((h,i)=>{ doc.text(h,[14,52,92,122,164][i],y+5.5); });
      }
      y+=10;
      lista.forEach((f,idx)=>{
        const modLines = (f.notas||"").split("\n").filter(l=>l.startsWith("[MOD "));
        const wrappedMods = modLines.map(l=>doc.splitTextToSize(l,182));
        const extraH = wrappedMods.reduce((s,lines)=>s+lines.length*4,0);
        const rowH = 8 + (extraH > 0 ? extraH + 2 : 0);
        if(idx%2===0){ doc.setFillColor(248,250,252); doc.rect(10,y-1,190,rowH,"F"); }
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...D);
        const horas = calcHoras(f);
        const isAus = (f.notas||"").startsWith("[AUSENCIA:");
        if(TIENE_DESCANSO){
          const desc = f.inicio_descanso&&f.fin_descanso ? `${formatHora(f.inicio_descanso)}-${formatHora(f.fin_descanso)}` : "—";
          [f.empleado_nombre||"—",f.fecha||"—",isAus?"AUSENCIA":formatHora(f.entrada),isAus?"":formatHora(f.salida),desc,isAus?f.notas.slice(0,20):horas?horas.toFixed(2)+"h":"—"].forEach((v,i)=>{ doc.text((v||"—").slice(0,18),[14,48,82,106,130,168][i],y+4); });
        } else {
          [f.empleado_nombre||"—",f.fecha||"—",isAus?"AUSENCIA":formatHora(f.entrada),isAus?"":formatHora(f.salida),isAus?f.notas.slice(0,20):horas?horas.toFixed(2)+"h":"—"].forEach((v,i)=>{ doc.text((v||"—").slice(0,18),[14,52,92,122,164][i],y+4); });
        }
        if(wrappedMods.length > 0){
          let ly = y+9; doc.setFontSize(7); doc.setTextColor(...G);
          wrappedMods.forEach(lines=>{ lines.forEach(line=>{ doc.text(line,14,ly); ly+=4; }); });
          doc.setTextColor(...D); doc.setFontSize(8);
        }
        y+=rowH; if(y>265){ doc.addPage(); y=20; }
      });
      const totalH = lista.filter(f=>!((f.notas||"").startsWith("[AUSENCIA:"))).reduce((s,f)=>s+(parseFloat(f.horas_totales)||0),0);
      y+=4; doc.setFillColor(...O); doc.rect(10,y,190,9,"F"); doc.setTextColor(...W); doc.setFont("helvetica","bold"); doc.setFontSize(9);
      doc.text("TOTAL HORAS:",14,y+6); doc.text(totalH.toFixed(2)+" h",198,y+6,{align:"right"});
      const ph=doc.internal.pageSize.height;
      doc.setFillColor(...D); doc.rect(0,ph-10,210,10,"F"); doc.setTextColor(100,116,139); doc.setFontSize(7); doc.setFont("helvetica","normal");
      doc.text("Registro de jornada laboral — Ley 8/2019 — Conservar 4 años",105,ph-4,{align:"center"});
      doc.save(`registro_jornada_${titulo.replace(/ /g,"_")}.pdf`);
    } catch(e){ alert("Error al generar PDF"); }
  }

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 4px",fontFamily:"'Sora',sans-serif" }}>Fichaje</h1>
        <p style={{ color:T.muted,fontSize:13,margin:0 }}>{ahora.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</p>
      </div>

      {/* Tabs principales */}
      <div style={{ display:"flex",gap:6,marginBottom:16 }}>
        {[{k:"fichajes",l:"Fichajes"},{k:"nominas",l:"Nóminas"}].map(t=>(
          <button key={t.k} onClick={()=>setTabMain(t.k)}
            style={{ padding:"8px 18px",borderRadius:20,border:`1px solid ${tabMain===t.k?T.accent:T.border}`,background:tabMain===t.k?T.accent+"22":T.card,color:tabMain===t.k?T.accent:T.sub,fontSize:13,fontWeight:tabMain===t.k?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
            {t.l}
          </button>
        ))}
      </div>

      {tabMain==="fichajes"&&(<>
      {/* Panel empleado — compacto */}
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,flex:1,minWidth:200 }}>
          <Ava name={user.nombre||"?"} size={40} color={user.color||T.accent}/>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:T.text }}>{user.nombre}</div>
            <div style={{ fontSize:22,fontWeight:800,color:T.text,fontFamily:"'Sora',sans-serif",letterSpacing:1,lineHeight:1.1 }}>
              {ahora.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </div>
          </div>
        </div>
        {loading ? <div style={{ color:T.muted,fontSize:13 }}>Cargando...</div>
        : estadoFichaje==="completado" ? (
          <div style={{ padding:"10px 16px",background:T.greenLight,borderRadius:10,border:"1px solid #bbf7d0",fontSize:13,fontWeight:600,color:T.green }}>
            Jornada completada · {parseFloat(fichaje?.horas_totales||0).toFixed(2)}h
          </div>
        ) : (
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {fichaje?.entrada&&<div style={{ fontSize:11,color:T.muted,display:"flex",alignItems:"center",gap:6 }}><span>{formatHora(fichaje.entrada)}</span>{TIENE_DESCANSO&&fichaje.inicio_descanso&&<span>{formatHora(fichaje.inicio_descanso)}{fichaje.fin_descanso?` → ${formatHora(fichaje.fin_descanso)}`:""}</span>}</div>}
            {(botonesAccion[estadoFichaje]||[]).map(btn=>(
              <button key={btn.campo} onClick={()=>accion(btn.campo)}
                style={{ padding:"10px 18px",borderRadius:10,border:`2px solid ${btn.border}`,background:btn.bg,color:btn.color,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panel admin */}
      {isAdmin && (
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {/* Grid visual de empleados HOY */}
          <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8 }}>
              <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Estado de hoy</h2>
              <div style={{ display:"flex",gap:6 }}>
                <Btn ch="+ Ausencia" onClick={()=>setShowAusencia(true)} v="g" sm/>
                <Btn ch="Exportar PDF" onClick={()=>exportarPDF(fichajesHoy,"Hoy "+new Date().toLocaleDateString("es-ES"))} v="b" sm/>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?140:160}px,1fr))`,gap:10 }}>
              {(data.profiles||[]).filter(emp=>emp.ficha!==false).map(emp=>{
                const estado = estadoEmpleadoHoy(emp.id);
                const cfg = ESTADO_CONFIG[estado];
                const fHoy = fichajesHoy.find(f=>f.empleado_id===emp.id);
                const horas = fHoy ? calcHoras(fHoy) : null;
                return (
                  <div key={emp.id} style={{ background:cfg.bg,borderRadius:12,padding:"12px",border:`1px solid ${cfg.color}20`,position:"relative" }}>
                    <div style={{ position:"absolute",top:10,right:10,width:10,height:10,borderRadius:"50%",background:cfg.dot }}/>
                    <Ava name={emp.nombre||"?"} size={36} color={emp.color||T.accent}/>
                    <div style={{ fontSize:12,fontWeight:700,color:T.text,marginTop:8,marginBottom:2,lineHeight:1.2 }}>{emp.nombre}</div>
                    <div style={{ fontSize:11,fontWeight:600,color:cfg.color,marginBottom:fHoy?4:0 }}>{cfg.label}</div>
                    {fHoy&&!((fHoy.notas||"").startsWith("[AUSENCIA:"))&&(
                      <div style={{ fontSize:10,color:T.muted }}>
                        {fHoy.entrada?`${formatHora(fHoy.entrada)}`:""}
                        {fHoy.salida?` · ${formatHora(fHoy.salida)}`:""}
                        {horas?` · ${horas.toFixed(1)}h`:""}
                      </div>
                    )}
                    {fHoy&&(fHoy.notas||"").startsWith("[AUSENCIA:")&&(
                      <div style={{ fontSize:10,color:cfg.color,fontWeight:600 }}>{fHoy.notas.match(/\[AUSENCIA: ([^\]]+)\]/)?.[1]||""}</div>
                    )}
                    {isAdmin&&fHoy&&<button onClick={()=>{ setEditando(fHoy); setEditForm({entrada_str:fHoy.entrada?formatHora(fHoy.entrada):"",salida_str:fHoy.salida?formatHora(fHoy.salida):"",inicio_descanso_str:fHoy.inicio_descanso?formatHora(fHoy.inicio_descanso):"",fin_descanso_str:fHoy.fin_descanso?formatHora(fHoy.fin_descanso):"",notas:""}); }} style={{ marginTop:6,fontSize:10,padding:"2px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.card,color:T.sub,cursor:"pointer",width:"100%" }}>Editar</button>}
                    {isAdmin&&!fHoy&&<button onClick={()=>{ const hoy=new Date().toISOString().slice(0,10); setEditando({id:null,empleado_id:emp.id,empleado_nombre:emp.nombre,fecha:hoy}); setEditForm({entrada_str:"",salida_str:"",inicio_descanso_str:"",fin_descanso_str:"",notas:""}); }} style={{ marginTop:6,fontSize:10,padding:"2px 8px",borderRadius:6,border:`1px solid ${T.accent}`,background:T.accentLight,color:T.accent,cursor:"pointer",width:"100%" }}>+ Crear fichaje</button>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historial */}
          <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px" }}>
            <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",gap:6 }}>
                {[{k:"mes",l:"Por mes"},{k:"empleado",l:"Por empleado"},{k:"calendario",l:"Calendario"}].map(t=>(
                  <button key={t.k} onClick={()=>setTabAdmin(t.k)}
                    style={{ padding:"6px 14px",borderRadius:20,border:`1px solid ${tabAdmin===t.k?T.accent:T.border}`,background:tabAdmin===t.k?T.accent+"22":T.card,color:tabAdmin===t.k?T.accent:T.sub,fontSize:12,fontWeight:tabAdmin===t.k?600:400,cursor:"pointer" }}>
                    {t.l}
                  </button>
                ))}
              </div>
              <Btn ch="Exportar PDF" onClick={()=>exportarPDF(tabAdmin==="mes"?fichajesMes:fichajes,tabAdmin==="mes"?"Mes "+mesVer:"Todos")} v="b" sm/>
            </div>

            {tabAdmin==="mes"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:4 }}>
                  <input type="month" value={mesVer} onChange={e=>setMesVer(e.target.value)} style={{...inp({width:"auto",padding:"6px 10px"})}}/>
                  <span style={{ fontSize:12,color:T.muted }}>{fichajesMes.length} registros · {fichajesMes.filter(f=>!((f.notas||"").startsWith("[AUSENCIA:"))).reduce((s,f)=>s+(parseFloat(f.horas_totales)||0),0).toFixed(2)}h total</span>
                </div>
                {fichajesMes.length===0&&<div style={{ textAlign:"center",padding:"20px",color:T.muted,fontSize:13 }}>Sin fichajes este mes</div>}
                {fichajesMes.filter(f=>{ const emp=(data.profiles||[]).find(p=>p.id===f.empleado_id); return emp?.ficha!==false; }).map(f=>{
                  const isAus=(f.notas||"").startsWith("[AUSENCIA:");
                  const horas=calcHoras(f);
                  return (
                    <div key={f.id} style={{ background:isAus?"#eff6ff":T.card,border:`1px solid ${isAus?"#bfdbfe":T.border}`,borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:12 }}>
                      <Ava name={f.empleado_nombre||"?"} size={30} color={(data.profiles||[]).find(p=>p.id===f.empleado_id)?.color||T.accent}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:600,color:T.text }}>{f.empleado_nombre} <span style={{ color:T.muted,fontWeight:400 }}>· {f.fecha}</span></div>
                        {isAus?<div style={{ fontSize:11,color:"#0284c7",fontWeight:600 }}>{f.notas}</div>
                        :<div style={{ fontSize:11,color:T.muted }}>{formatHora(f.entrada)} {f.salida?`· ${formatHora(f.salida)}`:""} {TIENE_DESCANSO&&f.inicio_descanso?`· ${formatHora(f.inicio_descanso)}${f.fin_descanso?`→${formatHora(f.fin_descanso)}`:""}`:""}
                        </div>}
                      </div>
                      <div style={{ fontSize:16,fontWeight:700,color:T.accent,fontFamily:"'Sora',sans-serif",flexShrink:0 }}>{horas?horas.toFixed(2)+"h":isAus?"—":"En curso"}</div>
                      <button onClick={()=>{ setEditando(f); setEditForm({entrada_str:f.entrada?formatHora(f.entrada):"",salida_str:f.salida?formatHora(f.salida):"",inicio_descanso_str:f.inicio_descanso?formatHora(f.inicio_descanso):"",fin_descanso_str:f.fin_descanso?formatHora(f.fin_descanso):"",notas:""}); }} style={{ padding:"4px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",flexShrink:0 }}>Editar</button>
                    </div>
                  );
                })}
              </div>
            )}

            {tabAdmin==="empleado"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {(data.profiles||[]).filter(emp=>emp.ficha!==false).map(emp=>{
                  const empF=fichajes.filter(f=>f.empleado_id===emp.id&&!((f.notas||"").startsWith("[AUSENCIA:")));
                  const totalH=empF.reduce((s,f)=>s+(parseFloat(f.horas_totales)||0),0);
                  const ausencias=fichajes.filter(f=>f.empleado_id===emp.id&&(f.notas||"").startsWith("[AUSENCIA:")).length;
                  return (
                    <div key={emp.id} style={{ background:T.surface,borderRadius:10,padding:"14px",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:14 }}>
                      <Ava name={emp.nombre||"?"} size={38} color={emp.color||T.accent}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,fontWeight:700,color:T.text }}>{emp.nombre}</div>
                        <div style={{ fontSize:11,color:T.muted }}>{empF.length} jornadas · {ausencias} ausencias</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:20,fontWeight:700,color:T.accent,fontFamily:"'Sora',sans-serif" }}>{totalH.toFixed(2)}h</div>
                      </div>
                      <Btn ch="PDF" onClick={()=>exportarPDF(fichajes.filter(f=>f.empleado_id===emp.id),emp.nombre)} v="g" sm/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        {tabAdmin==="calendario"&&(
          <Modal onClose={()=>setTabAdmin("mes")} w={1000}>
            <div style={{ padding:"20px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                <h2 style={{ fontSize:16,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Control de jornada mensual</h2>
                <button onClick={()=>setTabAdmin("mes")} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,cursor:"pointer",fontSize:18,color:T.muted }}>×</button>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap" }}>
                <input type="month" value={mesVer} onChange={e=>setMesVer(e.target.value)} style={{...inp({width:"auto",padding:"6px 10px"})}}/>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {[{c:T.green,l:"Trabajado"},{c:"#f59e0b",l:"En curso"},{c:"#0284c7",l:"Vacaciones"},{c:T.red,l:"Baja"},{c:"#7c3aed",l:"Médico"},{c:T.muted,l:"Ausencia"},{c:T.border,l:"Sin datos"}].map(({c,l})=>(
                    <div key={l} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <div style={{ width:10,height:10,borderRadius:2,background:c,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:T.sub }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(()=>{
                const [year,month] = mesVer.split("-").map(Number);
                const daysInMonth = new Date(year,month,0).getDate();
                const empsFich = (data.profiles||[]).filter(emp=>emp.ficha!==false&&emp.activo!==false);

                const getCellInfo = (empId, dia) => {
                  const fecha = `${year}-${String(month).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                  const f = fichajes.find(x=>x.empleado_id===empId&&x.fecha===fecha);
                  if(!f) return null;
                  const n = f.notas||"";
                  if(n.includes("AUSENCIA: VACACIONES")) return {color:"#0284c7",title:"Vacaciones"};
                  if(n.includes("AUSENCIA: BAJA"))       return {color:T.red,title:"Baja laboral"};
                  if(n.includes("AUSENCIA: MEDICO")||n.includes("AUSENCIA: VISITA")) return {color:"#7c3aed",title:"Médico"};
                  if(n.includes("AUSENCIA:"))             return {color:T.muted,title:"Ausencia"};
                  if(f.salida)  return {color:T.green,title:`${f.horas_totales||"?"}h`};
                  if(f.entrada) return {color:"#f59e0b",title:"En curso"};
                  return null;
                };

                return (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ borderCollapse:"collapse",width:"100%" }}>
                      <thead>
                        <tr>
                          <th style={{ padding:"8px 12px",textAlign:"left",fontSize:12,color:T.sub,fontWeight:600,minWidth:140,position:"sticky",left:0,background:T.card,borderBottom:`2px solid ${T.border}`,zIndex:2 }}>Empleado</th>
                          {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                            const fecha = new Date(year,month-1,d);
                            const dow = fecha.getDay();
                            const isWeekend = dow===0||dow===6;
                            const isToday = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`===new Date().toISOString().slice(0,10);
                            const dayNames = ["D","L","M","X","J","V","S"];
                            return (
                              <th key={d} style={{ padding:"4px 2px",fontSize:10,color:isToday?T.accent:isWeekend?"#cbd5e1":T.muted,fontWeight:isToday?700:400,minWidth:26,background:isWeekend?T.bg:T.card,borderBottom:`2px solid ${T.border}`,textAlign:"center" }}>
                                <div style={{ fontWeight:600 }}>{d}</div>
                                <div style={{ fontSize:9 }}>{dayNames[dow]}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {empsFich.map((emp,ri)=>(
                          <tr key={emp.id} style={{ background:ri%2===0?T.card:T.surface }}>
                            <td style={{ padding:"6px 12px",fontSize:12,fontWeight:600,color:T.text,position:"sticky",left:0,background:ri%2===0?T.card:T.surface,borderRight:`2px solid ${T.border}`,zIndex:1 }}>
                              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                                <div style={{ width:8,height:8,borderRadius:"50%",background:emp.color||T.accent,flexShrink:0 }}/>
                                {emp.nombre}
                              </div>
                            </td>
                            {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                              const fecha = new Date(year,month-1,d);
                              const isWeekend = fecha.getDay()===0||fecha.getDay()===6;
                              const nowDate = new Date(); nowDate.setHours(0,0,0,0);
                              fecha.setHours(0,0,0,0);
                              const isFuture = fecha.getTime() > nowDate.getTime();
                              const info = getCellInfo(emp.id,d);
                              return (
                                <td key={d} style={{ padding:"3px 2px",textAlign:"center",background:isWeekend?(ri%2===0?T.surface:"#eef2f7"):"transparent" }}>
                                  {!isFuture&&(
                                    <div title={info?.title||"Sin datos"} style={{ width:20,height:20,borderRadius:4,background:info?info.color:T.border,margin:"0 auto" }}/>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </Modal>
        )}
        </div>
      )}
      </>)}

      {/* Panel Nóminas */}
      {tabMain==="nominas"&&(
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {isAdmin&&(
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px" }}>
              <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 16px",fontFamily:"'Sora',sans-serif" }}>Subir nómina</h2>
              <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto auto auto",gap:12,alignItems:"flex-end" }}>
                <Field label="Empleado *">
                  <select value={nominaForm.empleadoId} onChange={e=>setNominaForm(p=>({...p,empleadoId:e.target.value}))} style={inp()}>
                    <option value="">Selecciona empleado</option>
                    {(data.profiles||[]).filter(p=>p.activo!==false).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Mes">
                  <select value={nominaForm.mes} onChange={e=>setNominaForm(p=>({...p,mes:e.target.value}))} style={{...inp(),width:isMobile?"100%":130}}>
                    {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i)=>(
                      <option key={m} value={m}>{["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][i]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Año">
                  <select value={nominaForm.año} onChange={e=>setNominaForm(p=>({...p,año:e.target.value}))} style={{...inp(),width:isMobile?"100%":90}}>
                    {[2023,2024,2025,2026,2027].map(y=><option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </Field>
                <div>
                  <input ref={nominaFileRef} type="file" accept="application/pdf" style={{ display:"none" }}
                    onChange={e=>{ if(e.target.files[0]) subirNomina(e.target.files[0]); }}/>
                  <button onClick={()=>{ if(!nominaForm.empleadoId){ alert("Selecciona un empleado primero"); return; } nominaFileRef.current?.click(); }}
                    disabled={subiendoNomina}
                    style={{ padding:"11px 20px",borderRadius:10,border:"none",background:subiendoNomina?T.muted:T.accent,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",width:isMobile?"100%":"auto" }}>
                    {subiendoNomina?"Subiendo...":"Adjuntar PDF"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px" }}>
            <h2 style={{ fontSize:14,fontWeight:700,color:T.text,margin:"0 0 14px",fontFamily:"'Sora',sans-serif" }}>{isAdmin?"Todas las nóminas":"Mis nóminas"}</h2>
            {nominas.length===0&&(
              <div style={{ textAlign:"center",padding:"32px",color:T.muted,fontSize:13 }}>{isAdmin?"No hay nóminas subidas aún.":"No tienes nóminas disponibles todavía."}</div>
            )}
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {nominas.map(n=>{
                const mesNombre = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][parseInt(n.mes,10)]||n.mes;
                return (
                  <div key={n.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:T.surface,borderRadius:10,border:`1px solid ${T.border}` }}>
                    <div style={{ width:40,height:40,borderRadius:10,background:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}></div>
                    <div style={{ flex:1,minWidth:0 }}>
                      {isAdmin&&<div style={{ fontSize:11,color:T.muted,marginBottom:2 }}>{n.empleado_nombre}</div>}
                      <div style={{ fontSize:14,fontWeight:600,color:T.text }}>{mesNombre} {n.año}</div>
                    </div>
                    <BotonNomina n={n} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal ausencia */}
      {showAusencia&&isAdmin&&(
        <Modal onClose={()=>setShowAusencia(false)} w={460}>
          <MHead title="Registrar ausencia" onClose={()=>setShowAusencia(false)}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
            <Field label="Empleado *">
              <select value={ausenciaForm.empleadoId} onChange={e=>setAusenciaForm(p=>({...p,empleadoId:e.target.value}))} style={inp()}>
                <option value="">Selecciona empleado</option>
                {(data.profiles||[]).filter(p=>p.ficha!==false).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Fecha *">
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div>
                  <label style={{ fontSize:11,color:T.muted,display:"block",marginBottom:4 }}>Desde</label>
                  <input type="date" value={ausenciaForm.fechaInicio} onChange={e=>setAusenciaForm(p=>({...p,fechaInicio:e.target.value}))} style={inp()}/>
                </div>
                <div>
                  <label style={{ fontSize:11,color:T.muted,display:"block",marginBottom:4 }}>Hasta</label>
                  <input type="date" value={ausenciaForm.fechaFin} onChange={e=>setAusenciaForm(p=>({...p,fechaFin:e.target.value}))} style={inp()} min={ausenciaForm.fechaInicio}/>
                </div>
              </div>
              {ausenciaForm.fechaInicio&&ausenciaForm.fechaFin&&ausenciaForm.fechaFin>=ausenciaForm.fechaInicio&&(
                <div style={{ fontSize:11,color:T.accent,marginTop:4,fontWeight:600 }}>
                  {Math.round((new Date(ausenciaForm.fechaFin)-new Date(ausenciaForm.fechaInicio))/86400000)+1} día(s) seleccionado(s)
                </div>
              )}
            </Field>
            <Field label="Tipo de ausencia *">
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {[{k:"vacaciones",l:"Vacaciones"},{k:"medico",l:"Visita médica"},{k:"baja",l:"Baja laboral"},{k:"personales",l:"Personales"},{k:"otros",l:"Otros"}].map(t=>(
                  <button type="button" key={t.k} onClick={()=>setAusenciaForm(p=>({...p,tipo:t.k}))}
                    style={{ padding:"8px 14px",borderRadius:9,border:`2px solid ${ausenciaForm.tipo===t.k?T.accent:T.border}`,background:ausenciaForm.tipo===t.k?T.accent+"22":T.card,color:ausenciaForm.tipo===t.k?T.accent:T.sub,fontSize:12,fontWeight:ausenciaForm.tipo===t.k?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notas"><textarea value={ausenciaForm.notas} onChange={e=>setAusenciaForm(p=>({...p,notas:e.target.value}))} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Motivo, duración..."/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setShowAusencia(false)} v="g"/>
              <Btn ch="Registrar ausencia" onClick={registrarAusencia} disabled={!ausenciaForm.empleadoId||!ausenciaForm.fechaInicio}/>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal editar fichaje */}
      {editando&&(
        <Modal onClose={()=>setEditando(null)} w={480}>
          <MHead title="Editar fichaje" sub={`${editando.empleado_nombre} · ${editando.fecha}`} onClose={()=>setEditando(null)}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:13 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Field label="Entrada"><input type="time" value={editForm.entrada_str||""} onChange={e=>setEditForm(p=>({...p,entrada_str:e.target.value}))} style={inp()}/></Field>
              <Field label="Salida"><input type="time" value={editForm.salida_str||""} onChange={e=>setEditForm(p=>({...p,salida_str:e.target.value}))} style={inp()}/></Field>
              {TIENE_DESCANSO&&<>
                <Field label="Inicio descanso"><input type="time" value={editForm.inicio_descanso_str||""} onChange={e=>setEditForm(p=>({...p,inicio_descanso_str:e.target.value}))} style={inp()}/></Field>
                <Field label="Fin descanso"><input type="time" value={editForm.fin_descanso_str||""} onChange={e=>setEditForm(p=>({...p,fin_descanso_str:e.target.value}))} style={inp()}/></Field>
              </>}
            </div>
            <Field label="Motivo de edición"><textarea value={editForm.notas||""} onChange={e=>setEditForm(p=>({...p,notas:e.target.value}))} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Razón del ajuste..."/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setEditando(null)} v="g"/>
              <Btn ch="Guardar cambios" onClick={guardarEdicion}/>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


function NuevoUsuarioModal({ onClose, onCreated, colores }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ nombre:"", email:"", password:"", role:"tecnico", color:"#1d4ed8", telefono:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  async function crear() {
    if(!form.nombre.trim()||!form.email.trim()||!form.password.trim()){ setError("Nombre, email y contraseña son obligatorios."); return; }
    if(form.password.length < 6){ setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/usuarios", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accion:"crear", email:form.email.trim(), password:form.password,
          nombre:form.nombre.trim(), telefono:form.telefono||null,
          role:form.role, color:form.color,
        }),
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json.error||"Error al crear usuario");
      onCreated();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={500}>
      <MHead title="Nuevo usuario" onClose={onClose}/>
      <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Nombre completo *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Nombre y apellidos"/></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="6XX XXX XXX"/></Field>
        </div>
        <Field label="Email *"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="correo@empresa.com"/></Field>
        <Field label="Contraseña *"><input type="password" value={form.password} onChange={e=>upd("password",e.target.value)} style={inp()} placeholder="Mínimo 6 caracteres"/></Field>
        <Field label="Rol">
          <div style={{ display:"flex",gap:8 }}>
            {[{k:"admin",l:"Admin"},{k:"tecnico",l:"Técnico"}].map(r=>(
              <button type="button" key={r.k} onClick={()=>upd("role",r.k)}
                style={{ flex:1,padding:"10px",borderRadius:9,border:`2px solid ${form.role===r.k?T.accent:T.border}`,background:form.role===r.k?T.accent+"22":T.card,color:form.role===r.k?T.accent:T.sub,fontSize:13,fontWeight:form.role===r.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {r.k==="admin"?"Admin":"Técnico"}
              </button>
            ))}
          </div>
          <p style={{ fontSize:11,color:T.muted,marginTop:4 }}>{form.role==="admin"?"Acceso completo a toda la app.":"Ve sus averías, mantenimientos y contratos asignados."}</p>
        </Field>
        <Field label="Color identificativo">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {colores.map(c=>(
              <div key={c} onClick={()=>upd("color",c)} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #0f172a":"3px solid transparent",boxSizing:"border-box" }}/>
            ))}
          </div>
        </Field>
        {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear usuario"} onClick={crear} disabled={saving||!form.nombre.trim()||!form.email.trim()||!form.password.trim()}/>
        </div>
      </div>
    </Modal>
  );
}

function EditarUsuarioModal({ u, onClose, onSaved, colores }) {
  const [form, setForm] = useState({ nombre:u.nombre||"", email:u.email||"", telefono:u.telefono||"", role:u.role||"tecnico", color:u.color||"#1d4ed8", activo:u.activo!==false, newPassword:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  async function guardar() {
    setSaving(true); setError("");
    try {
      const { error:profErr } = await supabase.from("profiles").update({
        nombre:form.nombre.trim(), telefono:form.telefono||null,
        role:form.role, color:form.color, activo:form.activo,
      }).eq("id",u.id);
      if(profErr) throw profErr;
      onSaved();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  async function eliminar() {
    if(!window.confirm(`¿Eliminar a ${u.nombre}? Perderá el acceso permanentemente.`)) return;
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/usuarios", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accion:"eliminar", userId:u.id }),
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json.error||"Error al eliminar");
      onSaved();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={500}>
      <MHead title="Editar usuario" sub={u.email} onClose={onClose}/>
      <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Nombre completo"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()}/></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()}/></Field>
        </div>
        <Field label="Rol">
          <div style={{ display:"flex",gap:8 }}>
            {[{k:"admin",l:"Admin"},{k:"tecnico",l:"Técnico"}].map(r=>(
              <button type="button" key={r.k} onClick={()=>upd("role",r.k)}
                style={{ flex:1,padding:"10px",borderRadius:9,border:`2px solid ${form.role===r.k?T.accent:T.border}`,background:form.role===r.k?T.accent+"22":T.card,color:form.role===r.k?T.accent:T.sub,fontSize:13,fontWeight:form.role===r.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {r.l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color identificativo">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {colores.map(c=>(
              <div key={c} onClick={()=>upd("color",c)} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #0f172a":"3px solid transparent",boxSizing:"border-box" }}/>
            ))}
          </div>
        </Field>
        <div onClick={()=>upd("activo",!form.activo)}
          style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:form.activo?T.greenLight:T.redLight,borderRadius:10,border:`1px solid ${form.activo?"#bbf7d0":"#fecaca"}`,cursor:"pointer" }}>
          <div style={{ width:42,height:22,borderRadius:11,background:form.activo?T.green:T.red,position:"relative",transition:"background 0.2s",flexShrink:0 }}>
            <span style={{ position:"absolute",top:3,left:form.activo?22:3,width:16,height:16,borderRadius:"50%",background:T.card,transition:"left 0.2s" }}/>
          </div>
          <span style={{ fontSize:13,fontWeight:600,color:form.activo?T.green:T.red }}>{form.activo?"Usuario activo":"Usuario inactivo — no puede acceder"}</span>
        </div>
        {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
        <div style={{ display:"flex",justifyContent:"space-between",gap:8 }}>
          <Btn ch="Eliminar usuario" onClick={eliminar} v="d" sm/>
          <div style={{ display:"flex",gap:8 }}>
            <Btn ch="Cancelar" onClick={onClose} v="g"/>
            <Btn ch={saving?"Guardando...":"Guardar cambios"} onClick={guardar} disabled={saving||!form.nombre.trim()}/>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function UsuariosView({ techs, refresh, user }) {
  const isMobile = useIsMobile();
  const [showNew, setShowNew] = useState(false);
  const [editando, setEditando] = useState(null);
  const COLORES = ["#1d4ed8","#16a34a","#dc2626","#d97706","#7c3aed","#0d9488","#db2777","#ea580c","#0891b2","#65a30d"];

  const admins   = techs.filter(u=>u.role==="admin");
  const tecnicos = techs.filter(u=>u.role==="tecnico");

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 4px",fontFamily:"'Sora',sans-serif" }}>Usuarios</h1>
          <p style={{ color:T.muted,fontSize:13,margin:0 }}>{techs.length} usuarios · {admins.length} admins · {tecnicos.length} técnicos</p>
        </div>
        <button onClick={()=>_setTooltip("personal")} title="Ayuda de Personal" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        <Btn ch="+ Nuevo usuario" onClick={()=>setShowNew(true)}/>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:20,maxWidth:700 }}>
        {admins.length>0&&(
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>Administradores</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {admins.map(u=>(
                <div key={u.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:14 }}>
                  <Ava name={u.nombre||"?"} size={44} color={u.color||T.accent}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:2 }}>
                      {u.nombre}
                      {u.id===user.id&&<span style={{ fontSize:10,color:T.accent,fontWeight:600,marginLeft:8,padding:"1px 7px",borderRadius:20,background:T.accentLight }}>Tú</span>}
                    </div>
                    <div style={{ fontSize:12,color:T.muted,marginBottom:6 }}>{u.email}{u.telefono?` · ${u.telefono}`:""}</div>
                    <span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:"#fef3c7",color:"#92400e",fontWeight:600,border:"1px solid #fde68a" }}>Admin</span>
                    {!u.activo&&<span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.redLight,color:T.red,fontWeight:600,border:"1px solid #fecaca",marginLeft:6 }}>Inactivo</span>}
                  </div>
                  {u.id!==user.id&&<Btn ch="Editar" onClick={()=>setEditando(u)} v="g" sm/>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tecnicos.length>0&&(
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>Técnicos</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {tecnicos.map(u=>(
                <div key={u.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:14 }}>
                  <Ava name={u.nombre||"?"} size={44} color={u.color||T.accent}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:2 }}>{u.nombre}</div>
                    <div style={{ fontSize:12,color:T.muted,marginBottom:6 }}>{u.email}{u.telefono?` · ${u.telefono}`:""}</div>
                    <span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.greenLight,color:T.green,fontWeight:600,border:"1px solid #bbf7d0" }}>Técnico</span>
                    {!u.activo&&<span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.redLight,color:T.red,fontWeight:600,border:"1px solid #fecaca",marginLeft:6 }}>Inactivo</span>}
                  </div>
                  <Btn ch="Editar" onClick={()=>setEditando(u)} v="g" sm/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showNew&&<NuevoUsuarioModal onClose={()=>setShowNew(false)} onCreated={()=>{ refresh?.(); setShowNew(false); }} colores={COLORES}/>}
      {editando&&<EditarUsuarioModal u={editando} onClose={()=>setEditando(null)} onSaved={()=>{ refresh?.(); setEditando(null); }} colores={COLORES}/>}
    </div>
  );
}


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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("blch-darkmode") === "true");
  const isMobile = useIsMobile();
  const isAdmin  = user?.role === "admin";
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchVoiceRef = useRef(false);
  const fcmRequestedRef = useRef(false);
  const [searchVoiceActive, setSearchVoiceActive] = useState(false);
  const [tooltipActivo, setTooltipActivo] = useState(null);
  _setTooltip = setTooltipActivo;
  T = darkMode ? T_DARK : T_LIGHT;
  let SC = darkMode ? SC_DARK : SC_LIGHT;
  BS = mkBS(SC);
  MS = mkMS(SC);
  PS = mkPS(SC);
  OB_ESTADOS = mkOB_ESTADOS(SC);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session) loadUser(session.user.id); });
    supabase.auth.onAuthStateChange((_,session)=>{ if(session) loadUser(session.user.id); else setUser(null); });
  },[]);

  useEffect(()=>{
    localStorage.setItem("blch-darkmode", darkMode);
    document.body.style.background = darkMode ? "#0a0a0a" : "#f8fafc";
  },[darkMode]);

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
        <Sidebar user={user} view={view} setView={v=>{setView(v);if(isMobile)setSideOpen(false);}} onLogout={handleLogout} data={data} open={sideOpen} onToggle={()=>setSideOpen(p=>!p)} onClose={()=>setSideOpen(false)} darkMode={darkMode} onToggleDark={()=>setDarkMode(p=>!p)}/>
        <div style={{ flex:1, minWidth:0, paddingTop:isMobile?52:0, paddingBottom:isMobile?70:0, overflowY:"auto", minHeight:"100vh" }}>
          {view==="dashboard" &&isAdmin&&<Dashboard data={data} setView={setView} techs={techs}/>}
          {view==="calendario" &&<CalendarView data={data} refresh={loadAll} user={user}/>}
          {view==="avisos" &&<AvisosView data={data} user={user} onSelect={setSelected} onSelectMant={setSelectedMant} techs={techs} refresh={loadAll} empresa={empresa}/>}
          {view==="presupuestos" &&<PresupuestosList data={data} refresh={loadAll} user={user} empresa={empresa}/>}
          {view==="clientes" &&isAdmin&&<ClientesList data={data} refresh={loadAll} user={user}/>}
          {view==="formulario" &&isAdmin&&<FormularioView data={data} empresa={empresa}/>}
          {view==="contratos" &&<MantenimientoView data={data} user={user} refresh={loadAll} empresa={empresa}/>}
          {view==="empresa" &&isAdmin&&<EmpresaConfig empresa={empresa} setEmpresa={setEmpresa}/>}
          {view==="usuarios" &&isAdmin&&<UsuariosView techs={techs} refresh={loadAll} user={user}/>}
          {view==="fichajes" &&<FichajesView data={data} user={user} refresh={loadAll} empresa={empresa}/>}
          {view==="instalaciones_obras"&&<InstalacionesObrasView data={data} user={user} techs={techs} refresh={loadAll} empresa={empresa}/>}
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
