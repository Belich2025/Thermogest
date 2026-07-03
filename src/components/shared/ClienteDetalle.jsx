import React, { useState } from "react";
import { useTheme }        from "../../ThemeContext.jsx";
import { mkInp }           from "../../utils/styles.js";
import { supabase }        from "../../supabase.js";
import { useIsMobile }     from "../../hooks/useIsMobile.js";
import Modal               from "../ui/Modal.jsx";
import NuevoEquipoModal    from "./NuevoEquipoModal.jsx";
import EquipoDetalle       from "./EquipoDetalle.jsx";

export default function ClienteDetalle({ cliente, data, refresh, onClose, onSelectAveria, onSelectPresu, onSelectMant, onSelectInst }) {
  const { T, BS, MS, PS } = useTheme();
  const inp = mkInp(T);
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
