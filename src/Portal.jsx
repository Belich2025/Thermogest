import React, { useState, useEffect } from "react";

const SUPABASE_URL = "https://sqwbxmewymvmnegszzte.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd2J4bWV3eW12bW5lZ3N6enRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODMzNzcsImV4cCI6MjA5Mzg1OTM3N30.z_vGOPEqZXTQp9hWaiAjU-7Q1s8vACwfseB4UWIrfgM";
const PORTAL_DATA_URL = `${SUPABASE_URL}/functions/v1/portal-data`;

const T = {
  accent:"#1d4ed8", accentLight:"#eff6ff",
  green:"#16a34a", greenLight:"#f0fdf4",
  orange:"#d97706", orangeLight:"#fffbeb",
  red:"#dc2626", redLight:"#fef2f2",
  teal:"#0d9488", tealLight:"#f0fdfa",
  purple:"#7c3aed", purpleLight:"#f5f3ff",
  border:"#e2e8f0", text:"#0f172a", sub:"#475569", muted:"#94a3b8",
  surface:"#f8fafc",
};

const BS = {
  nueva:{label:"Nueva",color:"#7c3aed"},
  en_reparacion:{label:"En reparación",color:"#d97706"},
  pendiente_piezas:{label:"Pend. piezas",color:"#dc2626"},
  presupuesto_enviado:{label:"Presupuesto enviado",color:"#0284c7"},
  cerrada:{label:"Cerrada",color:"#16a34a"},
  pendiente_facturar:{label:"Pend. facturar",color:"#f59e0b"},
  facturado:{label:"Facturado",color:"#64748b"},
};

const PS = {
  nuevo:{label:"Nuevo",color:"#7c3aed"},
  enviado:{label:"Enviado",color:"#d97706"},
  aceptado:{label:"Aceptado",color:"#16a34a"},
  rechazado:{label:"Rechazado",color:"#dc2626"},
  facturado:{label:"Facturado",color:"#0284c7"},
};

const MT = {
  mensual:{label:"Mensual",color:"#0d9488"},
  trimestral:{label:"Trimestral",color:"#d97706"},
  semestral:{label:"Semestral",color:"#7c3aed"},
  anual:{label:"Anual",color:"#dc2626"},
};

const inp = (x={}) => ({
  width:"100%", boxSizing:"border-box", background:"#fff",
  border:"1.5px solid #e2e8f0", borderRadius:10, padding:"11px 14px",
  color:"#0f172a", fontSize:15, outline:"none", fontFamily:"'DM Sans',sans-serif", ...x,
});

export default function Portal() {
  const token = window.location.pathname.split("/cliente/")[1];
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [data, setData] = useState({ averias:[], presupuestos:[], instalaciones:[], equipos:[], revisiones:[], partes:[] });
  const [tab, setTab] = useState("averias");
  const [showAviso, setShowAviso] = useState(false);
  const [aviso, setAviso] = useState({ tipo:"averia", descripcion:"", lopd:false });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(()=>{ if(token) load(); },[token]);

  async function load() {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const res = await fetch(PORTAL_DATA_URL, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
          apikey:SUPABASE_ANON_KEY,
        },
        body:JSON.stringify({ token }),
      });
      if(res.status===404){ setNotFound(true); setLoading(false); return; }
      if(!res.ok){ setLoadError(true); setLoading(false); return; }
      const json = await res.json();
      setCliente(json.cliente);
      setData({ averias:json.averias||[], presupuestos:json.presupuestos||[], instalaciones:json.instalaciones||[], equipos:json.equipos||[], revisiones:json.revisiones||[], partes:json.partes||[] });
    } catch(e) {
      setLoadError(true);
    }
    setLoading(false);
  }

  async function enviarAviso(e) {
    e.preventDefault();
    if(!aviso.descripcion.trim()||!aviso.lopd) return;
    setEnviando(true);
    const res = await fetch("/api/contacto", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        nombre:cliente.nombre, email:cliente.email, telefono:cliente.telefono,
        direccion:cliente.direccion, tipo:aviso.tipo, descripcion:aviso.descripcion,
      }),
    });
    if(res.ok){ setEnviado(true); setShowAviso(false); setAviso({tipo:"averia",descripcion:"",lopd:false}); }
    else alert("Error al enviar. Llámanos directamente.");
    setEnviando(false);
  }

  function urgInfo(prox) {
    if(!prox) return { label:"Sin programar", color:T.muted };
    const d=Math.round((new Date(prox+"T12:00:00")-new Date())/86400000);
    if(d<0)  return { label:`Vencida hace ${Math.abs(d)}d`, color:T.red };
    if(d===0) return { label:"Hoy", color:T.orange };
    if(d<=7)  return { label:`En ${d} días`, color:"#f59e0b" };
    if(d<=30) return { label:`En ${d} días`, color:T.teal };
    return { label:`En ${d} días`, color:T.muted };
  }

  if(loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40,height:40,border:"3px solid #bfdbfe",borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px" }}/>
        <p style={{ color:T.muted }}>Cargando tu portal...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if(notFound) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center", padding:32 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h1 style={{ color:T.text, fontFamily:"'Sora',sans-serif" }}>Enlace no válido</h1>
        <p style={{ color:T.muted }}>Este enlace no existe o ha caducado.</p>
      </div>
    </div>
  );

  if(loadError) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center", padding:32 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h1 style={{ color:T.text, fontFamily:"'Sora',sans-serif" }}>No se pudieron cargar los datos</h1>
        <p style={{ color:T.muted, marginBottom:16 }}>Comprueba tu conexión e inténtalo de nuevo.</p>
        <button onClick={load} style={{ background:T.accent, color:"#fff", border:"none", borderRadius:10, padding:"11px 24px", fontSize:15, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
          Reintentar
        </button>
      </div>
    </div>
  );

  if(!cliente) return null;

  const tabs = [
    { k:"averias",      l:`Averías (${data.averias.length})` },
    { k:"presupuestos", l:`Presupuestos (${data.presupuestos.length})` },
    { k:"contratos",    l:`Contratos (${data.instalaciones.length})` },
    { k:"equipos",      l:`Equipos (${data.equipos.length})` },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}`}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1e3a8a,#1d4ed8)", padding:"24px 20px" }}>
        <div style={{ maxWidth:720, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ width:36,height:36,borderRadius:9,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff" }}>BL</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#fff",fontFamily:"'Sora',sans-serif" }}>BLCH</div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Portal del cliente</div>
            </div>
          </div>
          <h1 style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:4,fontFamily:"'Sora',sans-serif" }}>Hola, {cliente.nombre.split(" ")[0]}</h1>
          <p style={{ fontSize:13,color:"rgba(255,255,255,0.7)" }}>Aquí puedes consultar el estado de tus servicios</p>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"20px 16px 40px" }}>

        {/* Botón comunicar avería */}
        {enviado ? (
          <div style={{ background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:18 }}>✓</span>
            <span style={{ fontSize:14,color:T.green,fontWeight:600 }}>Aviso enviado correctamente. Nos pondremos en contacto contigo pronto.</span>
          </div>
        ) : (
          <button onClick={()=>setShowAviso(!showAviso)}
            style={{ width:"100%",padding:"14px",borderRadius:12,border:"none",background:T.accent,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",marginBottom:16,fontFamily:"'DM Sans',sans-serif",boxShadow:"0 4px 12px rgba(29,78,216,0.3)" }}>
            🔔 Comunicar una avería o problema
          </button>
        )}

        {/* Formulario aviso */}
        {showAviso && (
          <div style={{ background:"#fff",borderRadius:14,padding:"20px",border:`1px solid ${T.border}`,marginBottom:16,boxShadow:"0 4px 16px rgba(0,0,0,0.08)" }}>
            <h3 style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:16,fontFamily:"'Sora',sans-serif" }}>Comunicar avería o problema</h3>
            <form onSubmit={enviarAviso} style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div>
                <label style={{ fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:8 }}>Tipo de solicitud</label>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {[{k:"averia",l:"🔧 Avería"},{k:"mantenimiento",l:"🔄 Mantenimiento"},{k:"presupuesto",l:"📋 Presupuesto"}].map(op=>(
                    <button type="button" key={op.k} onClick={()=>setAviso(p=>({...p,tipo:op.k}))}
                      style={{ padding:"8px 16px",borderRadius:9,border:`2px solid ${aviso.tipo===op.k?T.accent:T.border}`,background:aviso.tipo===op.k?T.accentLight:"#fff",color:aviso.tipo===op.k?T.accent:T.sub,fontSize:13,fontWeight:aviso.tipo===op.k?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12,fontWeight:600,color:T.sub,display:"block",marginBottom:6 }}>Describe el problema *</label>
                <textarea value={aviso.descripcion} onChange={e=>setAviso(p=>({...p,descripcion:e.target.value}))}
                  placeholder="Cuéntanos qué ocurre..." style={{...inp(),minHeight:90,resize:"vertical"}}/>
              </div>
              <label style={{ display:"flex",gap:10,cursor:"pointer",alignItems:"flex-start" }}>
                <div onClick={()=>setAviso(p=>({...p,lopd:!p.lopd}))}
                  style={{ width:20,height:20,borderRadius:5,border:`2px solid ${aviso.lopd?T.accent:T.border}`,background:aviso.lopd?T.accent:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,cursor:"pointer" }}>
                  {aviso.lopd&&<svg width="11" height="11" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                </div>
                <span style={{ fontSize:12,color:T.sub,lineHeight:1.6 }}>Acepto el tratamiento de mis datos para gestionar esta solicitud (RGPD). <span style={{ color:T.red }}>*</span></span>
              </label>
              <div style={{ display:"flex",gap:8 }}>
                <button type="button" onClick={()=>setShowAviso(false)} style={{ flex:1,padding:"11px",borderRadius:10,border:`1.5px solid ${T.border}`,background:"#fff",color:T.sub,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Cancelar</button>
                <button type="submit" disabled={enviando||!aviso.descripcion.trim()||!aviso.lopd} style={{ flex:2,padding:"11px",borderRadius:10,border:"none",background:enviando||!aviso.descripcion.trim()||!aviso.lopd?"#94a3b8":T.accent,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                  {enviando?"Enviando...":"Enviar aviso"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4 }}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              style={{ padding:"8px 16px",borderRadius:20,border:`1.5px solid ${tab===t.k?T.accent:T.border}`,background:tab===t.k?T.accentLight:"#fff",color:tab===t.k?T.accent:T.sub,fontSize:12,fontWeight:tab===t.k?600:400,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif" }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* AVERÍAS */}
        {tab==="averias" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {data.averias.length===0&&<div style={{ textAlign:"center",padding:"40px",color:T.muted,fontSize:14,background:"#fff",borderRadius:12,border:`1px solid ${T.border}` }}>Sin averías registradas</div>}
            {data.averias.map(b=>{ const s=BS[b.status]; const bPartes=data.partes.filter(p=>p.averia_id===b.id); return (
              <div key={b.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderLeft:`4px solid ${s?.color||T.muted}`,borderRadius:12,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:4,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{b.descripcion}</div>
                    <div style={{ fontSize:12,color:T.muted }}>{b.equipo!=="Por determinar"?b.equipo+" · ":""}{b.fecha_visita?.split("-").reverse().join("/")}</div>
                  </div>
                  <span style={{ padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:(s?.color||T.muted)+"15",color:s?.color||T.muted,whiteSpace:"nowrap" }}>{s?.label||b.status}</span>
                </div>
                {bPartes.length>0&&(
                  <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:6 }}>
                    <div style={{ fontSize:11,fontWeight:600,color:T.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em" }}>Partes de trabajo</div>
                    {bPartes.map(p=>{ const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0; return (
                      <div key={p.id} style={{ background:T.surface,borderRadius:8,padding:"10px 12px",marginBottom:6,border:`1px solid ${T.border}` }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                          <span style={{ fontSize:12,fontWeight:600,color:T.text }}>{p.tecnico_nombre}</span>
                          <span style={{ fontSize:14,fontWeight:700,color:T.accent }}>{(p.importe_total||0).toFixed(2)} €{p.aplicar_iva?" (IVA inc.)":""}</span>
                        </div>
                        <div style={{ fontSize:11,color:T.muted,marginBottom:p.trabajo?6:0 }}>{p.fecha?.split("-").reverse().join("/")} {h>0?`· ${h.toFixed(1)}h`:""}</div>
                        {p.trabajo&&<div style={{ fontSize:12,color:T.sub,lineHeight:1.5 }}>{p.trabajo}</div>}
                        {p.forma_pago&&<div style={{ fontSize:11,color:T.green,fontWeight:600,marginTop:4 }}>{{efectivo:"💵 Pagado en efectivo",tarjeta:"💳 Pagado con tarjeta",transferencia:"🏦 Pagado por transferencia"}[p.forma_pago]||""}</div>}
                        {p.firma_url&&<div style={{ fontSize:11,color:T.green,marginTop:4 }}>✓ Firmado</div>}
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            ); })}
          </div>
        )}

        {/* PRESUPUESTOS */}
        {tab==="presupuestos" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {data.presupuestos.length===0&&<div style={{ textAlign:"center",padding:"40px",color:T.muted,fontSize:14,background:"#fff",borderRadius:12,border:`1px solid ${T.border}` }}>Sin presupuestos</div>}
            {data.presupuestos.map(p=>{ const s=PS[p.status]; return (
              <div key={p.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderLeft:`4px solid ${s?.color||T.muted}`,borderRadius:12,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14,fontWeight:600,color:T.text,marginBottom:4,lineHeight:1.4 }}>{p.descripcion}</div>
                    {p.notas&&<div style={{ fontSize:12,color:T.muted }}>{p.notas}</div>}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:20,fontWeight:700,color:T.accent,fontFamily:"'Sora',sans-serif" }}>{(p.importe||0).toFixed(2)} €</div>
                    <span style={{ padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:(s?.color||T.muted)+"15",color:s?.color||T.muted }}>{s?.label||p.status}</span>
                  </div>
                </div>
              </div>
            ); })}
          </div>
        )}

        {/* CONTRATOS */}
        {tab==="contratos" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {data.instalaciones.length===0&&<div style={{ textAlign:"center",padding:"40px",color:T.muted,fontSize:14,background:"#fff",borderRadius:12,border:`1px solid ${T.border}` }}>Sin contratos activos</div>}
            {data.instalaciones.map(i=>{
              const instEquipos = data.equipos.filter(eq=>eq.instalacion_id===i.id);
              return (
              <div key={i.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:10 }}>{i.nombre}</div>
                {i.tipo&&<div style={{ fontSize:12,color:T.muted,marginBottom:10 }}>Equipo: {i.tipo}</div>}
                {instEquipos.length===0 ? (
                  <div style={{ fontSize:12,color:T.muted }}>Sin equipos asociados</div>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                    {instEquipos.map(eq=>(
                      <div key={eq.id} style={{ display:"flex",flexDirection:"column",gap:8 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:T.text }}>{eq.nombre}</div>
                        {["mensual","trimestral","semestral","anual"].map(tipo=>{ if(!eq["activa_"+tipo]) return null; const mt=MT[tipo]; const urg=urgInfo(eq["proxima_"+tipo]); return (
                          <div key={tipo} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:9,background:T.surface,border:`1px solid ${T.border}` }}>
                            <span style={{ fontSize:13,fontWeight:600,color:mt.color }}>{mt.label}</span>
                            <span style={{ fontSize:12,fontWeight:600,color:urg.color }}>Próxima: {urg.label}</span>
                          </div>
                        ); })}
                      </div>
                    ))}
                  </div>
                )}
                {/* Revisiones recientes */}
                {data.revisiones.filter(r=>r.instalacion_id===i.id).length>0&&(
                  <div style={{ marginTop:12,borderTop:`1px solid ${T.border}`,paddingTop:10 }}>
                    <div style={{ fontSize:11,fontWeight:600,color:T.sub,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8 }}>Revisiones realizadas</div>
                    {data.revisiones.filter(r=>r.instalacion_id===i.id).slice(0,3).map(r=>{ const mt=MT[r.tipo]; const done=Object.values(r.checks||{}).filter(Boolean).length; const total=Object.keys(r.checks||{}).length; return (
                      <div key={r.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div><span style={{ fontSize:12,fontWeight:600,color:mt?.color }}>{mt?.label}</span><span style={{ fontSize:11,color:T.muted,marginLeft:8 }}>{r.fecha?.split("-").reverse().join("/")}</span></div>
                        <span style={{ fontSize:11,color:T.green,fontWeight:600 }}>✓ {done}/{total}</span>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
              ); })}
          </div>
        )}

        {/* EQUIPOS */}
        {tab==="equipos" && (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {data.equipos.length===0&&<div style={{ textAlign:"center",padding:"40px",color:T.muted,fontSize:14,background:"#fff",borderRadius:12,border:`1px solid ${T.border}` }}>Sin equipos registrados</div>}
            {data.equipos.map(eq=>(
              <div key={eq.id} style={{ background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:4 }}>{eq.nombre}</div>
                <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                  {eq.marca&&<span style={{ fontSize:12,color:T.sub }}>{eq.marca}</span>}
                  {eq.modelo&&<span style={{ fontSize:12,color:T.sub }}>· {eq.modelo}</span>}
                  {eq.año_instalacion&&<span style={{ fontSize:12,color:T.muted }}>· Inst. {eq.año_instalacion}</span>}
                </div>
                {eq.ubicacion&&<div style={{ fontSize:12,color:T.muted,marginTop:6 }}>📍 {eq.ubicacion}</div>}
                {eq.notas&&<div style={{ fontSize:12,color:T.sub,marginTop:6,fontStyle:"italic" }}>{eq.notas}</div>}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize:11,color:T.muted,textAlign:"center",marginTop:24,lineHeight:1.6 }}>
          BLCH · San Javier, Murcia · Portal seguro del cliente
        </p>
      </div>
    </div>
  );
}
