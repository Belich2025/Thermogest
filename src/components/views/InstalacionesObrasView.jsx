import { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { openMaps } from "../../utils/links.js";
import Btn from "../ui/Btn.jsx";
import BadgeProg from "../ui/BadgeProg.jsx";
import ObraDetalle from "../shared/ObraDetalle.jsx";
import NuevaObraModal from "../shared/NuevaObraModal.jsx";

export default function InstalacionesObrasView({ data, user, techs, refresh, empresa, onTooltip }) {
  const { T, OB_ESTADOS } = useTheme();
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
        <button onClick={()=>onTooltip("instalaciones_obras")} title="Ayuda de Instalaciones" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
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
