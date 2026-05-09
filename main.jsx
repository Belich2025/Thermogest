import React, { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase.js'

/* ─── RESPONSIVE ────────────────────────────────────────────────────────── */
function useIsMobile() {
  const [v, setV] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

/* ─── THEME ─────────────────────────────────────────────────────────────── */
const T = {
  bg:"#f1f5f9", card:"#ffffff", surface:"#f8fafc",
  border:"#e2e8f0", borderDark:"#cbd5e1",
  accent:"#1d4ed8", accentLight:"#eff6ff",
  green:"#16a34a", greenLight:"#f0fdf4",
  red:"#dc2626", redLight:"#fef2f2",
  orange:"#d97706", orangeLight:"#fffbeb",
  teal:"#0d9488", tealLight:"#f0fdfa",
  purple:"#7c3aed", purpleLight:"#f5f3ff",
  text:"#0f172a", sub:"#475569", muted:"#94a3b8",
};

/* ─── STATUS ─────────────────────────────────────────────────────────────── */
const BS = {
  nueva:               { label:"Nueva",               color:"#7c3aed" },
  en_reparacion:       { label:"En reparación",       color:"#d97706" },
  pendiente_piezas:    { label:"Pendiente piezas",    color:"#dc2626" },
  presupuesto_enviado: { label:"Presupuesto enviado", color:"#0284c7" },
  cerrada:             { label:"Cerrada",             color:"#16a34a" },
};
const PS = {
  nuevo:    { label:"Nuevo",              color:"#7c3aed" },
  enviado:  { label:"Enviado",            color:"#d97706" },
  aceptado: { label:"Aceptado",           color:"#16a34a" },
  rechazado:{ label:"Rechazado",          color:"#dc2626" },
  facturado:{ label:"Facturado",          color:"#0284c7" },
};
const BS_ORDER = ["nueva","en_reparacion","pendiente_piezas","presupuesto_enviado","cerrada"];
const PS_ORDER = ["nuevo","enviado","aceptado","rechazado","facturado"];
const SO_B = { nueva:0, en_reparacion:1, pendiente_piezas:2, presupuesto_enviado:3, cerrada:10 };
const SO_P = { nuevo:0, enviado:1, aceptado:2, rechazado:10, facturado:11 };

const EQ = ["Caldera","Split A/C","Bomba de calor","Fan-coil","Climatizador","Aerotermia","VRV/VRF","Otro"];
const TECHS = [
  { id:1, name:"Miguel Torres", color:"#d97706" },
  { id:2, name:"Juan López",    color:"#0284c7" },
  { id:3, name:"Roberto Díaz",  color:"#7c3aed" },
];

/* ─── MANTENIMIENTO ─────────────────────────────────────────────────────── */
const MT = {
  mensual:    { label:"Mensual",    color:"#0d9488", freq:30  },
  trimestral: { label:"Trimestral", color:"#d97706", freq:90  },
  semestral:  { label:"Semestral",  color:"#7c3aed", freq:180 },
  anual:      { label:"Anual",      color:"#dc2626", freq:365 },
};
const MT_TIPOS = ["mensual","trimestral","semestral","anual"];
const MT_EQUIPOS = ["Caldera","Split","Bomba de calor","Fan-coil","Climatizador","Enfriadora","VRV/VRF","Recuperador","Otro"];

const TPL = {
  mensual:["Verificación del funcionamiento general","Limpieza y/o sustitución de filtros de aire","Comprobación de presiones de trabajo","Revisión de ruidos y vibraciones anómalas","Verificación de temperaturas de impulsión y retorno","Comprobación de mandos y termostatos","Revisión de la presión del circuito de agua","Verificación de ausencia de fugas"],
  trimestral:["Todas las revisiones del mantenimiento mensual","Limpieza de evaporadores y condensadores","Revisión y engrase de partes móviles","Comprobación del circuito eléctrico y conexiones","Verificación de la carga de gas refrigerante","Limpieza de bandejas y sistema de condensados","Limpieza del quemador y revisión de electrodos","Comprobación de la combustión y rendimiento"],
  semestral:["Todas las revisiones del mantenimiento trimestral","Revisión completa del circuito frigorífico","Comprobación de válvulas de seguridad y expansión","Revisión del intercambiador de calor","Inspección del sistema eléctrico completo","Revisión del aislamiento de tuberías y conductos","Comprobación del rendimiento energético","Revisión del sistema de evacuación de humos"],
  anual:["Todas las revisiones del mantenimiento semestral","Análisis de refrigerante (pureza, humedad y carga)","Prueba de estanqueidad del circuito frigorífico","Revisión completa de cuadros y protecciones eléctricas","Sustitución de filtros y elementos de desgaste","Análisis y ajuste de la combustión (CO, CO2, O2)","Revisión completa de la caldera y elementos de seguridad","Elaboración de informe técnico completo"],
};

function todayStr() { return new Date().toISOString().slice(0,10); }
function addDays(d, n) { const dt=new Date(d+"T12:00:00"); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }
function diffDays(a, b) { return Math.round((new Date(a+"T12:00:00")-new Date(b+"T12:00:00"))/86400000); }
function urgInfo(proxima) {
  if (!proxima) return { level:"none", label:"Sin programar" };
  const d = diffDays(proxima, todayStr());
  if (d < 0)  return { level:"urgente", label:`Vencida hace ${Math.abs(d)}d` };
  if (d === 0) return { level:"hoy",    label:"Hoy" };
  if (d <= 7)  return { level:"semana", label:`En ${d}d` };
  if (d <= 30) return { level:"prox",   label:`En ${d}d` };
  return { level:"ok", label:`En ${d}d` };
}
const UCOL = { urgente:T.red, hoy:T.orange, semana:"#f59e0b", prox:T.teal, ok:T.muted, none:T.muted };

/* ─── INITIAL DATA ───────────────────────────────────────────────────────── */
const COMPANY0 = {
  nombre:"ThermoGest Climatización SL", cif:"B12345678",
  direccion:"Calle Ejemplo 1, 30800 Lorca, Murcia",
  telefono:"968 000 000", email:"info@thermogest.com",
  web:"www.thermogest.com", cuenta:"ES00 0000 0000 0000 0000 0000", logo:null,
};


/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
const inp = (x={}) => ({
  width:"100%", boxSizing:"border-box", background:"#fff",
  border:`1.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px",
  color:T.text, fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif",
  boxShadow:"0 1px 2px rgba(0,0,0,0.04)", transition:"border-color 0.15s", ...x,
});

function openMaps(addr) { window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`,"_blank"); }
function sendEmail({ to, subject, body }) { window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,"_blank"); }
async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
function pushNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag:"tg-"+Date.now() }); } catch(e){}
}

async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  return new Promise((res,rej) => {
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej;
    document.head.appendChild(s);
  });
}
function calcHours(ini, fin) {
  if (!ini||!fin) return 0;
  const [h1,m1]=ini.split(":").map(Number), [h2,m2]=fin.split(":").map(Number);
  return Math.max(0,((h2*60+m2)-(h1*60+m1))/60);
}

/* ─── ATOMS ──────────────────────────────────────────────────────────────── */
function Badge({ status, type="b" }) {
  const map = type==="b"?BS:PS;
  const s = map[status]||{label:status,color:T.muted};
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 10px",
      borderRadius:6, fontSize:11, fontWeight:600,
      background:s.color+"14", border:`1px solid ${s.color}28`, color:s.color,
      whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

function Ava({ name="?", size=32, color }) {
  const c = color||T.accent;
  const p = name.trim().split(" ");
  const i = ((p[0]||"")[0]||"") + ((p[1]||"")[0]||"");
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:c+"16", border:`1.5px solid ${c}30`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.36, fontWeight:700, color:c, fontFamily:"'Sora',sans-serif" }}>
      {i.toUpperCase()||"?"}
    </div>
  );
}

function Btn({ ch, onClick, v="p", sm, disabled, full }) {
  const styles = {
    p:{ background:T.accent, color:"#fff", border:"none", boxShadow:"0 1px 3px rgba(29,78,216,0.25)" },
    g:{ background:"#fff", color:T.sub, border:`1.5px solid ${T.border}` },
    d:{ background:T.redLight, color:T.red, border:`1.5px solid #fecaca` },
    s:{ background:T.greenLight, color:T.green, border:`1.5px solid #bbf7d0` },
    b:{ background:T.accentLight, color:T.accent, border:`1.5px solid #bfdbfe` },
    o:{ background:T.orangeLight, color:T.orange, border:`1.5px solid #fde68a` },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
        padding: sm?"5px 13px":"9px 18px", width:full?"100%":undefined,
        fontSize:sm?12:13, fontWeight:600, borderRadius:8, cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.45:1, fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s",
        ...(styles[v]||styles.p) }}>
      {ch}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:11, fontWeight:600, color:T.sub }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ onClose, children, w=660, zIndex=200 }) {
  const isMobile = useIsMobile();
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed", inset:0, zIndex, background:"rgba(15,23,42,0.45)",
        backdropFilter:"blur(6px)", display:"flex",
        alignItems:isMobile?"flex-end":"center",
        justifyContent:"center", padding:isMobile?0:16 }}>
      <div style={{ width:"100%", maxWidth:w, maxHeight:"92vh", overflowY:"auto",
        borderRadius:isMobile?"16px 16px 0 0":"14px",
        background:"#fff", border:`1px solid ${T.border}`,
        boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
        {children}
      </div>
    </div>
  );
}

function MHead({ title, sub, onClose }) {
  return (
    <div style={{ padding:"16px 16px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif" }}>{title}</h2>
        {sub && <p style={{ margin:"3px 0 0", fontSize:12, color:T.muted }}>{sub}</p>}
      </div>
      <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:20, lineHeight:1, padding:0 }}>×</button>
    </div>
  );
}

function PhotoUpload({ photos=[], onAdd, onRemove }) {
  const ref = useRef();
  function handle(e) {
    Array.from(e.target.files).forEach(f=>{ const r=new FileReader(); r.onload=ev=>onAdd(ev.target.result); r.readAsDataURL(f); });
    e.target.value="";
  }
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:600, color:T.sub }}>Fotos ({photos.length})</span>
        <Btn ch="Añadir foto" onClick={()=>ref.current.click()} v="g" sm/>
        <input ref={ref} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handle}/>
      </div>
      {photos.length>0
        ? <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:8 }}>
            {photos.map((src,i)=>(
              <div key={i} style={{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden", border:`1px solid ${T.border}` }}>
                <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                <button onClick={()=>onRemove(i)} style={{ position:"absolute", top:3, right:3, width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              </div>
            ))}
          </div>
        : <div onClick={()=>ref.current.click()}
            style={{ border:`2px dashed ${T.border}`, borderRadius:10, padding:20, textAlign:"center", cursor:"pointer", color:T.muted, fontSize:13 }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            Pulsa para adjuntar fotos
          </div>
      }
    </div>
  );
}

function SigPad({ value, onChange }) {
  const cRef=useRef(); const dr=useRef(false); const [has,setHas]=useState(!!value);
  useEffect(()=>{ const c=cRef.current,ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); if(value){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=value;} },[]);
  function pos(e,c){ const r=c.getBoundingClientRect(),s=e.touches?e.touches[0]:e; return{x:(s.clientX-r.left)*(c.width/r.width),y:(s.clientY-r.top)*(c.height/r.height)}; }
  function start(e){ e.preventDefault(); dr.current=true; const c=cRef.current,ctx=c.getContext("2d"),p=pos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(e){ e.preventDefault(); if(!dr.current)return; const c=cRef.current,ctx=c.getContext("2d"),p=pos(e,c); ctx.strokeStyle="#1d4ed8"; ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineTo(p.x,p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x,p.y); setHas(true); }
  function end(e){ e.preventDefault(); dr.current=false; onChange(cRef.current.toDataURL()); }
  function clear(){ const c=cRef.current,ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); setHas(false); onChange(null); }
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:600, color:T.sub }}>Firma del cliente</span>
        {has && <Btn ch="Borrar" onClick={clear} v="d" sm/>}
      </div>
      <canvas ref={cRef} width={560} height={120}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width:"100%", height:120, borderRadius:8, border:`1.5px solid ${has?T.accent:T.border}`, cursor:"crosshair", display:"block", touchAction:"none", background:"#fff" }}/>
      {!has && <p style={{ fontSize:11, color:T.muted, margin:"4px 0 0", textAlign:"center" }}>Firma aquí</p>}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(e){ return {err:e}; }
  render(){
    if(this.state.err) return (
      <div style={{ padding:24, background:T.redLight, border:`1px solid #fecaca`, borderRadius:12, margin:20 }}>
        <div style={{ fontWeight:700, color:T.red, marginBottom:8 }}>Error en el componente</div>
        <pre style={{ fontSize:11, color:T.red, whiteSpace:"pre-wrap" }}>{String(this.state.err)}</pre>
      </div>
    );
    return this.props.children;
  }
}

/* ─── PDF HELPERS ────────────────────────────────────────────────────────── */
async function buildPartePDF(parte, bd, cl, company={}) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({unit:"mm",format:"a4"});
  const tMat = (parte.materiales||[]).filter(m=>m.desc).reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0);
  const hours = calcHours(parte.horasInicio, parte.horasFin);
  const ph = parseFloat(parte.precioHora||0);
  const tMO = hours*ph;
  const base = tMat+tMO;
  const iva = parte.aplicarIVA ? base*0.21 : 0;
  const total = base+iva;
  const [O,W,D,G,L] = [[29,78,216],[255,255,255],[15,23,42],[100,116,139],[248,250,252]];

  // Header
  doc.setFillColor(...O); doc.rect(0,0,210,42,"F");
  doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
  if(company.logo){ try{ doc.addImage(company.logo,"PNG",12,7,26,26); doc.text(company.nombre||"ThermoGest",42,16); }catch(e){ doc.text(company.nombre||"ThermoGest",12,16); } }
  else { doc.text(company.nombre||"ThermoGest",12,16); }
  doc.setFontSize(8); doc.setFont("helvetica","normal");
  if(company.cif)      doc.text("CIF: "+company.cif, 12, 23);
  if(company.telefono) doc.text("Tel: "+company.telefono+"  "+( company.email||""), 12, 29);
  doc.setFontSize(13); doc.setFont("helvetica","bold");
  doc.text("PARTE DE TRABAJO", 198, 14, {align:"right"});
  doc.setFontSize(8); doc.setFont("helvetica","normal");
  if(company.cif) doc.text("CIF: "+company.cif, 198, 21, {align:"right"});
  doc.text("Ref: #"+bd.id, 198, 28, {align:"right"});
  doc.text("Fecha: "+parte.fecha, 198, 35, {align:"right"});

  let y=48;
  doc.setFillColor(...L); doc.rect(10,y,190,26,"F");
  doc.setTextColor(...D); doc.setFontSize(8.5); doc.setFont("helvetica","bold");
  doc.text("CLIENTE",15,y+7); doc.text("EQUIPO / DIRECCIÓN",105,y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(cl?.name||"—",15,y+16);
  doc.setFontSize(8.5); doc.setTextColor(...G);
  doc.text(cl?.phone||"", 15, y+23);
  doc.setTextColor(...D); doc.setFontSize(10);
  doc.text((bd.equipment||"")+" · "+parte.tecnico, 105, y+16);
  doc.setFontSize(8.5); doc.setTextColor(...G);
  const aLines = doc.splitTextToSize(bd.address||"",80);
  doc.text(aLines[0]||"", 105, y+23);
  y+=32;

  // Hours
  doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
  doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
  doc.text("HORAS DE SERVICIO",14,y+5); y+=10;
  doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
  doc.text("Inicio: "+(parte.horasInicio||"—"),15,y);
  doc.text("Fin: "+(parte.horasFin||"—"),65,y);
  doc.text("Tiempo: "+hours.toFixed(2)+" h",115,y);
  doc.text(ph+"€/hora",165,y); y+=6;
  doc.setFillColor(254,252,232); doc.rect(10,y-1,190,9,"F");
  doc.setFont("helvetica","bold"); doc.setTextColor(146,100,4); doc.setFontSize(9.5);
  doc.text("Mano de obra: "+hours.toFixed(2)+"h × "+ph+"€ = "+tMO.toFixed(2)+"€",14,y+5.5); y+=14;

  // Work
  doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
  doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("TRABAJO REALIZADO",14,y+5); y+=10;
  const wLines = doc.splitTextToSize(parte.trabajoRealizado||"—",182);
  doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.text(wLines,14,y); y+=wLines.length*5.5+8;

  // Materials
  const mats = (parte.materiales||[]).filter(m=>m.desc);
  if(mats.length>0){
    doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("MATERIALES",14,y+5); y+=10;
    doc.setFillColor(226,232,240); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...G); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("DESCRIPCIÓN",14,y+5); doc.text("CANT.",128,y+5); doc.text("€/UD",152,y+5); doc.text("TOTAL",177,y+5); y+=9;
    mats.forEach((m,i)=>{
      if(i%2===0){ doc.setFillColor(248,250,252); doc.rect(10,y-1,190,7,"F"); }
      doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text((m.desc||"").slice(0,52),14,y+4);
      doc.text(String(m.qty),128,y+4); doc.text(m.precio+"€",152,y+4);
      doc.text((parseFloat(m.qty||0)*parseFloat(m.precio||0)).toFixed(2)+"€",177,y+4); y+=8;
    });
    y+=4;
  }

  // Totals
  doc.setFillColor(226,232,240); doc.rect(10,y,190,7,"F");
  doc.setTextColor(...G); doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.text("Base imponible:",14,y+5); doc.text(base.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
  if(parte.aplicarIVA){
    doc.setFillColor(226,232,240); doc.rect(10,y,190,7,"F");
    doc.text("IVA (21%):",14,y+5); doc.text(iva.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
  }
  doc.setFillColor(...O); doc.rect(10,y,190,14,"F");
  doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text("TOTAL"+(parte.aplicarIVA?" (IVA inc.)":""),14,y+10);
  doc.text(total.toFixed(2)+" €",198,y+10,{align:"right"}); y+=21;

  if(parte.observaciones){
    const oLines=doc.splitTextToSize(parte.observaciones,178);
    doc.setFillColor(254,252,232); doc.rect(10,y,190,6+oLines.length*5.5,"F");
    doc.setTextColor(146,100,4); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("OBSERVACIONES:",14,y+5);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(oLines,14,y+11); y+=12+oLines.length*5.5;
  }
  if(parte.firma){ doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G); doc.text("FIRMA:",14,y); y+=4; try{doc.addImage(parte.firma,"PNG",14,y,65,26);}catch(e){} y+=30; }

  const ph2=doc.internal.pageSize.height;
  const footH = company.cuenta?18:12;
  doc.setFillColor(...D); doc.rect(0,ph2-footH,210,footH,"F");
  doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
  if(company.cuenta){ doc.setTextColor(200,220,240); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("IBAN: "+company.cuenta,14,ph2-footH+7); }
  doc.setTextColor(100,116,139); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  doc.text((company.nombre||"")+(company.cif?" · CIF:"+company.cif:""),14,ph2-footH+(company.cuenta?13:6));
  doc.text((company.telefono||"")+" · "+(company.email||""),198,ph2-6,{align:"right"});
  return doc;
}

async function buildRevPDF(rev, inst, cl, company={}) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({unit:"mm",format:"a4"});
  const mt = MT[rev.tipo]||{label:rev.tipo,color:"#0d9488"};
  const rgb = rev.tipo==="mensual"?[13,148,136]:rev.tipo==="trimestral"?[217,119,6]:rev.tipo==="semestral"?[124,58,237]:[220,38,38];
  const [W,D,G,L] = [[255,255,255],[15,23,42],[100,116,139],[248,250,252]];

  doc.setFillColor(...rgb); doc.rect(0,0,210,40,"F");
  doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text(company.nombre||"ThermoGest",12,14);
  doc.setFontSize(8); doc.setFont("helvetica","normal");
  if(company.cif)      doc.text("CIF: "+company.cif,12,21);
  if(company.telefono) doc.text("Tel: "+company.telefono+"  "+(company.email||""),12,28);
  doc.setFontSize(12); doc.setFont("helvetica","bold");
  doc.text("PARTE MANTENIMIENTO "+mt.label.toUpperCase(),198,13,{align:"right"});
  doc.setFontSize(8.5); doc.setFont("helvetica","normal");
  doc.text("N.º Parte: "+(rev.partNum||"—"),198,21,{align:"right"});
  doc.text("Fecha: "+rev.fecha,198,29,{align:"right"});

  let y=46;
  doc.setFillColor(...L); doc.rect(10,y,190,24,"F");
  doc.setTextColor(...D); doc.setFontSize(8.5); doc.setFont("helvetica","bold");
  doc.text("CLIENTE",15,y+7); doc.text("INSTALACIÓN",105,y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(cl?.nombre||cl?.name||"—",15,y+16);
  doc.text(inst?.nombre||"—",105,y+16);
  doc.setFontSize(8.5); doc.setTextColor(...G);
  doc.text(cl?.telefono||cl?.phone||"",15,y+22);
  doc.text((inst?.tipo||"")+" · "+(inst?.ubicacion||""),105,y+22);
  y+=30;
  doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
  doc.text("Técnico: "+(rev.tecnicoNombre||"—"),15,y); y+=12;

  doc.setFillColor(...rgb); doc.rect(10,y,190,7,"F");
  doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.text("CHECKLIST DE REVISIÓN",14,y+5); y+=10;
  const items = inst?.[`items_${rev.tipo}`]||[];
  items.forEach((item,i)=>{
    const checked = rev.checks?.[i]===true;
    if(i%2===0){ doc.setFillColor(248,250,252); doc.rect(10,y-1,190,7,"F"); }
    if(checked){ doc.setFillColor(...rgb); } else { doc.setFillColor(200,200,200); }
    doc.rect(14,y,4,4,"F");
    if(checked){ doc.setTextColor(...[D[0],D[1],D[2]]); } else { doc.setTextColor(160,160,160); }
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(item,22,y+3.5); y+=8;
    if(y>255){ doc.addPage(); y=20; }
  });
  y+=4;
  if(rev.obs){ const oLines=doc.splitTextToSize(rev.obs,175); doc.setFillColor(254,252,232); doc.rect(10,y,190,6+oLines.length*5.5,"F"); doc.setTextColor(146,100,4); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("OBSERVACIONES:",14,y+5); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(oLines,14,y+11); y+=12+oLines.length*5.5; }
  if(rev.firma){ doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G); doc.text("FIRMA:",14,y); y+=4; try{doc.addImage(rev.firma,"PNG",14,y,65,26);}catch(e){} }

  const ph=doc.internal.pageSize.height;
  doc.setFillColor(...D); doc.rect(0,ph-14,210,14,"F");
  doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
  doc.text((company.nombre||"")+(company.cif?" · CIF:"+company.cif:""),14,ph-6);
  if(company.cuenta) doc.text("IBAN: "+company.cuenta,105,ph-6,{align:"center"});
  doc.text((company.telefono||"")+" · "+(company.email||""),198,ph-6,{align:"right"});
  return doc;
}

/* ─── SIDEBAR ────────────────────────────────────────────────────────────── */
function Sidebar({ user, view, setView, onLogout, notifCount, data, open, onToggle }) {
  const isMobile = useIsMobile();
  const isAdmin = user.role === "admin";

  const links = [
    ...(isAdmin?[{id:"dashboard",label:"Dashboard"}]:[]),
    {id:"calendario",   label:"Calendario"},
    {id:"averias",      label:"Averías"},
    {id:"presupuestos", label:"Presupuestos"},
    ...(isAdmin?[{id:"clientes",   label:"Clientes"}]:[]),
    {id:"mantenimiento",label:"Mantenimiento"},
    ...(isAdmin?[{id:"empresa",    label:"Mi empresa"}]:[]),
  ];

  const mtUrgent = (data.instalaciones||[]).reduce((acc,inst)=>{
    MT_TIPOS.forEach(t=>{
      if(!inst["activa_"+t]) return;
      const p=inst["proxima_"+t];
      if(!p) return;
      try{ const d=Math.round((new Date(p+"T12:00:00")-new Date())/86400000); if(d<=7) acc++; }catch(e){}
    });
    return acc;
  },0);

  function NavBtn({ l }) {
    const active = view === l.id;
    return (
      <button onClick={()=>{ setView(l.id); if(isMobile) onToggle(); }}
        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 13px", borderRadius:8, border:"none",
          background:active?T.accentLight:"transparent", color:active?T.accent:T.sub,
          fontSize:13, fontWeight:active?600:400, cursor:"pointer", textAlign:"left", width:"100%",
          fontFamily:"'DM Sans',sans-serif", transition:"background 0.1s",
          borderLeft:`3px solid ${active?T.accent:"transparent"}` }}>
        <span style={{ flex:1 }}>{l.label}</span>
        {l.id==="averias" && notifCount>0 && <span style={{ background:T.accent,color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700 }}>{notifCount}</span>}
        {l.id==="mantenimiento" && mtUrgent>0 && <span style={{ background:T.red,color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700 }}>{mtUrgent}</span>}
      </button>
    );
  }

  const footer = (
    <div style={{ padding:"12px 14px", borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <Ava name={user.name} size={30} color={user.color||T.accent}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
          <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{user.role}</div>
        </div>
      </div>
      <button onClick={async()=>{ const ok=await requestNotifPermission(); alert(ok?"Notificaciones activadas correctamente.":"Notificaciones bloqueadas. Actívalas en ajustes del navegador."); }}
        style={{ width:"100%", padding:"6px", borderRadius:7, border:`1.5px solid #bbf7d0`, background:T.greenLight, color:T.green, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, marginBottom:6 }}>
        Activar notificaciones
      </button>
      <button onClick={onLogout}
        style={{ width:"100%", padding:"6px", borderRadius:7, border:`1.5px solid ${T.border}`, background:"#fff", color:T.sub, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
        Cerrar sesión
      </button>
    </div>
  );

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <>
        <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:90, height:52, background:"#fff",
          borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center",
          padding:"0 14px", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <button onClick={onToggle} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${T.border}`,
            background:T.surface, cursor:"pointer", fontSize:18, color:T.text,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>≡</button>
          <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
            <div style={{ width:26, height:26, borderRadius:7, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>TG</div>
            <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif" }}>ThermoGest</span>
          </div>
          {notifCount>0 && <span style={{ background:T.accent,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>{notifCount}</span>}
          {mtUrgent>0 && <span style={{ background:T.red,color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700 }}>{mtUrgent}</span>}
        </div>
        {open && <div onClick={onToggle} style={{ position:"fixed",inset:0,zIndex:91,background:"rgba(15,23,42,0.35)",backdropFilter:"blur(3px)" }}/>}
        <div style={{ position:"fixed", top:0, left:0, bottom:0, zIndex:92, width:270, background:"#fff",
          boxShadow:"4px 0 20px rgba(0,0,0,0.12)",
          transform:open?"translateX(0)":"translateX(-100%)", transition:"transform 0.22s ease",
          display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"16px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:9, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>TG</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif" }}>ThermoGest</div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>Gestión Técnica</div>
              </div>
            </div>
            <button onClick={onToggle} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${T.border}`, background:T.surface, cursor:"pointer", fontSize:16, color:T.muted, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
          <nav style={{ flex:1, padding:"10px", overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
            {links.map(l=><NavBtn key={l.id} l={l}/>)}
          </nav>
          {footer}
        </div>
      </>
    );
  }

  /* ── DESKTOP ── */
  return (
    <div style={{ width:open?240:0, minWidth:open?240:0, flexShrink:0, background:"#fff",
      borderRight:open?`1px solid ${T.border}`:"none", display:"flex", flexDirection:"column",
      height:"100vh", position:"sticky", top:0,
      transition:"width 0.22s ease, min-width 0.22s ease", overflow:"hidden" }}>
      <div style={{ padding:"16px 14px 14px", borderBottom:`1px solid ${T.border}`, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"space-between", minWidth:214 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff", flexShrink:0 }}>TG</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif", whiteSpace:"nowrap" }}>ThermoGest</div>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>Gestión Técnica</div>
          </div>
        </div>
        <button onClick={onToggle}
          style={{ width:26, height:26, borderRadius:6, border:`1px solid ${T.border}`, background:T.surface, cursor:"pointer", fontSize:13, color:T.muted, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
          onMouseEnter={e=>{ e.currentTarget.style.background=T.accentLight; e.currentTarget.style.color=T.accent; }}
          onMouseLeave={e=>{ e.currentTarget.style.background=T.surface; e.currentTarget.style.color=T.muted; }}>
          ‹
        </button>
      </div>
      <nav style={{ flex:1, padding:"10px", overflowY:"auto", display:"flex", flexDirection:"column", gap:2, minWidth:214 }}>
        {links.map(l=><NavBtn key={l.id} l={l}/>)}
      </nav>
      <div style={{ minWidth:214 }}>{footer}</div>
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────────────────── */
function Dashboard({ data, setView }) {
  const isMobile = useIsMobile();
  const bds = data.breakdowns;
  const insts = data.instalaciones||[];
  const mtUrgent = insts.reduce((acc,inst)=>{
    MT_TIPOS.forEach(t=>{ if(!inst["activa_"+t]) return; const info=urgInfo(inst["proxima_"+t]); if(info.level==="urgente"||info.level==="hoy"||info.level==="semana") acc++; });
    return acc;
  },0);

  const stats = [
    { label:"Total averías",   val:bds.length,                                          color:T.accent  },
    { label:"Abiertas",        val:bds.filter(b=>b.status!=="cerrada").length,          color:"#7c3aed" },
    { label:"Pend. piezas",    val:bds.filter(b=>b.status==="pendiente_piezas").length, color:T.red     },
    { label:"Mant. urgente",   val:mtUrgent,                                            color:T.teal    },
  ];

  const tech   = id => TECHS.find(t=>t.id===id);
  const client = id => data.clients.find(c=>c.id===id);
  const recent = [...bds].sort((a,b)=>(SO_B[a.status]??5)-(SO_B[b.status]??5)).slice(0,5);
  const now=new Date(); const pad=n=>String(n).padStart(2,"0");
  const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const upcoming=[...data.events].filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);

  const urgentMT = [];
  insts.forEach(inst=>{ const cl=client(inst.clientId); MT_TIPOS.forEach(t=>{ if(!inst["activa_"+t]) return; const info=urgInfo(inst["proxima_"+t]); if(info.level==="urgente"||info.level==="hoy"||info.level==="semana") urgentMT.push({inst,cl,tipo:t,info}); }); });

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ marginBottom:20 }}>
        <p style={{ color:T.muted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 4px" }}>Panel de control</p>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Dashboard</h1>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
        {stats.map(s=>(
          <div key={s.label} style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:s.color, borderRadius:"12px 12px 0 0" }}/>
            <div style={{ fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:10 }}>{s.label}</div>
            <div style={{ fontSize:32, fontWeight:700, color:s.color, fontFamily:"'Sora',sans-serif", letterSpacing:"-0.03em" }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {/* Estado */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:11, fontWeight:600, color:T.sub, textTransform:"uppercase", letterSpacing:"0.06em" }}>Por estado</h3>
          {BS_ORDER.map(key=>{ const s=BS[key]; const count=bds.filter(b=>b.status===key).length; const pct=bds.length?(count/bds.length)*100:0; return (
            <div key={key} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:T.sub }}>{s.label}</span>
                <span style={{ fontSize:12, fontWeight:600, color:s.color }}>{count}</span>
              </div>
              <div style={{ height:4, background:T.border, borderRadius:4 }}><div style={{ height:"100%", width:`${pct}%`, background:s.color, borderRadius:4 }}/></div>
            </div>
          ); })}
        </div>

        {/* Últimas averías */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:11, fontWeight:600, color:T.sub, textTransform:"uppercase", letterSpacing:"0.06em" }}>Últimas averías</h3>
            <button onClick={()=>setView("averias")} style={{ background:"none", border:"none", color:T.accent, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Ver todas →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {recent.map(b=>{ const cl=client(b.clientId); const tc=tech(b.techId); return (
              <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Ava name={cl?.name||"?"} size={28} color={tc?.color}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cl?.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{b.equipment}</div>
                </div>
                <Badge status={b.status}/>
              </div>
            ); })}
          </div>
        </div>

        {/* Próximos eventos */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:11, fontWeight:600, color:T.sub, textTransform:"uppercase", letterSpacing:"0.06em" }}>Próximos eventos</h3>
            <button onClick={()=>setView("calendario")} style={{ background:"none", border:"none", color:T.accent, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Calendario →</button>
          </div>
          {upcoming.length===0 && <p style={{ color:T.muted, fontSize:12 }}>Sin eventos próximos</p>}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {upcoming.map(e=>{ const cl=client(e.clientId); return (
              <div key={e.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:34, flexShrink:0, background:(e.color||T.accent)+"18", border:`1px solid ${(e.color||T.accent)}28`, borderRadius:8, padding:"5px 0", textAlign:"center" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:e.color||T.accent }}>{new Date(e.date+"T12:00").getDate()}</div>
                  <div style={{ fontSize:8, color:T.muted, textTransform:"uppercase" }}>{new Date(e.date+"T12:00").toLocaleDateString("es-ES",{month:"short"})}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.title}</div>
                  <div style={{ fontSize:11, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cl?.name}</div>
                </div>
              </div>
            ); })}
          </div>
        </div>
      </div>

      {/* MT urgent panel */}
      {urgentMT.length>0 && (
        <div style={{ marginTop:14, background:"#fff", border:`1px solid #fecaca`, borderRadius:12, padding:"18px 20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:11, fontWeight:600, color:T.red, textTransform:"uppercase", letterSpacing:"0.06em" }}>Revisiones de mantenimiento pendientes</h3>
            <button onClick={()=>setView("mantenimiento")} style={{ background:"none", border:"none", color:T.accent, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Ver todas →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {urgentMT.slice(0,4).map((u,i)=>{ const mt=MT[u.tipo]; return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:T.redLight, borderRadius:8, border:"1px solid #fecaca" }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.inst.nombre}</span>
                  <span style={{ fontSize:11, color:T.sub, marginLeft:8 }}>{u.cl?.name}</span>
                </div>
                <span style={{ fontSize:10, padding:"2px 9px", borderRadius:20, background:mt.color+"14", border:`1px solid ${mt.color}28`, color:mt.color, fontWeight:600 }}>{mt.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:UCOL[u.info.level] }}>{u.info.label}</span>
              </div>
            ); })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── AVERÍAS ────────────────────────────────────────────────────────────── */
function NewAveriaModal({ data, setData, user, onClose }) {
  const isMobile = useIsMobile();
  const isAdmin = user.role==="admin";
  const [form, setForm] = useState({ clientId:data.clients[0]?.id||"", address:data.clients[0]?.address||"", equipment:"Caldera", description:"", visitDate:todayStr(), techId:isAdmin?TECHS[0].id:user.id });
  const upd=(k,v)=>{ const n={...form,[k]:v}; if(k==="clientId"){ const cl=data.clients.find(c=>c.id===Number(v)); n.address=cl?.address||""; } setForm(n); };
  function save(){
    if(!form.description.trim()) return;
    const nb={ id:Date.now(), clientId:Number(form.clientId), address:form.address, equipment:form.equipment, description:form.description.trim(), visitDate:form.visitDate, techId:Number(form.techId), status:"nueva", notes:[], photos:[], budgetIds:[], parte:null, fromForm:false, createdAt:todayStr() };
    setData(d=>({...d,breakdowns:[...d.breakdowns,nb]}));
    pushNotif("Nueva avería registrada", nb.description+" — "+nb.address);
    onClose();
  }
  return (
    <Modal onClose={onClose} w={520}>
      <MHead title="Nueva avería" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:13 }}>
        <Field label="Cliente"><select value={form.clientId} onChange={e=>upd("clientId",e.target.value)} style={inp()}>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Dirección"><input value={form.address} onChange={e=>upd("address",e.target.value)} style={inp()} placeholder="Dirección de la visita"/></Field>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          <Field label="Equipo"><select value={form.equipment} onChange={e=>upd("equipment",e.target.value)} style={inp()}>{EQ.map(e=><option key={e}>{e}</option>)}</select></Field>
          <Field label="Fecha visita"><input type="date" value={form.visitDate} onChange={e=>upd("visitDate",e.target.value)} style={inp()}/></Field>
        </div>
        {isAdmin && <Field label="Técnico"><select value={form.techId} onChange={e=>upd("techId",e.target.value)} style={inp()}>{TECHS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
        <Field label="Descripción del problema"><textarea value={form.description} onChange={e=>upd("description",e.target.value)} placeholder="Describe el problema..." style={{...inp(),minHeight:80,resize:"vertical"}}/></Field>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch="Crear avería" onClick={save} disabled={!form.description.trim()}/>
        </div>
      </div>
    </Modal>
  );
}

function ParteModal({ breakdown:bd, client:cl, setData, user, company, onClose }) {
  const isMobile = useIsMobile();
  const ex = bd.parte;
  const [form, setForm] = useState(ex||{ trabajoRealizado:"", materiales:[{desc:"",qty:"",precio:""}], horasInicio:"", horasFin:"", precioHora:"45", aplicarIVA:true, observaciones:"", firma:null, tecnico:user.name, fecha:new Date().toLocaleDateString("es-ES") });
  const [saving, setSaving] = useState(false);
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function addMat(){ setForm(p=>({...p,materiales:[...p.materiales,{desc:"",qty:"",precio:""}]})); }
  function updMat(i,k,v){ const m=[...form.materiales]; m[i]={...m[i],[k]:v}; setForm(p=>({...p,materiales:m})); }
  function removeMat(i){ setForm(p=>({...p,materiales:p.materiales.filter((_,j)=>j!==i)})); }
  const hours=calcHours(form.horasInicio,form.horasFin);
  const ph=parseFloat(form.precioHora||0);
  const tMO=hours*ph;
  const tMat=(form.materiales||[]).filter(m=>m.desc).reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0);
  const base=tMat+tMO;
  const iva=form.aplicarIVA?base*0.21:0;
  const total=base+iva;
  function saveToData(f){ setData(d=>({...d,breakdowns:d.breakdowns.map(b=>b.id===bd.id?{...b,parte:f}:b)})); }
  async function handlePDF(andEmail=false){
    setSaving(true);
    saveToData(form);
    try{
      const doc=await buildPartePDF(form,bd,cl,company||{});
      window.open(doc.output("bloburl"),"_blank");
      if(andEmail){
        setTimeout(()=>{
          const body=[`PARTE DE TRABAJO – ${form.fecha}`,`${company?.nombre||""}${company?.cif?" · CIF:"+company.cif:""}`,``,`Cliente: ${cl?.name}`,`Dirección: ${bd.address}`,`Equipo: ${bd.equipment}`,`Técnico: ${form.tecnico}`,`Horas: ${form.horasInicio||"—"} – ${form.horasFin||"—"} (${hours.toFixed(2)}h × ${ph}€/h = ${tMO.toFixed(2)}€)`,``,`TRABAJO REALIZADO:`,form.trabajoRealizado,``,`MATERIALES:`,...(form.materiales.filter(m=>m.desc).map(m=>`  · ${m.desc}  x${m.qty}  @ ${m.precio}€  = ${(m.qty*m.precio).toFixed(2)}€`)),``,`Base imponible: ${base.toFixed(2)}€`,form.aplicarIVA?`IVA 21%: ${iva.toFixed(2)}€`:"IVA: No aplicado",`TOTAL: ${total.toFixed(2)}€`,company?.cuenta?`\nIBAN: ${company.cuenta}`:"",`\nEl PDF está adjunto.`].join("\n");
          sendEmail({to:cl?.email||"",subject:`Parte de trabajo – ${bd.equipment} – ${form.fecha}`,body});
        },600);
      }
    }catch(e){ alert("Error al generar el PDF. Permite ventanas emergentes."); }
    setSaving(false);
    onClose();
  }
  return (
    <Modal onClose={onClose} w={700}>
      <MHead title="Parte de trabajo" sub={`Avería #${bd.id} · ${cl?.name}`} onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
          <Field label="Técnico"><input value={form.tecnico} onChange={e=>upd("tecnico",e.target.value)} style={inp()}/></Field>
          <Field label="Fecha"><input value={form.fecha} onChange={e=>upd("fecha",e.target.value)} style={inp()}/></Field>
        </div>
        {/* Horas */}
        <div style={{ background:T.surface, borderRadius:10, padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:12 }}>Horas de servicio</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <Field label="Hora inicio"><input type="time" value={form.horasInicio} onChange={e=>upd("horasInicio",e.target.value)} style={inp()}/></Field>
            <Field label="Hora fin"><input type="time" value={form.horasFin} onChange={e=>upd("horasFin",e.target.value)} style={inp()}/></Field>
            <Field label="€/hora"><input type="number" value={form.precioHora} onChange={e=>upd("precioHora",e.target.value)} style={inp()} placeholder="45"/></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:isMobile?6:8 }}>
            {[["Tiempo",`${hours.toFixed(2)} h`,T.accent],["M.O.",`${tMO.toFixed(2)} €`,T.orange],["Materiales",`${tMat.toFixed(2)} €`,T.purple]].map(([l,v,c])=>(
              <div key={l} style={{ background:c+"10", border:`1px solid ${c}20`, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:T.muted, fontWeight:600, textTransform:"uppercase", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:700, color:c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* IVA + Total */}
        <div style={{ background:T.surface, borderRadius:10, padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:12 }}>Resumen económico e IVA</div>
          <div onClick={()=>upd("aplicarIVA",!form.aplicarIVA)}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#fff", borderRadius:8, border:`1px solid ${form.aplicarIVA?T.green:T.border}`, marginBottom:12, cursor:"pointer" }}>
            <div style={{ width:42, height:22, borderRadius:11, background:form.aplicarIVA?T.green:T.muted, position:"relative", flexShrink:0, transition:"background 0.2s" }}>
              <span style={{ position:"absolute", top:3, left:form.aplicarIVA?22:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
            </div>
            <span style={{ fontSize:13, fontWeight:600, color:form.aplicarIVA?T.green:T.text }}>{form.aplicarIVA?"IVA 21% activado":"IVA 21% desactivado"}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 10px", background:"#fff", borderRadius:6, fontSize:13, color:T.sub }}>
              <span>Base imponible</span><span style={{ fontWeight:600 }}>{base.toFixed(2)} €</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 10px", background:form.aplicarIVA?T.greenLight:"#fff", borderRadius:6, border:`1px solid ${form.aplicarIVA?"#bbf7d0":T.border}`, fontSize:13 }}>
              <span style={{ color:form.aplicarIVA?T.green:T.muted }}>IVA 21%</span>
              <span style={{ fontWeight:600, color:form.aplicarIVA?T.green:T.muted }}>{form.aplicarIVA?`+ ${iva.toFixed(2)} €`:"No aplicado"}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 14px", background:T.accentLight, border:`2px solid #bfdbfe`, borderRadius:8 }}>
              <span style={{ fontSize:14, fontWeight:700, color:T.text }}>TOTAL {form.aplicarIVA?"(IVA inc.)":""}</span>
              <span style={{ fontSize:24, fontWeight:700, color:T.accent, fontFamily:"'Sora',sans-serif" }}>{total.toFixed(2)} €</span>
            </div>
          </div>
        </div>
        <Field label="Trabajo realizado"><textarea value={form.trabajoRealizado} onChange={e=>upd("trabajoRealizado",e.target.value)} placeholder="Describe el trabajo..." style={{...inp(),minHeight:80,resize:"vertical"}}/></Field>
        {/* Materiales */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:600, color:T.sub }}>Materiales</span>
            <Btn ch="+ Línea" onClick={addMat} v="g" sm/>
          </div>
          <div style={{ background:T.surface, borderRadius:10, border:`1px solid ${T.border}`, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 55px 65px 55px 20px":"1fr 70px 80px 70px 24px", gap:8, padding:"8px 12px", borderBottom:`1px solid ${T.border}` }}>
              {["Descripción","Cant.","Precio","Total",""].map((h,i)=><span key={i} style={{ fontSize:10, fontWeight:600, color:T.muted, textTransform:"uppercase" }}>{h}</span>)}
            </div>
            {form.materiales.map((m,i)=>(
              <div key={i} style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 55px 65px 55px 20px":"1fr 70px 80px 70px 24px", gap:8, padding:"7px 12px", borderBottom:i<form.materiales.length-1?`1px solid ${T.border}`:"none", alignItems:"center" }}>
                <input value={m.desc} onChange={e=>updMat(i,"desc",e.target.value)} placeholder="Material / pieza" style={{...inp({padding:"5px 8px",fontSize:12})}}/>
                <input type="number" value={m.qty} onChange={e=>updMat(i,"qty",e.target.value)} placeholder="1" style={{...inp({padding:"5px 8px",fontSize:12})}}/>
                <input type="number" value={m.precio} onChange={e=>updMat(i,"precio",e.target.value)} placeholder="0.00" style={{...inp({padding:"5px 8px",fontSize:12})}}/>
                <span style={{ fontSize:12, fontWeight:600, color:T.accent }}>{m.qty&&m.precio?(m.qty*m.precio).toFixed(2)+"€":"—"}</span>
                <button onClick={()=>removeMat(i)} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14,padding:0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <Field label="Observaciones"><textarea value={form.observaciones} onChange={e=>upd("observaciones",e.target.value)} placeholder="Recomendaciones, próximas revisiones..." style={{...inp(),minHeight:55,resize:"vertical"}}/></Field>
        <SigPad value={form.firma} onChange={v=>upd("firma",v)}/>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, flexWrap:"wrap" }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch="Guardar" onClick={()=>{ saveToData(form); onClose(); }}/>
          <Btn ch="Ver PDF" onClick={()=>handlePDF(false)} v="b" disabled={saving}/>
          <Btn ch="PDF + Email" onClick={()=>handlePDF(true)} v="s" disabled={saving}/>
        </div>
      </div>
    </Modal>
  );
}

function NewBudgetModal({ breakdownId, clientId, client:cl, setData, onClose }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ description:"", amount:"", status:"nuevo", notes:"", photos:[] });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function addPhoto(src){ setForm(p=>({...p,photos:[...p.photos,src]})); }
  function removePhoto(i){ setForm(p=>({...p,photos:p.photos.filter((_,j)=>j!==i)})); }
  function save(andEmail=false){
    if(!form.description.trim()||!form.amount) return;
    const nb={ id:Date.now(), breakdownId:breakdownId||null, clientId:clientId||cl?.id, description:form.description.trim(), amount:Number(form.amount), status:form.status, notes:form.notes, photos:form.photos, createdAt:todayStr() };
    setData(d=>({
      ...d, budgets:[...d.budgets,nb],
      breakdowns:breakdownId?d.breakdowns.map(b=>b.id===breakdownId?{...b,budgetIds:[...b.budgetIds,nb.id]}:b):d.breakdowns,
    }));
    pushNotif("Nuevo presupuesto creado", form.description.slice(0,60)+" — "+form.amount+"€");
    if(andEmail){
      const body=[`PRESUPUESTO`,``,`Cliente: ${cl?.name}`,``,form.description,``,`Total: ${form.amount} €`,form.notes?`\nNotas: ${form.notes}`:"",`\nGenerado desde ThermoGest`].join("\n");
      sendEmail({to:cl?.email||"",subject:`Presupuesto – ${form.description.slice(0,40)}`,body});
    }
    onClose();
  }
  return (
    <Modal onClose={onClose} w={500} zIndex={300}>
      <MHead title="Nuevo presupuesto" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:13 }}>
        <Field label="Descripción"><textarea value={form.description} onChange={e=>upd("description",e.target.value)} placeholder="Materiales, piezas, mano de obra..." style={{...inp(),minHeight:75,resize:"vertical"}}/></Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Importe (€)"><input type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)} style={inp()} placeholder="0.00"/></Field>
          <Field label="Estado"><select value={form.status} onChange={e=>upd("status",e.target.value)} style={inp()}>{PS_ORDER.map(k=><option key={k} value={k}>{PS[k].label}</option>)}</select></Field>
        </div>
        <Field label="Notas"><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Condiciones, validez..."/></Field>
        <PhotoUpload photos={form.photos} onAdd={addPhoto} onRemove={removePhoto}/>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch="Guardar" onClick={()=>save(false)} disabled={!form.description.trim()||!form.amount}/>
          <Btn ch="Guardar y enviar" onClick={()=>save(true)} v="s" disabled={!form.description.trim()||!form.amount}/>
        </div>
      </div>
    </Modal>
  );
}

function AveriaDetail({ breakdown:initB, data, setData, user, company, onClose }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [showBudget, setShowBudget] = useState(false);
  const [showParte, setShowParte] = useState(false);
  const b = data.breakdowns.find(x=>x.id===initB.id)||initB;
  const cl = data.clients.find(c=>c.id===b.clientId);
  const tc = TECHS.find(t=>t.id===b.techId);
  const budgets = data.budgets.filter(bu=>b.budgetIds.includes(bu.id));
  const isAdmin = user.role==="admin";

  const updSt=s=>setData(d=>({...d,breakdowns:d.breakdowns.map(x=>x.id===b.id?{...x,status:s}:x)}));
  const assignTech=id=>setData(d=>({...d,breakdowns:d.breakdowns.map(x=>x.id===b.id?{...x,techId:Number(id)}:x)}));
  const updBuSt=(bId,s)=>setData(d=>({...d,budgets:d.budgets.map(bu=>bu.id===bId?{...bu,status:s}:bu)}));
  const addPhoto=src=>setData(d=>({...d,breakdowns:d.breakdowns.map(x=>x.id===b.id?{...x,photos:[...(x.photos||[]),src]}:x)}));
  const removePhoto=i=>setData(d=>({...d,breakdowns:d.breakdowns.map(x=>x.id===b.id?{...x,photos:(x.photos||[]).filter((_,j)=>j!==i)}:x)}));
  function addNote(){ if(!note.trim())return; const now=new Date(); const date=`${now.toLocaleDateString("es-ES")} ${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`; setData(d=>({...d,breakdowns:d.breakdowns.map(x=>x.id===b.id?{...x,notes:[...x.notes,{id:Date.now(),author:user.name,text:note.trim(),date}]}:x)})); setNote(""); }

  const tabs = ["info","fotos","notas","presupuestos","parte"];
  const tabLabel = { info:"Información", fotos:`Fotos (${(b.photos||[]).length})`, notas:`Notas (${b.notes.length})`, presupuestos:`Presupuestos (${budgets.length})`, parte:b.parte?"Parte ✓":"Parte de trabajo" };

  return (
    <Modal onClose={onClose} w={700}>
      <div style={{ padding:isMobile?"16px 16px 0":"20px 22px 0", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}>AVERÍA #{b.id}</span>
              <Badge status={b.status}/>
              {b.fromForm && <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:T.purpleLight, border:`1px solid ${T.purple}20`, color:T.purple, fontWeight:600 }}>Web</span>}
            </div>
            <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif" }}>{cl?.name}</h2>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
              <span style={{ fontSize:12, color:T.muted }}>{b.address}</span>
              <button onClick={()=>openMaps(b.address)} style={{ padding:"2px 8px", borderRadius:6, border:`1.5px solid #bfdbfe`, background:T.accentLight, color:T.accent, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Cómo llegar</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20 }}>×</button>
        </div>
        <div style={{ display:"flex", overflowX:"auto", gap:0, WebkitOverflowScrolling:"touch", scrollbarWidth:"none" }}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:"9px 14px", border:"none", background:"none", color:tab===t?T.accent:T.sub, fontSize:12, fontWeight:tab===t?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent", whiteSpace:"nowrap" }}>
              {tabLabel[t]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding:"20px 22px" }}>
        {tab==="info" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Field label="Estado — pulsa para cambiar">
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {BS_ORDER.map(k=>{ const s=BS[k]; return (
                  <button key={k} onClick={()=>updSt(k)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${b.status===k?s.color:T.border}`, background:b.status===k?s.color+"12":"transparent", color:b.status===k?s.color:T.sub, fontSize:11, fontWeight:b.status===k?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{s.label}</button>
                ); })}
              </div>
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Cliente">
                <div style={{ padding:"10px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{cl?.name}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{cl?.phone}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{cl?.email}</div>
                </div>
              </Field>
              <Field label="Visita">
                <div style={{ padding:"10px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:13, color:T.text, marginBottom:8 }}>{b.visitDate}</div>
                  <button onClick={()=>openMaps(b.address)} style={{ padding:"4px 10px", borderRadius:6, border:`1.5px solid #bfdbfe`, background:T.accentLight, color:T.accent, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Cómo llegar</button>
                </div>
              </Field>
            </div>
            {isAdmin
              ? <Field label="Técnico"><select value={b.techId||""} onChange={e=>assignTech(e.target.value)} style={inp()}><option value="">Sin asignar</option>{TECHS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
              : <Field label="Técnico"><div style={{ padding:"10px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}><Ava name={tc?.name||"?"} size={24} color={tc?.color}/><span style={{ fontSize:13 }}>{tc?.name||"Sin asignar"}</span></div></Field>
            }
            <Field label="Descripción"><div style={{ padding:"10px 12px", background:T.surface, borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, color:T.text, lineHeight:1.6 }}>{b.description}</div></Field>
          </div>
        )}
        {tab==="fotos" && <PhotoUpload photos={b.photos||[]} onAdd={addPhoto} onRemove={removePhoto}/>}
        {tab==="notas" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {b.notes.length===0 && <p style={{ color:T.muted, fontSize:13 }}>Sin notas técnicas.</p>}
            {b.notes.map(n=>(
              <div key={n.id} style={{ background:T.surface, borderRadius:10, padding:"12px 14px", border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}><Ava name={n.author} size={20} color={TECHS.find(t=>t.name===n.author)?.color}/><span style={{ fontSize:11, fontWeight:600, color:T.accent }}>{n.author}</span></div>
                  <span style={{ fontSize:10, color:T.muted }}>{n.date}</span>
                </div>
                <p style={{ margin:0, fontSize:13, color:T.text, lineHeight:1.5 }}>{n.text}</p>
              </div>
            ))}
            <div style={{ display:"flex", gap:8 }}>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Añadir nota técnica..." style={{...inp(),flex:1,minHeight:65,resize:"vertical"}}/>
              <div style={{ display:"flex", alignItems:"flex-end" }}><Btn ch="Añadir" onClick={addNote} disabled={!note.trim()}/></div>
            </div>
          </div>
        )}
        {tab==="presupuestos" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"flex-end" }}><Btn ch="+ Nuevo presupuesto" onClick={()=>setShowBudget(true)}/></div>
            {budgets.length===0 && <p style={{ color:T.muted, fontSize:13 }}>Sin presupuestos.</p>}
            {[...budgets].sort((a,b)=>(SO_P[a.status]??5)-(SO_P[b.status]??5)).map(bu=>(
              <div key={bu.id} style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:3 }}>{bu.description}</div>{bu.notes&&<div style={{ fontSize:11, color:T.muted }}>{bu.notes}</div>}</div>
                  <div style={{ textAlign:"right", marginLeft:14, flexShrink:0 }}><div style={{ fontSize:18, fontWeight:700, color:T.accent, fontFamily:"'Sora',sans-serif" }}>{bu.amount}€</div><div style={{ fontSize:10, color:T.muted }}>{bu.createdAt}</div></div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <Badge status={bu.status} type="p"/>
                  {PS_ORDER.filter(k=>k!==bu.status).map(k=><button key={k} onClick={()=>updBuSt(bu.id,k)} style={{ padding:"2px 9px",borderRadius:20,border:`1px solid ${T.borderDark}`,background:"transparent",color:PS[k].color,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>→ {PS[k].label}</button>)}
                  <button onClick={()=>{ const body=[`PRESUPUESTO`,``,`Cliente: ${cl?.name}`,``,bu.description,``,`Total: ${bu.amount} €`,bu.notes?`\nNotas: ${bu.notes}`:""].join("\n"); sendEmail({to:cl?.email||"",subject:`Presupuesto – ${bu.description.slice(0,40)}`,body}); }} style={{ marginLeft:"auto",padding:"4px 11px",borderRadius:7,border:`1.5px solid #bbf7d0`,background:T.greenLight,color:T.green,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Enviar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab==="parte" && (
          b.parte ? (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <span style={{ padding:"4px 12px", borderRadius:20, background:T.greenLight, border:"1px solid #bbf7d0", color:T.green, fontSize:11, fontWeight:600 }}>Parte completado · {b.parte.fecha}</span>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn ch="Editar" onClick={()=>setShowParte(true)} v="g" sm/>
                  <Btn ch="PDF + Email" onClick={async()=>{ try{ const doc=await buildPartePDF(b.parte,b,cl,company||{}); window.open(doc.output("bloburl"),"_blank"); setTimeout(()=>{ const p=b.parte; const h=calcHours(p.horasInicio,p.horasFin); const ph=parseFloat(p.precioHora||0); const tMO=h*ph; const tMat=(p.materiales||[]).filter(m=>m.desc).reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0); const base=tMat+tMO; const body=[`PARTE DE TRABAJO – ${p.fecha}`,`Cliente: ${cl?.name}`,`Total: ${(p.aplicarIVA?base*1.21:base).toFixed(2)}€`,`El PDF está adjunto.`].join("\n"); sendEmail({to:cl?.email||"",subject:`Parte de trabajo – ${bd?.equipment||""} – ${p.fecha}`,body}); },600); }catch(e){alert("Error al generar PDF");} }} v="s" sm/>
                </div>
              </div>
              <div style={{ background:T.surface, borderRadius:12, padding:"16px", border:`1px solid ${T.border}` }}>
                {(()=>{ const p=b.parte; const h=calcHours(p.horasInicio,p.horasFin); const ph=parseFloat(p.precioHora||0); const tMO=h*ph; const tMat=(p.materiales||[]).filter(m=>m.desc).reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0); const base=tMat+tMO; const iva=p.aplicarIVA?base*0.21:0; const total=base+iva; return (<>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                    {[["Técnico",p.tecnico],["Inicio",p.horasInicio||"—"],["Fin",p.horasFin||"—"]].map(([l,v])=><div key={l}><div style={{ fontSize:10, color:T.muted, fontWeight:600, textTransform:"uppercase", marginBottom:3 }}>{l}</div><div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{v}</div></div>)}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                    {[["Tiempo",`${h.toFixed(2)} h`,T.accent],["M.O.",`${tMO.toFixed(2)} €`,T.orange],["Total",`${total.toFixed(2)} €`,T.green]].map(([l,v,c])=><div key={l} style={{ background:c+"10",border:`1px solid ${c}20`,borderRadius:8,padding:"8px",textAlign:"center" }}><div style={{ fontSize:9,color:T.muted,fontWeight:600,textTransform:"uppercase",marginBottom:3 }}>{l}</div><div style={{ fontSize:14,fontWeight:700,color:c }}>{v}</div></div>)}
                  </div>
                  <div style={{ fontSize:13, color:T.text, lineHeight:1.6, marginBottom:10 }}>{p.trabajoRealizado||"—"}</div>
                  {p.materiales.filter(m=>m.desc).map((m,i)=><div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontSize:12,color:T.sub }}><span>{m.desc}</span><span>{m.qty} × {m.precio}€ = <strong style={{ color:T.accent }}>{(m.qty*m.precio).toFixed(2)}€</strong></span></div>)}
                  {p.firma && <div style={{ marginTop:12 }}><div style={{ fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6 }}>Firma</div><img src={p.firma} alt="firma" style={{ maxWidth:220,borderRadius:8,border:`1px solid ${T.border}` }}/></div>}
                </>); })()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <p style={{ color:T.sub, fontSize:14, marginBottom:20 }}>No se ha rellenado el parte de trabajo.</p>
              <Btn ch="Crear parte de trabajo" onClick={()=>setShowParte(true)}/>
            </div>
          )
        )}
      </div>
      {showBudget && <NewBudgetModal breakdownId={b.id} clientId={b.clientId} client={cl} setData={setData} onClose={()=>setShowBudget(false)}/>}
      {showParte  && <ParteModal breakdown={b} client={cl} setData={setData} user={user} company={company} onClose={()=>setShowParte(false)}/>}
    </Modal>
  );
}

function AveriasList({ data, setData, user, onSelectBreakdown }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const isAdmin = user.role==="admin";
  const all = isAdmin ? data.breakdowns : data.breakdowns.filter(b=>b.techId===user.id);
  const sorted = [...all].sort((a,b)=>(SO_B[a.status]??5)-(SO_B[b.status]??5));
  const filtered = filter==="all" ? sorted : sorted.filter(b=>b.status===filter);
  const client=id=>data.clients.find(c=>c.id===id);
  const tech=id=>TECHS.find(t=>t.id===id);
  const counts={all:all.length}; BS_ORDER.forEach(k=>{counts[k]=all.filter(b=>b.status===k).length;});

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Averías</h1>
        <Btn ch={isMobile?"+ Nueva":"+ Nueva avería"} onClick={()=>setShowNew(true)}/>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {[{key:"all",label:`Todas (${all.length})`},...BS_ORDER.map(k=>({key:k,label:`${BS[k].label} (${counts[k]})`}))].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${filter===f.key?T.accent:T.border}`, background:filter===f.key?T.accentLight:"#fff", color:filter===f.key?T.accent:T.sub, fontSize:11, fontWeight:filter===f.key?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>{f.label}</button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length===0 && <div style={{ textAlign:"center", color:T.muted, padding:"50px 0", fontSize:13 }}>No hay averías en este estado</div>}
        {filtered.map(b=>{ const cl=client(b.clientId); const tc=tech(b.techId); return (
          <div key={b.id} onClick={()=>onSelectBreakdown(b)}
            style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:11, padding:"13px 15px", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor=T.accent+"50"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform="translateY(0)"; }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:5, lineHeight:1.3 }}>{b.description}</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, color:T.muted, fontWeight:500 }}>{cl?.name}</span>
                <span style={{ fontSize:10, color:T.border }}>·</span>
                <span style={{ fontSize:11, color:T.muted }}>{b.equipment}</span>
                <span style={{ fontSize:10, color:T.border }}>·</span>
                <span style={{ fontSize:11, color:T.muted }}>{b.visitDate}</span>
                {b.fromForm && <span style={{ fontSize:9, padding:"1px 6px", borderRadius:8, background:T.purpleLight, border:`1px solid ${T.purple}20`, color:T.purple, fontWeight:600 }}>Web</span>}
                {b.parte && <span style={{ fontSize:10, color:T.green, fontWeight:600 }}>Parte</span>}
                {(b.photos||[]).length>0 && <span style={{ fontSize:10, color:T.muted }}>{b.photos.length} foto{b.photos.length!==1?"s":""}</span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Badge status={b.status}/>
                <button onClick={e=>{ e.stopPropagation(); openMaps(b.address); }} style={{ padding:"4px 10px", borderRadius:7, border:`1.5px solid #bfdbfe`, background:T.accentLight, color:T.accent, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>Cómo llegar</button>
              </div>
            </div>
          </div>
        ); })}
      </div>
      {showNew && <NewAveriaModal data={data} setData={setData} user={user} onClose={()=>setShowNew(false)}/>}
    </div>
  );
}

/* ─── PRESUPUESTOS ───────────────────────────────────────────────────────── */
function StandaloneBudgetModal({ data, setData, onClose }) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState("existing");
  const [clientId, setClientId] = useState(data.clients[0]?.id||"");
  const [newCl, setNewCl] = useState({ name:"", phone:"", email:"", address:"" });
  const [form, setForm] = useState({ breakdownId:"", description:"", amount:"", status:"nuevo", notes:"", photos:[] });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const cl = data.clients.find(c=>c.id===Number(clientId));
  const clBreakdowns = data.breakdowns.filter(b=>b.clientId===Number(clientId));
  function addPhoto(src){ setForm(p=>({...p,photos:[...p.photos,src]})); }
  function removePhoto(i){ setForm(p=>({...p,photos:p.photos.filter((_,j)=>j!==i)})); }
  const canSave = form.description.trim() && form.amount && (mode==="existing"||newCl.name.trim());
  function save(andEmail=false){
    if(!canSave) return;
    let finalClientId = Number(clientId);
    let newClients = data.clients;
    if(mode==="new"){
      const nc={ id:Date.now()+1, ...newCl };
      newClients=[...data.clients,nc];
      finalClientId=nc.id;
    }
    const nb={ id:Date.now(), breakdownId:form.breakdownId?Number(form.breakdownId):null, clientId:finalClientId, description:form.description.trim(), amount:Number(form.amount), status:form.status, notes:form.notes, photos:form.photos, createdAt:todayStr() };
    setData(d=>({
      ...d, clients:newClients, budgets:[...d.budgets,nb],
      breakdowns:form.breakdownId?d.breakdowns.map(b=>b.id===Number(form.breakdownId)?{...b,budgetIds:[...b.budgetIds,nb.id]}:b):d.breakdowns,
    }));
    pushNotif("Nuevo presupuesto creado", form.description.slice(0,60)+" — "+form.amount+"€");
    if(andEmail){
      const finalCl = mode==="new"?{...newCl}:cl;
      const body=[`PRESUPUESTO`,``,`Cliente: ${finalCl?.name}`,`Tel: ${finalCl?.phone||"—"}`,`Dirección: ${finalCl?.address||"—"}`,``,form.description,``,`Total: ${form.amount} €`,form.notes?`\nNotas: ${form.notes}`:""].join("\n");
      sendEmail({to:finalCl?.email||"",subject:`Presupuesto – ${form.description.slice(0,40)}`,body});
    }
    onClose();
  }
  return (
    <Modal onClose={onClose} w={580}>
      <MHead title="Nuevo presupuesto" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:16 }}>
        {/* Cliente */}
        <div style={{ background:T.surface, borderRadius:12, padding:"16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:12 }}>Cliente</div>
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {[{k:"existing",l:"Cliente existente"},{k:"new",l:"+ Nuevo cliente"}].map(o=>(
              <button key={o.k} onClick={()=>setMode(o.k)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${mode===o.k?T.accent:T.border}`, background:mode===o.k?T.accentLight:"#fff", color:mode===o.k?T.accent:T.sub, fontSize:11, fontWeight:mode===o.k?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{o.l}</button>
            ))}
          </div>
          {mode==="existing" ? (
            <>
              <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{...inp(),marginBottom:cl?12:0}}>
                {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {cl && (
                <div style={{ background:"#fff", borderRadius:8, padding:"10px 12px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:3 }}>{cl.name}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{cl.phone} · {cl.email}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{cl.address}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <Field label="Nombre *"><input value={newCl.name} onChange={e=>setNewCl(p=>({...p,name:e.target.value}))} style={inp({fontSize:12,padding:"7px 10px"})} placeholder="Nombre o razón social"/></Field>
                <Field label="Teléfono"><input value={newCl.phone} onChange={e=>setNewCl(p=>({...p,phone:e.target.value}))} style={inp({fontSize:12,padding:"7px 10px"})} placeholder="6XX XXX XXX"/></Field>
              </div>
              <Field label="Email"><input type="email" value={newCl.email} onChange={e=>setNewCl(p=>({...p,email:e.target.value}))} style={inp({fontSize:12,padding:"7px 10px"})} placeholder="correo@ejemplo.com"/></Field>
              <Field label="Dirección"><input value={newCl.address} onChange={e=>setNewCl(p=>({...p,address:e.target.value}))} style={inp({fontSize:12,padding:"7px 10px"})} placeholder="Calle, número, piso..."/></Field>
            </div>
          )}
        </div>
        {mode==="existing" && clBreakdowns.length>0 && (
          <Field label="Avería relacionada (opcional)">
            <select value={form.breakdownId} onChange={e=>upd("breakdownId",e.target.value)} style={inp()}>
              <option value="">— Sin avería asociada —</option>
              {clBreakdowns.map(b=><option key={b.id} value={b.id}>#{b.id} · {b.equipment} · {BS[b.status]?.label}</option>)}
            </select>
          </Field>
        )}
        {/* Presupuesto */}
        <div style={{ background:T.surface, borderRadius:12, padding:"16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:12 }}>Detalle del presupuesto</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Field label="Descripción *"><textarea value={form.description} onChange={e=>upd("description",e.target.value)} placeholder="Materiales, piezas, mano de obra..." style={{...inp(),minHeight:75,resize:"vertical"}}/></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Importe (€) *"><input type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)} style={inp()} placeholder="0.00"/></Field>
              <Field label="Estado"><select value={form.status} onChange={e=>upd("status",e.target.value)} style={inp()}>{PS_ORDER.map(k=><option key={k} value={k}>{PS[k].label}</option>)}</select></Field>
            </div>
            <Field label="Notas"><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} style={{...inp(),minHeight:50,resize:"vertical"}} placeholder="Condiciones, validez..."/></Field>
            <PhotoUpload photos={form.photos} onAdd={addPhoto} onRemove={removePhoto}/>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, flexWrap:"wrap" }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch="Guardar" onClick={()=>save(false)} disabled={!canSave}/>
          <Btn ch="Guardar y enviar" onClick={()=>save(true)} v="s" disabled={!canSave}/>
        </div>
      </div>
    </Modal>
  );
}

function BudgetDetail({ budget:initBu, data, setData, onClose }) {
  const isMobile = useIsMobile();
  const bu = data.budgets.find(b=>b.id===initBu.id)||initBu;
  const bd = data.breakdowns.find(b=>b.id===bu.breakdownId);
  const cl = data.clients.find(c=>c.id===bu.clientId)||data.clients.find(c=>c.id===bd?.clientId);
  const tc = TECHS.find(t=>t.id===bd?.techId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ description:bu.description, amount:bu.amount, notes:bu.notes||"", status:bu.status, photos:bu.photos||[] });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function addPhoto(src){ setForm(p=>({...p,photos:[...p.photos,src]})); }
  function removePhoto(i){ setForm(p=>({...p,photos:p.photos.filter((_,j)=>j!==i)})); }
  const updSt=s=>setData(d=>({...d,budgets:d.budgets.map(b=>b.id===bu.id?{...b,status:s}:b)}));
  function saveEdits(){ setData(d=>({...d,budgets:d.budgets.map(b=>b.id===bu.id?{...b,...form}:b)})); setEditing(false); }
  function doEmail(){ const body=[`PRESUPUESTO`,``,`Cliente: ${cl?.name}`,`Tel: ${cl?.phone||"—"}`,`Dirección: ${cl?.address||bd?.address||"—"}`,``,form.description,``,`Total: ${bu.amount} €`,bu.notes?`\nNotas: ${bu.notes}`:""].join("\n"); sendEmail({to:cl?.email||"",subject:`Presupuesto – ${bu.description.slice(0,40)}`,body}); }

  return (
    <Modal onClose={onClose} w={660}>
      <div style={{ padding:"20px 22px 0", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}>PRESUPUESTO #{bu.id}</span>
              <Badge status={bu.status} type="p"/>
              {!bu.breakdownId && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:20, background:T.purpleLight, border:`1px solid ${T.purple}20`, color:T.purple, fontWeight:600 }}>Directo</span>}
            </div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text, maxWidth:460, lineHeight:1.3, fontFamily:"'Sora',sans-serif" }}>{bu.description}</h2>
            <p style={{ margin:"4px 0 0", fontSize:12, color:T.muted }}>{bu.createdAt}{bd?` · Avería #${bd.id}`:""}</p>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20 }}>×</button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18, flexWrap:"wrap" }}>
          <div style={{ background:T.accentLight, border:`1px solid #bfdbfe`, borderRadius:10, padding:"10px 18px" }}>
            <div style={{ fontSize:9, color:T.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Importe total</div>
            <div style={{ fontSize:26, fontWeight:700, color:T.accent, fontFamily:"'Sora',sans-serif" }}>{bu.amount} €</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn ch={editing?"Cancelar edición":"Editar"} onClick={()=>setEditing(e=>!e)} v="g" sm/>
            <Btn ch="Enviar email" onClick={doEmail} v="s" sm/>
          </div>
        </div>
      </div>
      <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        {/* Estado */}
        <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Estado — pulsa para cambiar</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {PS_ORDER.map(k=>{ const s=PS[k]; return (
              <button key={k} onClick={()=>updSt(k)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 15px", borderRadius:20, border:`1.5px solid ${bu.status===k?s.color:T.border}`, background:bu.status===k?s.color+"12":"#fff", color:bu.status===k?s.color:T.sub, fontSize:12, fontWeight:bu.status===k?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:bu.status===k?s.color:T.muted,flexShrink:0 }}/>
                {s.label}
                {bu.status===k && <span style={{ fontSize:11 }}>✓</span>}
              </button>
            ); })}
          </div>
        </div>
        {/* Cliente */}
        {cl && (
          <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Cliente</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Ava name={cl.name} size={40}/>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:3 }}>{cl.name}</div>
                <div style={{ fontSize:12, color:T.muted }}>{cl.phone} · {cl.email}</div>
                {cl.address && <div style={{ fontSize:12, color:T.muted, display:"flex", alignItems:"center", gap:6, marginTop:3 }}>{cl.address} <button onClick={()=>openMaps(cl.address)} style={{ padding:"2px 8px",borderRadius:6,border:`1.5px solid #bfdbfe`,background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>Ver ruta</button></div>}
              </div>
            </div>
          </div>
        )}
        {/* Avería */}
        {bd && (
          <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Avería relacionada</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}><span style={{ fontSize:11,color:T.muted,fontWeight:600 }}>#{bd.id}</span><Badge status={bd.status}/></div>
                <div style={{ fontSize:13, color:T.text }}>{bd.equipment} · {bd.description}</div>
                <div style={{ fontSize:12, color:T.muted, marginTop:3, display:"flex", alignItems:"center", gap:8 }}>
                  {bd.visitDate} · {tc?.name}
                  <button onClick={()=>openMaps(bd.address)} style={{ padding:"2px 8px",borderRadius:6,border:`1.5px solid #bfdbfe`,background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>Ver ruta</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Detalle / Edición */}
        {editing ? (
          <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1.5px solid ${T.accent}40` }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.accent, marginBottom:12 }}>Editando presupuesto</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Descripción"><textarea value={form.description} onChange={e=>upd("description",e.target.value)} style={{...inp(),minHeight:70,resize:"vertical"}}/></Field>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                <Field label="Importe (€)"><input type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)} style={inp()}/></Field>
                <Field label="Estado"><select value={form.status} onChange={e=>upd("status",e.target.value)} style={inp()}>{PS_ORDER.map(k=><option key={k} value={k}>{PS[k].label}</option>)}</select></Field>
              </div>
              <Field label="Notas"><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} style={{...inp(),minHeight:50,resize:"vertical"}}/></Field>
              <PhotoUpload photos={form.photos} onAdd={addPhoto} onRemove={removePhoto}/>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                <Btn ch="Cancelar" onClick={()=>setEditing(false)} v="g"/>
                <Btn ch="Guardar cambios" onClick={saveEdits}/>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Detalle</div>
            <div style={{ fontSize:13, color:T.text, lineHeight:1.7, marginBottom:bu.notes?12:0 }}>{bu.description}</div>
            {bu.notes && <div style={{ fontSize:13, color:T.sub, lineHeight:1.6, background:"#fff", borderRadius:8, padding:"10px 12px", border:`1px solid ${T.border}` }}>{bu.notes}</div>}
            {(bu.photos||[]).length>0 && (
              <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))", gap:8 }}>
                {bu.photos.map((src,i)=><div key={i} style={{ aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}` }}><img src={src} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/></div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function PresupuestosList({ data, setData, user }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const isAdmin = user.role==="admin";
  const all = isAdmin ? data.budgets : data.budgets.filter(bu=>{ const bd=data.breakdowns.find(b=>b.id===bu.breakdownId); return bd?.techId===user.id; });
  const sorted=[...all].sort((a,b)=>(SO_P[a.status]??5)-(SO_P[b.status]??5));
  const filtered = filter==="all" ? sorted : sorted.filter(b=>b.status===filter);
  const client=id=>data.clients.find(c=>c.id===id);
  const total=filtered.reduce((s,b)=>s+(b.amount||0),0);

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:"0 0 3px", fontFamily:"'Sora',sans-serif" }}>Presupuestos</h1>
          <p style={{ color:T.muted, fontSize:12, margin:0 }}>{filtered.length} presupuestos · <span style={{ color:T.accent, fontWeight:600 }}>{total.toLocaleString("es-ES")} €</span></p>
        </div>
        <Btn ch={isMobile?"+ Nuevo":"+ Nuevo presupuesto"} onClick={()=>setShowNew(true)}/>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {[{key:"all",label:"Todos"},...PS_ORDER.map(k=>({key:k,label:PS[k].label}))].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{ padding:"5px 13px", borderRadius:20, border:`1.5px solid ${filter===f.key?T.accent:T.border}`, background:filter===f.key?T.accentLight:"#fff", color:filter===f.key?T.accent:T.sub, fontSize:11, fontWeight:filter===f.key?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>{f.label}</button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length===0 && <div style={{ textAlign:"center", color:T.muted, padding:"50px 0", fontSize:13 }}>Sin presupuestos en este estado</div>}
        {filtered.map(bu=>{ const cl=client(bu.clientId)||client(data.breakdowns.find(b=>b.id===bu.breakdownId)?.clientId); const s=PS[bu.status]; return (
          <div key={bu.id} onClick={()=>setSelected(bu)}
            style={{ background:"#fff", border:`1px solid ${T.border}`, borderLeft:`3px solid ${s?.color||T.muted}`, borderRadius:11, padding:"13px 15px", cursor:"pointer", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="translateY(0)"; }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bu.description}</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:T.muted, fontWeight:500 }}>{cl?.name||"Sin cliente"}</span>
                <span style={{ fontSize:10, color:T.border }}>·</span>
                <span style={{ fontSize:11, color:T.muted }}>{bu.breakdownId?`Avería #${bu.breakdownId}`:"Directo"}</span>
                <span style={{ fontSize:10, color:T.border }}>·</span>
                <span style={{ fontSize:11, color:T.muted }}>{bu.createdAt}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18, fontWeight:700, color:T.accent, fontFamily:"'Sora',sans-serif" }}>{bu.amount} €</span>
                <Badge status={bu.status} type="p"/>
              </div>
            </div>
          </div>
        ); })}
      </div>
      {showNew  && <StandaloneBudgetModal data={data} setData={setData} onClose={()=>setShowNew(false)}/>}
      {selected && <BudgetDetail budget={selected} data={data} setData={setData} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

/* ─── CLIENTES ───────────────────────────────────────────────────────────── */
function ClientesList({ data, setData }) {
  const isMobile = useIsMobile();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name:"", phone:"", email:"", address:"" });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function addClient(){ if(!form.name.trim())return; setData(d=>({...d,clients:[...d.clients,{id:Date.now(),...form}]})); setForm({name:"",phone:"",email:"",address:""}); setShowNew(false); }
  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Clientes</h1>
        <Btn ch="+ Nuevo cliente" onClick={()=>setShowNew(true)}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
        {data.clients.map(cl=>{ const bds=data.breakdowns.filter(b=>b.clientId===cl.id).length; const open=data.breakdowns.filter(b=>b.clientId===cl.id&&b.status!=="cerrada").length; const insts=(data.instalaciones||[]).filter(i=>i.clientId===cl.id).length; return (
          <div key={cl.id} style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"18px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}><Ava name={cl.name} size={40}/><div><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{cl.name}</div><div style={{ fontSize:11, color:T.muted }}>{cl.phone}</div><div style={{ fontSize:11, color:T.muted }}>{cl.email}</div></div></div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:11, color:T.sub }}>{cl.address}</span>
              <button onClick={()=>openMaps(cl.address)} style={{ padding:"3px 9px",borderRadius:6,border:`1.5px solid #bfdbfe`,background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0,marginLeft:8 }}>Ver ruta</button>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, padding:"2px 9px", borderRadius:20, background:T.accentLight, border:`1px solid #bfdbfe`, color:T.accent, fontWeight:600 }}>{bds} averías</span>
              {open>0 && <span style={{ fontSize:10, padding:"2px 9px", borderRadius:20, background:T.redLight, border:"1px solid #fecaca", color:T.red, fontWeight:600 }}>{open} abiertas</span>}
              {insts>0 && <span style={{ fontSize:10, padding:"2px 9px", borderRadius:20, background:T.tealLight, border:`1px solid ${T.teal}28`, color:T.teal, fontWeight:600 }}>{insts} instalación{insts!==1?"es":""}</span>}
            </div>
          </div>
        ); })}
      </div>
      {showNew && (
        <Modal onClose={()=>setShowNew(false)} w={420}>
          <MHead title="Nuevo cliente" onClose={()=>setShowNew(false)}/>
          <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:13 }}>
            <Field label="Nombre / Empresa"><input value={form.name} onChange={e=>upd("name",e.target.value)} style={inp()} placeholder="Nombre o razón social"/></Field>
            <Field label="Teléfono"><input value={form.phone} onChange={e=>upd("phone",e.target.value)} style={inp()} placeholder="6XX XXX XXX"/></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="correo@ejemplo.com"/></Field>
            <Field label="Dirección"><input value={form.address} onChange={e=>upd("address",e.target.value)} style={inp()} placeholder="Calle, número, piso..."/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}><Btn ch="Cancelar" onClick={()=>setShowNew(false)} v="g"/><Btn ch="Añadir cliente" onClick={addClient} disabled={!form.name.trim()}/></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── CALENDARIO ─────────────────────────────────────────────────────────── */
const ET = { instalacion:{label:"Instalación",color:"#16a34a"}, revision:{label:"Revisión",color:"#0284c7"}, averia_programada:{label:"Avería prog.",color:"#d97706"}, otro:{label:"Otro",color:"#7c3aed"} };

function CalendarView({ data, setData, user }) {
  const isMobile = useIsMobile();
  const now=new Date(); const [year,setYear]=useState(now.getFullYear()); const [month,setMonth]=useState(now.getMonth());
  const [sel,setSel]=useState(null); const [showEvent,setShowEvent]=useState(false);
  const [form,setForm]=useState({type:"instalacion",title:"",clientId:data.clients[0]?.id||"",address:"",date:"",techId:TECHS[0].id,notes:""});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const pad=n=>String(n).padStart(2,"0");
  const prefix=`${year}-${pad(month+1)}`;
  const daysInMonth=new Date(year,month+1,0).getDate();
  let sdow=new Date(year,month,1).getDay(); sdow=sdow===0?6:sdow-1;
  const cells=Array.from({length:Math.ceil((sdow+daysInMonth)/7)*7},(_,i)=>{ const d=i-sdow+1; return(d>=1&&d<=daysInMonth)?d:null; });
  const todayStr=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const calEv=d=>{ if(!d)return[]; const ds=`${prefix}-${pad(d)}`; const evs=data.events.filter(e=>e.date===ds); const bds=data.breakdowns.filter(b=>b.visitDate===ds&&b.status!=="cerrada"); return [...evs.map(e=>({...e,_type:"event"})),...bds.map(b=>({...b,_type:"bd",color:T.accent,title:b.description}))];}
  const selDs=sel?`${prefix}-${pad(sel)}`:null; const selItems=sel?calEv(sel):[];
  const client=id=>data.clients.find(c=>c.id===Number(id));
  const tech=id=>TECHS.find(t=>t.id===Number(id));
  function addEvent(){ if(!form.title.trim()||!form.date)return; const cl=client(form.clientId); setData(d=>({...d,events:[...d.events,{id:Date.now(),...form,address:form.address||(cl?.address||""),clientId:Number(form.clientId),techId:Number(form.techId),color:ET[form.type]?.color||T.accent}]})); setShowEvent(false); }
  function delEvent(id){ setData(d=>({...d,events:d.events.filter(e=>e.id!==id)})); }
  const prev=()=>{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next=()=>{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const DOW=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:0, fontFamily:"'Sora',sans-serif" }}>Calendario</h1>
        {user.role==="admin" && <Btn ch="+ Evento" onClick={()=>setShowEvent(true)}/>}
      </div>
      <div style={{ display:"flex", gap:18, flexDirection:isMobile?"column":"row" }}>
        {/* Grid */}
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, background:"#fff", borderRadius:10, padding:"10px 16px", border:`1px solid ${T.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <button onClick={prev} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:18,padding:"0 6px" }}>‹</button>
            <span style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Sora',sans-serif" }}>{MONTHS[month]} {year}</span>
            <button onClick={next} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:18,padding:"0 6px" }}>›</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
            {DOW.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:600, color:T.muted, padding:"5px 0", textTransform:"uppercase", letterSpacing:"0.05em" }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {cells.map((d,i)=>{ const ds=d?`${prefix}-${pad(d)}`:null; const isToday=ds===todayStr; const isSel=d===sel; const items=calEv(d); return (
              <div key={i} onClick={()=>d&&setSel(isSel?null:d)}
                style={{ minHeight:isMobile?44:70, borderRadius:8, padding:"5px 5px 4px", background:isSel?"#eff6ff":isToday?"#f0f9ff":"#fff", border:`1px solid ${isSel?T.accent:isToday?T.accent+"60":T.border}`, cursor:d?"pointer":"default", transition:"all 0.12s" }}
                onMouseEnter={e=>{ if(d&&!isSel) e.currentTarget.style.background="#f8fafc"; }}
                onMouseLeave={e=>{ if(d&&!isSel) e.currentTarget.style.background=isToday?"#f0f9ff":"#fff"; }}>
                {d && <>
                  <div style={{ fontSize:11, fontWeight:isToday?700:400, color:isToday?T.accent:T.text, marginBottom:3 }}>{d}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    {items.slice(0,isMobile?1:2).map((ev,j)=><div key={j} style={{ fontSize:9, background:(ev.color||T.accent)+"20", color:ev.color||T.accent, borderRadius:3, padding:"1px 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.title}</div>)}
                    {items.length>2 && <div style={{ fontSize:9, color:T.muted }}>+{items.length-2}</div>}
                  </div>
                </>}
              </div>
            ); })}
          </div>
          {/* Legend */}
          <div style={{ display:"flex", gap:12, marginTop:12, flexWrap:"wrap" }}>
            {[...Object.entries(ET).map(([k,s])=>({label:s.label,color:s.color})),{label:"Avería activa",color:T.accent}].map(x=>(
              <div key={x.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T.sub }}>
                <span style={{ width:8,height:8,borderRadius:2,background:x.color,flexShrink:0 }}/>{x.label}
              </div>
            ))}
          </div>
        </div>
        {/* Side panel */}
        <div style={{ width:isMobile?"100%":250, flexShrink:0 }}>
          <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", position:isMobile?"static":"sticky", top:20 }}>
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}`, background:T.surface }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.sub }}>{selDs ? new Date(selDs+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"}) : "Selecciona un día"}</div>
            </div>
            <div style={{ padding:"12px" }}>
              {!sel && <p style={{ color:T.muted, fontSize:12, margin:0 }}>Pulsa un día para ver eventos.</p>}
              {sel && selItems.length===0 && <p style={{ color:T.muted, fontSize:12, margin:0 }}>Sin eventos este día.</p>}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {selItems.map((ev,i)=>{ const cl=client(ev.clientId); const tc=tech(ev.techId||ev.techId); return (
                  <div key={i} style={{ background:T.surface, borderRadius:8, padding:"10px 12px", border:`1px solid ${T.border}`, borderLeft:`3px solid ${ev.color||T.accent}` }}>
                    <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:4 }}>{ev.title}</div>
                    {cl && <div style={{ fontSize:11, color:T.muted, marginBottom:2 }}>{cl.name}</div>}
                    {tc && <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>{tc.name}</div>}
                    {ev.address && <button onClick={()=>openMaps(ev.address)} style={{ padding:"3px 9px",borderRadius:6,border:`1.5px solid #bfdbfe`,background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,display:"block",marginBottom:ev._type==="event"?6:0 }}>Cómo llegar</button>}
                    {ev._type==="event" && user.role==="admin" && <button onClick={()=>delEvent(ev.id)} style={{ background:"none",border:"none",color:T.red,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:0 }}>Eliminar evento</button>}
                    {ev._type==="bd" && <Badge status={ev.status}/>}
                  </div>
                ); })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showEvent && (
        <Modal onClose={()=>setShowEvent(false)} w={480}>
          <MHead title="Nuevo evento" onClose={()=>setShowEvent(false)}/>
          <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:13 }}>
            <Field label="Tipo"><select value={form.type} onChange={e=>upd("type",e.target.value)} style={inp()}>{Object.entries(ET).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}</select></Field>
            <Field label="Título"><input value={form.title} onChange={e=>upd("title",e.target.value)} style={inp()} placeholder="Descripción del evento"/></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Fecha"><input type="date" value={form.date} onChange={e=>upd("date",e.target.value)} style={inp()}/></Field>
              <Field label="Técnico"><select value={form.techId} onChange={e=>upd("techId",e.target.value)} style={inp()}>{TECHS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            </div>
            <Field label="Cliente"><select value={form.clientId} onChange={e=>{ upd("clientId",e.target.value); const cl=client(e.target.value); upd("address",cl?.address||""); }} style={inp()}>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Dirección"><input value={form.address} onChange={e=>upd("address",e.target.value)} style={inp()} placeholder="Dirección del trabajo"/></Field>
            <Field label="Notas"><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Observaciones..."/></Field>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}><Btn ch="Cancelar" onClick={()=>setShowEvent(false)} v="g"/><Btn ch="Añadir evento" onClick={addEvent} disabled={!form.title.trim()||!form.date}/></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── MANTENIMIENTO ──────────────────────────────────────────────────────── */
function InstModal({ clientId, inst, data, setData, onClose }) {
  const isMobile = useIsMobile();
  const isEdit=!!inst;
  const [tab,setTab]=useState("mensual");
  const [form,setForm]=useState(()=>inst?{...inst}:{
    id:"i"+Date.now(), clientId,
    nombre:"", tipo:"Caldera", ubicacion:"", descripcion:"",
    items_mensual:JSON.parse(JSON.stringify(TPL.mensual)), items_trimestral:JSON.parse(JSON.stringify(TPL.trimestral)),
    items_semestral:JSON.parse(JSON.stringify(TPL.semestral)), items_anual:JSON.parse(JSON.stringify(TPL.anual)),
    activa_mensual:false, activa_trimestral:false, activa_semestral:false, activa_anual:false,
    proxima_mensual:"", proxima_trimestral:"", proxima_semestral:"", proxima_anual:"",
  });
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function addItem(tipo){ const k=`_new_${tipo}`,ik=`items_${tipo}`; const v=(form[k]||"").trim(); if(!v)return; setForm(p=>({...p,[ik]:[...p[ik],v],[k]:""})); }
  function removeItem(tipo,i){ const ik=`items_${tipo}`; setForm(p=>({...p,[ik]:p[ik].filter((_,j)=>j!==i)})); }
  function save(){ if(!form.nombre.trim())return; setData(d=>({...d,instalaciones:isEdit?d.instalaciones.map(x=>x.id===form.id?form:x):[...(d.instalaciones||[]),form]})); onClose(); }
  function del(){ setData(d=>({...d,instalaciones:(d.instalaciones||[]).filter(x=>x.id!==form.id)})); onClose(); }

  return (
    <Modal onClose={onClose} w={620} zIndex={300}>
      <MHead title={isEdit?"Editar instalación":"Nueva instalación"} onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Caldera principal"/></Field>
          <Field label="Tipo de equipo"><select value={form.tipo} onChange={e=>upd("tipo",e.target.value)} style={inp()}>{MT_EQUIPOS.map(t=><option key={t}>{t}</option>)}</select></Field>
          <Field label="Ubicación"><input value={form.ubicacion} onChange={e=>upd("ubicacion",e.target.value)} style={inp()} placeholder="Sala de calderas, Planta 2..."/></Field>
          <Field label="Modelo / Descripción"><input value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)} style={inp()} placeholder="Junkers Cerapur 35kW"/></Field>
        </div>
        {/* Tipos activos */}
        <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:12 }}>Tipos de mantenimiento activos</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {MT_TIPOS.map(tipo=>{ const mt=MT[tipo]; const active=form[`activa_${tipo}`]; return (
              <div key={tipo} style={{ border:`2px solid ${active?mt.color:T.border}`, borderRadius:10, padding:"10px 12px", background:active?mt.color+"08":"transparent", transition:"all 0.15s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:active?10:0 }} onClick={()=>upd(`activa_${tipo}`,!active)}>
                  <div style={{ width:18,height:18,borderRadius:4,border:`2px solid ${active?mt.color:T.border}`,background:active?mt.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    {active && <svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:active?mt.color:T.sub }}>{mt.label}</span>
                </div>
                {active && <Field label="Próxima visita"><input type="date" value={form[`proxima_${tipo}`]||""} onChange={e=>upd(`proxima_${tipo}`,e.target.value)} style={inp({padding:"5px 8px",fontSize:12})}/></Field>}
              </div>
            ); })}
          </div>
        </div>
        {/* Checklists */}
        <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Checklist personalizable</div>
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {MT_TIPOS.map(tipo=>{ const mt=MT[tipo]; const a=tab===tipo; return <button key={tipo} onClick={()=>setTab(tipo)} style={{ padding:"4px 12px",borderRadius:20,border:`1.5px solid ${a?mt.color:T.border}`,background:a?mt.color+"10":"#fff",color:a?mt.color:T.sub,fontSize:11,fontWeight:a?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{mt.label}</button>; })}
          </div>
          <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
            {(form[`items_${tab}`]||[]).map((item,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"#fff",borderRadius:6,border:`1px solid ${T.border}` }}>
                <span style={{ fontSize:12, color:T.sub, flex:1 }}>{item}</span>
                <button onClick={()=>removeItem(tab,i)} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={form[`_new_${tab}`]||""} onChange={e=>upd(`_new_${tab}`,e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem(tab)} style={{...inp({flex:1,fontSize:12,padding:"7px 10px"})}} placeholder="Añadir punto de revisión..."/>
            <Btn ch="+" onClick={()=>addItem(tab)} v="p" sm/>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          {isEdit?<Btn ch="Eliminar" onClick={del} v="d" sm/>:<div/>}
          <div style={{ display:"flex", gap:8 }}><Btn ch="Cancelar" onClick={onClose} v="g"/><Btn ch={isEdit?"Guardar cambios":"Crear instalación"} onClick={save} disabled={!form.nombre.trim()}/></div>
        </div>
      </div>
    </Modal>
  );
}

function RevisionModal({ inst, cliente, tipo, data, setData, user, company, onClose }) {
  const isMobile = useIsMobile();
  const mt=MT[tipo]||{label:tipo,color:T.teal,freq:30};
  const items=(inst?.[`items_${tipo}`])||[];
  const [checks,setChecks]=useState(()=>{ const c={}; items.forEach((_,i)=>{c[i]=false;}); return c; });
  const [obs,setObs]=useState("");
  const [firma,setFirma]=useState(null);
  const [saving,setSaving]=useState(false);
  const done=Object.values(checks).filter(Boolean).length;
  const pct=items.length?Math.round(done/items.length*100):0;
  const allOn=done===items.length&&items.length>0;
  function toggleCheck(i){ setChecks(p=>({...p,[i]:!p[i]})); }
  function checkAll(){ const v=!allOn; const c={}; items.forEach((_,i)=>{c[i]=v;}); setChecks(c); }
  async function save(){
    setSaving(true);
    const partNum=String(((data.partCounter)||0)+1).padStart(5,"0");
    const rev={ id:"r"+Date.now(), instalacionId:inst.id, instalacionNombre:inst.nombre, clienteId:cliente.id, clienteNombre:cliente.nombre||cliente.name, tecnicoId:user.id, tecnicoNombre:user.name, tipo, fecha:todayStr(), checks, obs, firma, partNum, createdAt:new Date().toISOString() };
    setData(d=>({ ...d, revisiones:[...(d.revisiones||[]),rev], partCounter:((d.partCounter)||0)+1,
      instalaciones:(d.instalaciones||[]).map(x=>x.id===inst.id?{...x,[`proxima_${tipo}`]:addDays(todayStr(),mt.freq)}:x),
    }));
    pushNotif("Revisión "+mt.label+" completada", inst.nombre+" · "+(cliente.nombre||cliente.name));
    try{ const doc=await buildRevPDF(rev,inst,cliente,company||{}); window.open(doc.output("bloburl"),"_blank"); }catch(e){ console.error(e); }
    setSaving(false);
    onClose();
  }
  return (
    <Modal onClose={onClose} w={620} zIndex={300}>
      <MHead title={`Revisión ${mt.label}`} sub={`${inst.nombre} · ${cliente.nombre||cliente.name}`} onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px 20px":"18px 22px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        {/* Progress */}
        <div style={{ background:T.surface, borderRadius:10, padding:"12px 14px", border:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{done} / {items.length} verificados</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:mt.color }}>{pct}%</span>
              <button onClick={checkAll} style={{ padding:"3px 10px",borderRadius:6,border:`1.5px solid ${T.border}`,background:"#fff",color:T.sub,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{allOn?"Desmarcar todo":"Marcar todo"}</button>
            </div>
          </div>
          <div style={{ height:6, background:T.border, borderRadius:4 }}><div style={{ height:"100%", width:`${pct}%`, background:mt.color, borderRadius:4, transition:"width 0.3s" }}/></div>
        </div>
        {/* Checklist */}
        <div style={{ maxHeight:"40vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
          {items.map((item,i)=>(
            <div key={i} onClick={()=>toggleCheck(i)}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,cursor:"pointer",background:checks[i]?mt.color+"08":T.surface,border:`1px solid ${checks[i]?mt.color+"40":T.border}`,transition:"all 0.15s" }}>
              <div style={{ width:20,height:20,borderRadius:5,flexShrink:0,border:`2px solid ${checks[i]?mt.color:T.border}`,background:checks[i]?mt.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>
                {checks[i]&&<svg width="11" height="11" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
              </div>
              <span style={{ fontSize:13, color:checks[i]?T.text:T.sub, flex:1, lineHeight:1.4 }}>{item}</span>
            </div>
          ))}
        </div>
        <Field label="Observaciones"><textarea value={obs} onChange={e=>setObs(e.target.value)} style={{...inp(),minHeight:65,resize:"vertical"}} placeholder="Anomalías detectadas, recomendaciones..."/></Field>
        <SigPad value={firma} onChange={setFirma}/>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Guardando...":"Completar y ver PDF"} onClick={save} disabled={saving}/>
        </div>
      </div>
    </Modal>
  );
}

function MantenimientoView({ data, setData, user, company }) {
  const isMobile=useIsMobile();
  const [tab,setTab]=useState("pendientes");
  const [showInst,setShowInst]=useState(null);
  const [showRev,setShowRev]=useState(null);
  const [expanded,setExpanded]=useState(null);
  const isAdmin=user.role==="admin";
  const insts=data.instalaciones||[];
  const revs=data.revisiones||[];
  const clients=data.clients||[];
  const client=id=>clients.find(c=>c.id===id);

  const pendientes=[];
  insts.forEach(inst=>{ const cl=client(inst.clientId); MT_TIPOS.forEach(tipo=>{ if(!inst[`activa_${tipo}`])return; const info=urgInfo(inst[`proxima_${tipo}`]||null); if(info.level==="ok"&&info.days>30)return; pendientes.push({inst,cl,tipo,info}); }); });
  pendientes.sort((a,b)=>{ const o={urgente:0,hoy:1,semana:2,prox:3,ok:4,none:5}; const oa=o[a.info.level]??5,ob=o[b.info.level]??5; if(oa!==ob)return oa-ob; return(a.info.days??999)-(b.info.days??999); });
  const urg={urgente:0,hoy:0,semana:0,prox:0}; pendientes.forEach(p=>{ if(urg[p.info.level]!==undefined)urg[p.info.level]++; });

  function TabBtn({id,label,n}){ return (
    <button onClick={()=>setTab(id)} style={{ padding:"9px 16px",border:"none",background:"none",color:tab===id?T.accent:T.sub,fontSize:12,fontWeight:tab===id?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",borderBottom:tab===id?`2px solid ${T.accent}`:"2px solid transparent",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap" }}>
      {label}{n>0&&<span style={{ background:tab===id?T.accent:"#e2e8f0",color:tab===id?"#fff":T.muted,borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700 }}>{n}</span>}
    </button>
  ); }

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:"0 0 3px", fontFamily:"'Sora',sans-serif" }}>Mantenimiento</h1>
          <p style={{ color:T.muted, fontSize:12, margin:0 }}>Contratos periódicos · Revisiones y checklists</p>
        </div>
        {isAdmin && <Btn ch="+ Instalación" onClick={()=>setShowInst({clientId:clients[0]?.id})}/>}
      </div>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10, marginBottom:20 }}>
        {[{label:"Vencidas",val:urg.urgente,color:T.red},{label:"Esta semana",val:urg.hoy+urg.semana,color:T.orange},{label:"Este mes",val:urg.prox,color:T.teal},{label:"Instalaciones",val:insts.length,color:T.accent}].map(s=>(
          <div key={s.label} style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",position:"relative",overflow:"hidden" }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:s.color,borderRadius:"12px 12px 0 0" }}/>
            <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:28,fontWeight:700,color:s.color,fontFamily:"'Sora',sans-serif" }}>{s.val}</div>
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${T.border}`,marginBottom:18,display:"flex",overflowX:"auto" }}>
        <TabBtn id="pendientes" label="Pendientes" n={pendientes.length}/>
        <TabBtn id="contratos"  label="Contratos"  n={insts.length}/>
        <TabBtn id="historial"  label="Historial"  n={revs.length}/>
      </div>

      {/* PENDIENTES */}
      {tab==="pendientes" && (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {pendientes.length===0 && (
            <div style={{ textAlign:"center",padding:"60px 20px",background:"#fff",borderRadius:12,border:`1px solid ${T.border}` }}>
              <div style={{ width:56,height:56,borderRadius:14,background:T.greenLight,border:"1px solid #bbf7d0",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24,fontWeight:800,color:T.green }}>✓</div>
              <div style={{ fontSize:15,fontWeight:600,color:T.text,marginBottom:6 }}>Todo al día</div>
              <div style={{ fontSize:13,color:T.muted }}>Sin revisiones pendientes en los próximos 30 días.</div>
            </div>
          )}
          {pendientes.map((p,i)=>{ const mt=MT[p.tipo]; const uc=UCOL[p.info.level]; return (
            <div key={i} style={{ background:"#fff",border:`1px solid ${T.border}`,borderLeft:`4px solid ${uc}`,borderRadius:11,padding:"13px 15px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",display:"flex",alignItems:"center",gap:14 }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:4 }}>{p.inst.nombre}</div>
                <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  <span style={{ fontSize:11,color:T.muted }}>{p.cl?.name||"—"}</span>
                  <span style={{ fontSize:10,color:T.border }}>·</span>
                  <span style={{ fontSize:11,padding:"1px 8px",borderRadius:20,background:mt.color+"12",border:`1px solid ${mt.color}25`,color:mt.color,fontWeight:600 }}>{mt.label}</span>
                  <span style={{ fontSize:10,color:T.border }}>·</span>
                  <span style={{ fontSize:11,fontWeight:600,color:uc }}>{p.info.label}</span>
                </div>
              </div>
              <Btn ch="Iniciar revisión" onClick={()=>setShowRev({inst:p.inst,cliente:p.cl,tipo:p.tipo})} v="p" sm/>
            </div>
          ); })}
        </div>
      )}

      {/* CONTRATOS */}
      {tab==="contratos" && (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {isAdmin && <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:4 }}><Btn ch="+ Añadir instalación" onClick={()=>setShowInst({clientId:clients[0]?.id})} v="p" sm/></div>}
          {clients.map(cl=>{ const clInsts=insts.filter(i=>i.clientId===cl.id); const exp=expanded===cl.id; return (
            <div key={cl.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:11,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <div onClick={()=>setExpanded(exp?null:cl.id)} style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",cursor:"pointer",transition:"background 0.1s" }}
                onMouseEnter={e=>e.currentTarget.style.background=T.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:600,color:T.text }}>{cl.name}</div>
                  <div style={{ fontSize:12,color:T.muted,marginTop:2 }}>{clInsts.length} instalación{clInsts.length!==1?"es":""} · {MT_TIPOS.filter(t=>clInsts.some(i=>i[`activa_${t}`])).map(t=>MT[t].label).join(", ")||"Sin contratos activos"}</div>
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  {isAdmin && <Btn ch="+ Instalación" onClick={e=>{e.stopPropagation();setShowInst({clientId:cl.id});}} v="g" sm/>}
                  <span style={{ color:T.muted,fontSize:18,display:"inline-block",transform:exp?"rotate(90deg)":"none",transition:"transform 0.2s" }}>›</span>
                </div>
              </div>
              {exp && (
                <div style={{ borderTop:`1px solid ${T.border}` }}>
                  {clInsts.length===0 ? (
                    <div style={{ padding:"12px 16px",color:T.muted,fontSize:12 }}>Sin instalaciones.{isAdmin&&<button onClick={()=>setShowInst({clientId:cl.id})} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,marginLeft:6 }}>Añadir →</button>}</div>
                  ) : clInsts.map(inst=>(
                    <div key={inst.id} style={{ padding:"12px 16px 12px 28px",borderBottom:`1px solid ${T.surface}`,display:"flex",alignItems:"flex-start",gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:T.text,marginBottom:6 }}>{inst.nombre}<span style={{ fontSize:11,color:T.muted,fontWeight:400,marginLeft:8 }}>{inst.tipo} · {inst.ubicacion}</span></div>
                        <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
                          {MT_TIPOS.map(tipo=>{ if(!inst[`activa_${tipo}`])return null; const mt=MT[tipo]; const info=urgInfo(inst[`proxima_${tipo}`]||null); return (
                            <div key={tipo} style={{ display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:mt.color+"10",border:`1px solid ${mt.color}25` }}>
                              <span style={{ fontSize:11,fontWeight:600,color:mt.color }}>{mt.label}</span>
                              <span style={{ fontSize:10,color:UCOL[info.level] }}>{info.label}</span>
                              <button onClick={()=>setShowRev({inst,cliente:cl,tipo})} style={{ background:mt.color,border:"none",borderRadius:4,color:"#fff",fontSize:9,padding:"1px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>Iniciar</button>
                            </div>
                          ); })}
                        </div>
                      </div>
                      {isAdmin && <Btn ch="Editar" onClick={()=>setShowInst({clientId:cl.id,inst})} v="g" sm/>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ); })}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==="historial" && (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {revs.length===0 && <div style={{ textAlign:"center",padding:"60px",color:T.muted,fontSize:13 }}>Sin revisiones completadas todavía.</div>}
          {[...revs].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(rev=>{ const mt=MT[rev.tipo]||{label:rev.tipo,color:T.muted}; const total=Object.keys(rev.checks||{}).length; const done=Object.values(rev.checks||{}).filter(Boolean).length; const inst=insts.find(i=>i.id===rev.instalacionId); const cl=clients.find(c=>c.id===rev.clienteId); return (
            <div key={rev.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:11,padding:"13px 15px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",display:"flex",alignItems:"center",gap:14 }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                  <span style={{ fontSize:13,fontWeight:600,color:T.text }}>{rev.instalacionNombre}</span>
                  <span style={{ fontSize:9,padding:"1px 8px",borderRadius:20,background:mt.color+"12",border:`1px solid ${mt.color}25`,color:mt.color,fontWeight:700 }}>{mt.label}</span>
                  <span style={{ fontSize:10,color:T.muted }}>Parte #{rev.partNum}</span>
                </div>
                <div style={{ fontSize:12,color:T.muted }}>{rev.clienteNombre} · {rev.fecha} · {rev.tecnicoNombre} · {done}/{total} ítems</div>
                {rev.obs && <div style={{ fontSize:11,color:T.sub,marginTop:3,fontStyle:"italic" }}>"{rev.obs.slice(0,80)}{rev.obs.length>80?"...":""}"</div>}
              </div>
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                {rev.firma && <span style={{ fontSize:11,color:T.green,fontWeight:600 }}>Firmado</span>}
                <Btn ch="PDF" onClick={async()=>{ try{ const doc=await buildRevPDF(rev,inst,cl,company||{}); window.open(doc.output("bloburl"),"_blank"); }catch(e){alert("Error al generar PDF");} }} v="b" sm/>
              </div>
            </div>
          ); })}
        </div>
      )}

      {showInst && <InstModal clientId={showInst.clientId} inst={showInst.inst} data={data} setData={setData} onClose={()=>setShowInst(null)}/>}
      {showRev  && <RevisionModal inst={showRev.inst} cliente={showRev.cliente} tipo={showRev.tipo} data={data} setData={setData} user={user} company={company} onClose={()=>setShowRev(null)}/>}
    </div>
  );
}

/* ─── EMPRESA CONFIG ─────────────────────────────────────────────────────── */
function EmpresaConfig({ company, setCompany }) {
  const isMobile=useIsMobile();
  const [form,setForm]=useState({...company});
  const [saved,setSaved]=useState(false);
  const logoRef=useRef();
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  function handleLogo(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>upd("logo",ev.target.result); r.readAsDataURL(f); }
  function save(){ setCompany({...form}); setSaved(true); setTimeout(()=>setSaved(false),2500); }

  return (
    <div style={{ padding:isMobile?12:28, maxWidth:720 }}>
      <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, color:T.text, margin:"0 0 6px", fontFamily:"'Sora',sans-serif" }}>Mi empresa</h1>
      <p style={{ color:T.muted, fontSize:13, margin:"0 0 24px" }}>Estos datos aparecerán en todos los partes de trabajo enviados al cliente.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Logo */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:14 }}>Logo de la empresa</div>
          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
            <div style={{ width:80,height:80,borderRadius:12,border:`2px dashed ${T.border}`,background:T.surface,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0 }}>
              {form.logo ? <img src={form.logo} alt="logo" style={{ width:"100%",height:"100%",objectFit:"contain" }}/> : <span style={{ fontSize:28, color:T.muted }}>TG</span>}
            </div>
            <div>
              <p style={{ color:T.sub, fontSize:13, margin:"0 0 10px", lineHeight:1.5 }}>El logo aparece en la cabecera del parte PDF.</p>
              <div style={{ display:"flex", gap:8 }}>
                <Btn ch="Subir logo" onClick={()=>logoRef.current.click()} v="g" sm/>
                {form.logo && <Btn ch="Eliminar" onClick={()=>upd("logo",null)} v="d" sm/>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogo}/>
            </div>
          </div>
        </div>
        {/* Datos */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:14 }}>Datos de la empresa</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Field label="Nombre / Razón social"><input value={form.nombre||""} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="ThermoGest Climatización SL"/></Field>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              <Field label="CIF / NIF"><input value={form.cif||""} onChange={e=>upd("cif",e.target.value)} style={inp()} placeholder="B12345678"/></Field>
              <Field label="Teléfono"><input value={form.telefono||""} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="968 000 000"/></Field>
              <Field label="Email"><input type="email" value={form.email||""} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="info@empresa.com"/></Field>
              <Field label="Página web"><input value={form.web||""} onChange={e=>upd("web",e.target.value)} style={inp()} placeholder="www.empresa.com"/></Field>
            </div>
            <Field label="Dirección fiscal"><input value={form.direccion||""} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Calle Ejemplo 1, 30800 Lorca, Murcia"/></Field>
          </div>
        </div>
        {/* Cuenta */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:14 }}>Datos bancarios</div>
          <Field label="Número de cuenta IBAN"><input value={form.cuenta||""} onChange={e=>upd("cuenta",e.target.value)} style={inp()} placeholder="ES00 0000 0000 0000 0000 0000"/></Field>
          <div style={{ marginTop:10, padding:"10px 14px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, fontSize:12, color:"#92400e" }}>El número de cuenta aparece en el pie de cada parte de trabajo enviado al cliente.</div>
        </div>
        {/* Vista previa */}
        <div style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:12, padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:14 }}>Vista previa del encabezado PDF</div>
          <div style={{ background:T.accent, borderRadius:10, padding:"14px 18px", color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div>
              {form.logo && <img src={form.logo} alt="" style={{ height:30, marginBottom:6, display:"block", filter:"brightness(0) invert(1)", opacity:0.9 }}/>}
              <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{form.nombre||"Nombre de empresa"}</div>
              <div style={{ fontSize:11, opacity:0.75 }}>{form.direccion||"Dirección"}</div>
              <div style={{ fontSize:11, opacity:0.75 }}>Tel: {form.telefono||"—"} · {form.email||"—"}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:3 }}>PARTE DE TRABAJO</div>
              {form.cif && <div style={{ fontSize:11, opacity:0.75 }}>CIF: {form.cif}</div>}
              <div style={{ fontSize:11, opacity:0.75 }}>Ref: #1001 · {new Date().toLocaleDateString("es-ES")}</div>
            </div>
          </div>
          {form.cuenta && (
            <div style={{ background:"#0f172a", borderRadius:10, padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>Datos bancarios</div><div style={{ fontSize:12, color:"#e2e8f0" }}>{form.cuenta}</div></div>
              <div style={{ textAlign:"right" }}><div style={{ fontSize:11, color:"#64748b" }}>{form.nombre||""}</div><div style={{ fontSize:10, color:"#475569" }}>{form.telefono||""}</div></div>
            </div>
          )}
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:14 }}>
          {saved && <span style={{ fontSize:13, color:T.green, fontWeight:600 }}>Datos guardados correctamente</span>}
          <Btn ch="Guardar cambios" onClick={save}/>
        </div>
      </div>
    </div>
  );
}

/* ─── SUPABASE HELPERS ───────────────────────────────────────────────────── */
async function fetchAll(table, opts={}) {
  let q = supabase.from(table).select('*')
  if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false })
  if (opts.eq) Object.entries(opts.eq).forEach(([k,v]) => { q = q.eq(k,v) })
  const { data, error } = await q
  if (error) { console.error('fetchAll', table, error.message); return [] }
  return data || []
}

/* ─── LOGIN ──────────────────────────────────────────────────────────────── */
function Login({ onLogin }) {
  const isMobile = useIsMobile()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!profile || !profile.activo) {
      await supabase.auth.signOut()
      setError('Usuario inactivo. Contacta con el administrador.')
      setLoading(false); return
    }
    onLogin(profile)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f1f5f9', display:'flex', flexDirection:isMobile?'column':'row', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Left */}
      <div style={{ width:isMobile?'100%':'42%', background:'linear-gradient(160deg,#1e3a8a,#1d4ed8 60%,#2563eb)', display:'flex', flexDirection:'column', justifyContent:'center', padding:isMobile?'32px 24px':'60px 48px', minHeight:isMobile?'auto':'100vh', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',width:400,height:400,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.08)',top:-120,right:-80 }}/>
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:isMobile?20:40 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#fff',border:'1px solid rgba(255,255,255,0.2)' }}>TG</div>
            <div>
              <div style={{ fontSize:17,fontWeight:700,color:'#fff',fontFamily:"'Sora',sans-serif" }}>ThermoGest</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em',textTransform:'uppercase' }}>Gestión Técnica</div>
            </div>
          </div>
          {!isMobile && <>
            <h1 style={{ fontSize:30,fontWeight:800,color:'#fff',lineHeight:1.2,marginBottom:14,fontFamily:"'Sora',sans-serif" }}>Calefacción &<br/>Climatización</h1>
            <p style={{ color:'rgba(255,255,255,0.65)',fontSize:14,lineHeight:1.7,marginBottom:32,maxWidth:280 }}>Plataforma de gestión de averías, presupuestos, instalaciones y mantenimiento.</p>
            {['Gestión de averías en tiempo real','Presupuestos y partes de trabajo','Contratos de mantenimiento periódico'].map(tx=>(
              <div key={tx} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                <div style={{ width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.5)',flexShrink:0 }}/>
                <span style={{ color:'rgba(255,255,255,0.75)',fontSize:13 }}>{tx}</span>
              </div>
            ))}
          </>}
        </div>
      </div>
      {/* Right */}
      <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:isMobile?'28px 20px 40px':'40px 48px' }}>
        <div style={{ width:'100%',maxWidth:380 }}>
          <h2 style={{ fontSize:22,fontWeight:700,color:T.text,marginBottom:6,fontFamily:"'Sora',sans-serif" }}>Acceder</h2>
          <p style={{ color:T.muted,fontSize:14,marginBottom:28 }}>Introduce tus credenciales para continuar</p>
          <form onSubmit={handleLogin} style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <Field label="Email">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp()} placeholder="correo@empresa.com" autoComplete="email"/>
            </Field>
            <Field label="Contraseña">
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={inp()} placeholder="••••••••" autoComplete="current-password"/>
            </Field>
            {error && <div style={{ padding:'10px 14px',background:T.redLight,border:'1px solid #fecaca',borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
            <button type="submit" disabled={loading||!email.trim()||!password.trim()}
              style={{ width:'100%',padding:'12px',borderRadius:10,border:'none',background:T.accent,color:'#fff',fontSize:15,fontWeight:600,cursor:loading?'wait':'pointer',fontFamily:"'DM Sans',sans-serif",boxShadow:'0 2px 8px rgba(29,78,216,0.3)',opacity:loading?0.7:1,marginTop:4 }}>
              {loading ? 'Accediendo...' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── APP ROOT ───────────────────────────────────────────────────────────── */
export default function App() {
  const isMobile = useIsMobile()
  const [user,     setUser]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [data,     setData]     = useState({ clientes:[], averias:[], presupuestos:[], eventos:[], instalaciones:[], revisiones:[] })
  const [empresa,  setEmpresa]  = useState(COMPANY0)
  const [techs,    setTechs]    = useState([])
  const [view,     setView]     = useState('dashboard')
  const [selected, setSelected] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(()=>window.innerWidth>=768)
  const [notifCount,  setNotifCount]  = useState(0)

  // Check existing session on mount
  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if (session) {
        const {data:profile} = await supabase.from('profiles').select('*').eq('id',session.user.id).single()
        if (profile && profile.activo) { setUser(profile); await loadAll() }
        else await supabase.auth.signOut()
      }
      setLoading(false)
    })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event)=>{
      if (event==='SIGNED_OUT') { setUser(null); setData({clientes:[],averias:[],presupuestos:[],eventos:[],instalaciones:[],revisiones:[]}) }
    })
    return ()=>subscription.unsubscribe()
  },[])

  // Real-time subscriptions — keep all users in sync
  useEffect(()=>{
    if (!user) return
    const ch = supabase.channel('realtime-thermogest')
      .on('postgres_changes',{event:'*',schema:'public',table:'averias'},     ()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'presupuestos'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'clientes'},    ()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'eventos'},     ()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'instalaciones'},()=>loadAll())
      .on('postgres_changes',{event:'*',schema:'public',table:'revisiones'},  ()=>loadAll())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'solicitudes_clientes'},p=>{
        setNotifCount(n=>n+1)
        try{ if(Notification.permission==='granted') new Notification('Nueva solicitud de cliente',{body:p.new?.nombre||'',tag:'tg'}); }catch(e){}
      })
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[user])

  async function loadAll() {
    const [cls,avs,pres,evs,ins,revs,emp,profs] = await Promise.all([
      fetchAll('clientes',   {order:'nombre',    asc:true}),
      fetchAll('averias',    {order:'created_at', asc:false}),
      fetchAll('presupuestos',{order:'created_at',asc:false}),
      fetchAll('eventos',    {order:'fecha',     asc:true}),
      fetchAll('instalaciones',{order:'nombre',  asc:true}),
      fetchAll('revisiones', {order:'created_at',asc:false}),
      supabase.from('empresa').select('*').eq('id',1).single(),
      supabase.from('profiles').select('*').eq('activo',true),
    ])
    setData({clientes:cls, averias:avs, presupuestos:pres, eventos:evs, instalaciones:ins, revisiones:revs})
    if (emp.data) setEmpresa(emp.data)
    if (profs.data) setTechs(profs.data)
  }

  const refresh = loadAll

  async function handleLogin(profile) {
    setUser(profile)
    setView(profile.role==='admin' ? 'dashboard' : 'averias')
    await loadAll()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setSelected(null); setView('dashboard')
  }

  // Loading screen
  if (loading) return (
    <div style={{ minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700&family=DM+Sans:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{ width:36,height:36,borderRadius:10,background:T.accent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#fff' }}>TG</div>
      <span style={{ color:T.muted,fontSize:14 }}>Cargando...</span>
    </div>
  )

  // Login
  if (!user) return <Login onLogin={handleLogin}/>

  const isAdmin = user.role==='admin'

  return (
    <div style={{ display:'flex',minHeight:'100vh',background:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        h1,h2,h3{font-family:'Sora',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px;}
        input,textarea,select{font-size:16px;}
        html{-webkit-text-size-adjust:100%;}
      `}</style>

      <Sidebar user={user} view={view} setView={setView} onLogout={handleLogout}
        notifCount={notifCount} data={data} open={sidebarOpen} onToggle={()=>setSidebarOpen(o=>!o)}/>

      <div style={{ flex:1,overflowY:'auto',minHeight:'100vh',background:T.bg,paddingTop:isMobile?52:0 }}>
        {!sidebarOpen && !isMobile && (
          <button onClick={()=>setSidebarOpen(true)} style={{ position:'fixed',top:16,left:16,zIndex:100,width:36,height:36,borderRadius:9,background:'#fff',border:`1px solid ${T.border}`,boxShadow:'0 2px 8px rgba(0,0,0,0.10)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:T.text }}>≡</button>
        )}
        <ErrorBoundary>
          {view==='dashboard'     && isAdmin && <Dashboard     data={data} setView={setView}/>}
          {view==='calendario'    && <CalendarView  data={data} user={user} refresh={refresh}/>}
          {view==='averias'       && <AveriasList   data={data} user={user} onSelectBreakdown={setSelected} techs={techs} refresh={refresh}/>}
          {view==='presupuestos'  && <PresupuestosList data={data} user={user} onSelect={setSelected} refresh={refresh}/>}
          {view==='clientes'      && isAdmin && <ClientesList  data={data} refresh={refresh}/>}
          {view==='mantenimiento' && <MantenimientoView data={data} user={user} refresh={refresh}/>}
          {view==='empresa'       && isAdmin && <EmpresaConfig company={empresa} setCompany={setEmpresa}/>}
        </ErrorBoundary>
      </div>

      {selected && (
        <AveriaDetail breakdown={selected} data={data} user={user} company={empresa} techs={techs}
          onClose={()=>setSelected(null)} refresh={refresh}/>
      )}
    </div>
  )
}
