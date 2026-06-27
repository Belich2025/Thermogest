import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { MT_TIPOS } from "../../constants/status.js";
import { urgInfo } from "../../utils/dates.js";
import Ava from "../ui/Ava.jsx";

const SunIcon  = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/></svg>;
const MoonIcon = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

export default function Sidebar({ user, view, setView, onLogout, data, open, onToggle, onClose }) {
  const { T, SC, darkMode, setDarkMode } = useTheme();
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
    instalaciones_obras:[[instPendiente,SC.pendiente],[instEnCurso,SC.en_curso],[instPendF,SC.pendiente_facturar]],
    contratos:[[mtUrg,T.red]],
    fichajes:[[sinFichar,T.red]],
  };
  const Bdg=({n,c})=>n>0?<span style={{minWidth:18,height:18,borderRadius:9,background:c,color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 5px",flexShrink:0,lineHeight:1}}>{n}</span>:null;
  const NavItem=({l})=>{ const active=view===l.id; const bs=navBadges[l.id]||[]; return <button onClick={()=>{ setView(l.id); if(isMobile) onClose(); }} style={{ display:"flex",alignItems:"center",padding:"10px 13px",borderRadius:8,border:"none",background:active?T.accentLight:"transparent",color:active?T.accent:T.sub,fontSize:13,fontWeight:active?600:400,cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"'DM Sans',sans-serif",borderLeft:`3px solid ${active?T.accent:"transparent"}`,gap:6 }}><span style={{ flex:1 }}>{l.label}</span>{bs.map(([n,c],i)=><Bdg key={i} n={n} c={c}/>)}</button>; };
  const Footer=()=><div style={{ padding:"12px 14px",borderTop:`1px solid ${T.border}`,background:T.surface,flexShrink:0 }}><div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}><Ava name={user.nombre||"?"} size={30} color={user.color||T.accent}/><div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:12,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.nombre}</div><div style={{ fontSize:10,color:T.muted,textTransform:"uppercase" }}>{user.role}</div></div></div><button onClick={()=>setDarkMode(p=>!p)} style={{ display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:6 }}>{darkMode?<SunIcon/>:<MoonIcon/>}<span>{darkMode?"Modo claro":"Modo oscuro"}</span></button><button onClick={onLogout} style={{ width:"100%",padding:"7px",borderRadius:7,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Cerrar sesión</button></div>;
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
