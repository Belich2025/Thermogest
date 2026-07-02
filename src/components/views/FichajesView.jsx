import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { todayStr } from "../../utils/dates.js";
import { supabase } from "../../supabase.js";
import Ava from "../ui/Ava.jsx";
import Btn from "../ui/Btn.jsx";
import Field from "../ui/Field.jsx";
import MHead from "../ui/MHead.jsx";
import Modal from "../ui/Modal.jsx";
import BotonNomina from "../shared/BotonNomina.jsx";

export default function FichajesView({ data, user, refresh, empresa={} }) {
  const { T } = useTheme();
  const inp = mkInp(T);
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
