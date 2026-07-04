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
import RevisionModal from "./components/shared/RevisionModal.jsx";
import RevisionDetalle from "./components/shared/RevisionDetalle.jsx";
import InstModal from "./components/shared/InstModal.jsx";
import PresupuestosList from "./components/views/PresupuestosList.jsx";
import ClientesList from "./components/views/ClientesList.jsx";
import AvisosView from "./components/views/AvisosView.jsx";
import MantenimientoView from "./components/views/MantenimientoView.jsx";


/* ─── THEME ──────────────────────────────────────────────────────────────── */
let T = T_LIGHT;
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

/* ─── MANTENIMIENTO: MantenimientoView extraído a components/views/MantenimientoView.jsx ─── */













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
          {view==="contratos" &&<MantenimientoView data={data} user={user} refresh={loadAll} empresa={empresa} onTooltip={setTooltipActivo}/>}
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
