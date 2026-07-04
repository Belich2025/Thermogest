import React, { useState } from "react";
import { useTheme }             from "../../ThemeContext.jsx";
import { useIsMobile }          from "../../hooks/useIsMobile.js";
import { supabase }             from "../../supabase.js";
import { todayStr, addDays, urgInfo } from "../../utils/dates.js";
import { MT, MT_TIPOS }         from "../../constants/status.js";
import { TIPO_EQUIPO_OPTIONS }  from "../../constants/equipment.js";
import Btn                      from "../ui/Btn.jsx";
import InstModal                from "../shared/InstModal.jsx";
import RevisionModal            from "../shared/RevisionModal.jsx";
import RevisionDetalle          from "../shared/RevisionDetalle.jsx";
import NuevoEquipoModal         from "../shared/NuevoEquipoModal.jsx";

export default function MantenimientoView({ data, user, refresh, empresa={}, onTooltip }) {
  const { T, UCOL } = useTheme();
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
        <button onClick={()=>onTooltip?.("contratos")} title="Ayuda de Contratos" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
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
