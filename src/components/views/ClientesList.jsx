import React, { useState } from "react";
import { useTheme }       from "../../ThemeContext.jsx";
import { mkInp }          from "../../utils/styles.js";
import { useIsMobile }    from "../../hooks/useIsMobile.js";
import { openMaps }       from "../../utils/links.js";
import { supabase }       from "../../supabase.js";
import Btn                from "../ui/Btn.jsx";
import Ava                from "../ui/Ava.jsx";
import Modal              from "../ui/Modal.jsx";
import MHead              from "../ui/MHead.jsx";
import Field              from "../ui/Field.jsx";
import ImportarExcelModal from "../shared/ImportarExcelModal.jsx";
import ClienteDetalle     from "../shared/ClienteDetalle.jsx";
import AveriaDetalle      from "../shared/AveriaDetalle.jsx";
import PresupuestoDetalle from "../shared/PresupuestoDetalle.jsx";

export default function ClientesList({ data, refresh, user, onTooltip }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile=useIsMobile(); const [showNew,setShowNew]=useState(false); const [showImport,setShowImport]=useState(false); const [clienteSel,setClienteSel]=useState(null); const [form,setForm]=useState({nombre:"",telefono:"",email:"",direccion:""}); const [selAveriaGlobal,setSelAveriaGlobal]=useState(null); const [selPresuGlobal,setSelPresuGlobal]=useState(null); const [search,setSearch]=useState("");
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
          <button onClick={()=>onTooltip?.("clientes")} title="Ayuda de Clientes" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
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
