import React from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { MT, MT_TIPOS } from "../../constants/status.js";
import { todayStr, addDays, urgInfo } from "../../utils/dates.js";

export default function DashboardView({ data, setView, techs }) {
  const { T, BS, PS, UCOL } = useTheme();
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
