import React, { useState } from "react";
import { supabase } from "../../supabase.js";
import { openMaps } from "../../utils/links.js";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import Btn from "../ui/Btn.jsx";
import Field from "../ui/Field.jsx";
import MHead from "../ui/MHead.jsx";
import Modal from "../ui/Modal.jsx";

export default function CalendarView({ data, user, refresh }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const now = new Date();
  const pad = n => String(n).padStart(2,"0");
  const todayDS = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState("month");
  const [weekStart, setWeekStart] = useState(()=>{ const d=new Date(now); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); return d; });
  const [selDay, setSelDay]   = useState(null);
  const [popover, setPopover] = useState(null);
  const [showEv, setShowEv]   = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [mobilePanelDay, setMobilePanelDay]   = useState(null);
  const [showReprog, setShowReprog] = useState(null);
  const [reprogDate, setReprogDate] = useState("");
  const [savingReprog, setSavingReprog] = useState(false);

  const DOW    = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const ET = {
    instalacion:      { label:"Instalación",  color:"#16a34a" },
    revision:         { label:"Revisión",     color:"#d97706" },
    averia_programada:{ label:"Avería",       color:"#dc2626" },
    mantenimiento:    { label:"Mantenimiento",color:"#2563eb" },
    otro:             { label:"Otro",         color:"#7c3aed" },
  };

  const cl = id => (data.clientes||[]).find(c=>c.id===id);

  function getEvs(dateStr) {
    if(!dateStr) return [];
    return (data.eventos||[])
      .filter(e=>e.fecha===dateStr)
      .map(e=>({...e, _t:"ev", _color:e.color||ET[e.tipo]?.color||T.accent}));
  }

  // Month grid
  const prefix = `${year}-${pad(month+1)}`;
  const daysInMonth = new Date(year,month+1,0).getDate();
  let sdow = new Date(year,month,1).getDay(); sdow = sdow===0?6:sdow-1;
  const cells = Array.from({length:Math.ceil((sdow+daysInMonth)/7)*7},(_,i)=>{ const d=i-sdow+1; return(d>=1&&d<=daysInMonth)?d:null; });

  // Week grid
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(weekStart); d.setDate(d.getDate()+i); return d; });

  function prevNav() {
    if(viewMode==="week"){ const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
    else{ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  }
  function nextNav() {
    if(viewMode==="week"){ const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }
    else{ if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
  }

  const emptyEForm = {tipo:"instalacion",titulo:"",clienteId:"",direccion:"",fecha:"",tecnicoId:"",notas:""};
  const [eForm, setEForm] = useState(emptyEForm);
  const eUpd = (k,v)=>{ const n={...eForm,[k]:v}; if(k==="clienteId"){const c=cl(v); n.direccion=c?.direccion||"";} setEForm(n); };
  const closeEv = ()=>{ setShowEv(false); setEForm(emptyEForm); };

  async function addEvento() {
    if(!eForm.titulo.trim()||!eForm.fecha) return;
    const payload = { tipo:eForm.tipo, titulo:eForm.titulo, cliente_id:eForm.clienteId||null, direccion:eForm.direccion, fecha:eForm.fecha, tecnico_id:eForm.tecnicoId||null, notas:eForm.notas, color:ET[eForm.tipo]?.color||T.accent };
    const {error} = eForm.editId
      ? await supabase.from("eventos").update(payload).eq("id",eForm.editId)
      : await supabase.from("eventos").insert([payload]);
    if(!error){ refresh?.(); closeEv(); } else alert("Error: "+error.message);
  }

  async function delEvento(id) { await supabase.from("eventos").delete().eq("id",id); refresh?.(); setPopover(null); setSelDay(null); }

  async function reprogramar() {
    if(!reprogDate||!showReprog) return;
    setSavingReprog(true);
    await supabase.from("eventos").update({fecha:reprogDate}).eq("id",showReprog.id);
    refresh?.(); setShowReprog(null); setPopover(null); setSavingReprog(false);
  }

  function openNewEv(dateStr) {
    if(isMobile){ setMobilePanelDay(dateStr); setShowMobilePanel(true); }
    else{ setEForm({...emptyEForm, fecha:dateStr}); setShowEv(true); }
  }

  function handleEvClick(e, ev) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ ev, x:rect.left, y:rect.bottom+8 });
  }

  // ── Pill component
  function Pill({ ev, onClick, dot }) {
    if(dot) return <div style={{ width:7,height:7,borderRadius:"50%",background:ev._color,flexShrink:0 }}/>;
    return (
      <div onClick={e=>onClick&&onClick(e,ev)}
        style={{ padding:"2px 6px",borderRadius:4,background:ev._color+"22",color:ev._color,fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",border:`1px solid ${ev._color}33` }}>
        {ev.titulo}
      </div>
    );
  }

  // ── Event card for sidebar / panel
  function EvCard({ ev, onReprog }) {
    const c = cl(ev.cliente_id);
    return (
      <div style={{ background:T.surface,borderRadius:9,padding:"10px 13px",border:`1px solid ${T.border}`,borderLeft:`3px solid ${ev._color}` }}>
        <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:c?3:6 }}>{ev.titulo}</div>
        {c&&<div style={{ fontSize:11,color:T.muted,marginBottom:6 }}>{c.nombre}</div>}
        {ev.direccion&&<button onClick={()=>openMaps(ev.direccion)} style={{ padding:"3px 9px",borderRadius:6,border:"1.5px solid #bfdbfe",background:T.accentLight,color:T.accent,fontSize:10,cursor:"pointer",fontWeight:600,display:"block",marginBottom:7 }}>Cómo llegar</button>}
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <button onClick={onReprog} style={{ padding:"4px 11px",borderRadius:7,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:11,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Reprogramar</button>
          {user.role==="admin"&&<>
            <button onClick={()=>{ setEForm({tipo:ev.tipo||"instalacion",titulo:ev.titulo,clienteId:ev.cliente_id||"",direccion:ev.direccion||"",fecha:ev.fecha,tecnicoId:ev.tecnico_id||"",notas:ev.notas||"",editId:ev.id}); setShowEv(true); }} style={{ background:"none",border:"none",color:T.accent,fontSize:11,cursor:"pointer",padding:0,fontWeight:600 }}>Editar</button>
            <button onClick={()=>delEvento(ev.id)} style={{ background:"none",border:"none",color:T.red,fontSize:11,cursor:"pointer",padding:0 }}>Eliminar</button>
          </>}
        </div>
      </div>
    );
  }

  const navTitle = viewMode==="month"
    ? `${MONTHS[month]} ${year}`
    : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

  return (
    <div style={{ padding:isMobile?12:28 }}>

      {/* ── Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10 }}>
        <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:0,fontFamily:"'Sora',sans-serif" }}>Calendario</h1>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <div style={{ display:"flex",borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden" }}>
            {[["month","Mes"],["week","Semana"]].map(([k,l])=>(
              <button key={k} onClick={()=>setViewMode(k)}
                style={{ padding:"6px 14px",border:`1px solid ${viewMode===k?T.accent:T.border}`,background:viewMode===k?T.accent+"22":T.card,color:viewMode===k?T.accent:T.sub,fontSize:12,fontWeight:viewMode===k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{l}</button>
            ))}
          </div>
          {user.role==="admin"&&<Btn ch="+ Evento" onClick={()=>{ setEForm({...emptyEForm,fecha:todayDS}); setShowEv(true); }}/>}
        </div>
      </div>

      {/* ── Nav bar */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,background:T.card,borderRadius:10,padding:"10px 16px",border:`1px solid ${T.border}` }}>
        <button onClick={prevNav} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:isMobile?26:20,padding:"0 10px",fontWeight:700,lineHeight:1 }}>‹</button>
        <button onClick={()=>{ setYear(now.getFullYear()); setMonth(now.getMonth()); const d=new Date(now); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); setWeekStart(d); }}
          style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif",background:"none",border:"none",cursor:"pointer" }}>
          {navTitle}
        </button>
        <button onClick={nextNav} style={{ background:"none",border:"none",color:T.sub,cursor:"pointer",fontSize:isMobile?26:20,padding:"0 10px",fontWeight:700,lineHeight:1 }}>›</button>
      </div>

      <div style={{ display:"flex",gap:18,flexDirection:isMobile?"column":"row",alignItems:"flex-start" }}>
        <div style={{ flex:1,minWidth:0 }}>

          {/* ══ VISTA MENSUAL ══ */}
          {viewMode==="month"&&(<>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr",gap:2,marginBottom:2 }}>
              {DOW.map((d,i)=><div key={d} style={{ textAlign:"center",fontSize:i>=5?9:11,fontWeight:700,color:i>=5?T.muted:T.sub,padding:"6px 0",textTransform:"uppercase",letterSpacing:"0.05em" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 0.5fr 0.5fr",gap:2 }}>
              {cells.map((d,i)=>{
                const isWe = i%7>=5;
                const ds   = d?`${prefix}-${pad(d)}`:null;
                const isToday = ds===todayDS;
                const isSel   = ds===selDay;
                const evs  = getEvs(ds);
                const shown = evs.slice(0,isMobile?0:3);
                const extra = evs.length-shown.length;
                return (
                  <div key={i}
                    onClick={()=>{ if(!d) return; if(isMobile){setMobilePanelDay(ds);setShowMobilePanel(true);}else setSelDay(ds===selDay?null:ds); }}
                    onMouseEnter={e=>{ if(d) e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.08)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; }}
                    style={{ minHeight:isMobile?52:80,borderRadius:8,padding:isMobile?"4px":"6px 6px 4px",background:!d?"transparent":isSel?"#eff6ff":isWe?T.bg:T.card,border:`1px solid ${isSel?T.accent:isToday?T.accent+"80":d?T.border:"transparent"}`,cursor:d?"pointer":"default",position:"relative",overflow:"hidden",transition:"box-shadow 0.15s" }}>
                    {d&&<>
                      {isToday&&<div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:T.accent,borderRadius:"8px 8px 0 0" }}/>}
                      <div style={{ fontSize:isMobile?10:12,fontWeight:isToday?700:500,color:isToday?T.accent:T.text,marginBottom:isMobile?2:4,marginTop:isToday?4:0 }}>{d}</div>
                      {isMobile?(
                        <div style={{ display:"flex",gap:2,flexWrap:"wrap" }}>
                          {evs.slice(0,5).map((ev,j)=><Pill key={j} ev={ev} dot/>)}
                          {evs.length>5&&<div style={{ width:6,height:6,borderRadius:"50%",background:T.muted }}/>}
                        </div>
                      ):(
                        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                          {shown.map((ev,j)=><Pill key={j} ev={ev} onClick={handleEvClick}/>)}
                          {extra>0&&<div style={{ fontSize:9,color:T.muted,fontWeight:600,paddingLeft:2 }}>+{extra} más</div>}
                        </div>
                      )}
                    </>}
                  </div>
                );
              })}
            </div>
          </>)}

          {/* ══ VISTA SEMANAL ══ */}
          {viewMode==="week"&&(
            <div style={{ overflowX:"auto" }}>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 }}>
                {weekDays.map((d,i)=>{
                  const ds = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                  const isToday = ds===todayDS;
                  const isSel   = ds===selDay;
                  const dow = d.getDay();
                  const isWe = dow===0||dow===6;
                  const evs = getEvs(ds);
                  return (
                    <div key={i} style={{ borderRadius:10,overflow:"hidden",border:`1px solid ${isSel?T.accent:isToday?T.accent+"80":T.border}`,background:isWe?T.bg:T.card }}>
                      <div onClick={()=>setSelDay(ds===selDay?null:ds)}
                        style={{ padding:"8px 8px 6px",textAlign:"center",background:isToday?T.accentLight:isWe?T.surface:T.card,borderBottom:`2px solid ${isToday?T.accent:T.border}`,cursor:"pointer" }}>
                        <div style={{ fontSize:9,fontWeight:700,color:isWe?T.muted:T.sub,textTransform:"uppercase" }}>{DOW[i===6?6:i]}</div>
                        <div style={{ fontSize:16,fontWeight:isToday?800:500,color:isToday?T.accent:T.text }}>{d.getDate()}</div>
                      </div>
                      <div style={{ padding:"6px 4px",display:"flex",flexDirection:"column",gap:3,minHeight:120 }}
                        onClick={()=>{ if(evs.length===0) openNewEv(ds); }}>
                        {evs.map((ev,j)=><Pill key={j} ev={ev} onClick={handleEvClick}/>)}
                        {evs.length===0&&<div style={{ fontSize:9,color:T.border,textAlign:"center",paddingTop:30 }}>+</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop sidebar */}
        {!isMobile&&selDay&&(
          <div style={{ width:260,flexShrink:0 }}>
            <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",position:"sticky",top:20 }}>
              <div style={{ padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div style={{ fontSize:12,fontWeight:600,color:T.sub }}>{new Date(selDay+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
                <button onClick={()=>setSelDay(null)} style={{ background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:16 }}>×</button>
              </div>
              <div style={{ padding:"12px",display:"flex",flexDirection:"column",gap:8 }}>
                {getEvs(selDay).length===0?(
                  <div>
                    <p style={{ color:T.muted,fontSize:12,margin:"0 0 10px" }}>Sin eventos este día.</p>
                    {user.role==="admin"&&<Btn ch="+ Crear evento" onClick={()=>openNewEv(selDay)} sm/>}
                  </div>
                ):(
                  <>
                    {getEvs(selDay).map((ev,i)=>(
                      <EvCard key={i} ev={ev} onReprog={()=>{ setReprogDate(selDay); setShowReprog(ev); }}/>
                    ))}
                    {user.role==="admin"&&<Btn ch="+ Añadir evento" onClick={()=>openNewEv(selDay)} v="g" sm/>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Popover */}
      {popover&&(<>
        <div onClick={()=>setPopover(null)} style={{ position:"fixed",inset:0,zIndex:199 }}/>
        <div style={{ position:"fixed",left:Math.min(popover.x,window.innerWidth-280),top:Math.min(popover.y,window.innerHeight-200),zIndex:200,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,boxShadow:"0 8px 30px rgba(0,0,0,0.15)",padding:"14px 16px",width:264 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.text }}>{popover.ev.titulo}</div>
              {cl(popover.ev.cliente_id)&&<div style={{ fontSize:11,color:T.muted,marginTop:2 }}>{cl(popover.ev.cliente_id)?.nombre}</div>}
            </div>
            <button onClick={()=>setPopover(null)} style={{ background:"none",border:"none",color:T.muted,fontSize:16,cursor:"pointer",padding:0,flexShrink:0 }}>×</button>
          </div>
          <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
            <button onClick={()=>{ setReprogDate(popover.ev.fecha||""); setShowReprog(popover.ev); setPopover(null); }}
              style={{ padding:"5px 12px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.card,color:T.sub,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>
              Reprogramar
            </button>
            {user.role==="admin"&&<>
              <button onClick={()=>{ setEForm({tipo:popover.ev.tipo||"instalacion",titulo:popover.ev.titulo,clienteId:popover.ev.cliente_id||"",direccion:popover.ev.direccion||"",fecha:popover.ev.fecha,tecnicoId:popover.ev.tecnico_id||"",notas:popover.ev.notas||"",editId:popover.ev.id}); setShowEv(true); setPopover(null); }}
                style={{ padding:"5px 12px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.card,color:T.accent,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Editar</button>
              <button onClick={()=>delEvento(popover.ev.id)}
                style={{ padding:"5px 12px",borderRadius:8,border:"1.5px solid #fecaca",background:"#fff5f5",color:T.red,fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>Eliminar</button>
            </>}
          </div>
        </div>
      </>)}

      {/* ── Mobile bottom panel */}
      {isMobile&&showMobilePanel&&mobilePanelDay&&(<>
        <div onClick={()=>setShowMobilePanel(false)} style={{ position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,0.45)" }}/>
        <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:T.card,borderRadius:"22px 22px 0 0",padding:"20px 20px 44px",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.22)" }}>
          <div style={{ width:44,height:5,borderRadius:3,background:T.border,margin:"0 auto 16px" }}/>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:14 }}>
            {new Date(mobilePanelDay+"T12:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
          </div>
          {getEvs(mobilePanelDay).length===0?(
            <div>
              <p style={{ color:T.muted,fontSize:13,margin:"0 0 14px" }}>Sin eventos este día.</p>
              {user.role==="admin"&&<Btn ch="+ Crear evento" onClick={()=>{ setShowMobilePanel(false); setEForm({...emptyEForm,fecha:mobilePanelDay}); setShowEv(true); }}/>}
            </div>
          ):(
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {getEvs(mobilePanelDay).map((ev,i)=>(
                <EvCard key={i} ev={ev} onReprog={()=>{ setReprogDate(mobilePanelDay); setShowReprog(ev); setShowMobilePanel(false); }}/>
              ))}
              {user.role==="admin"&&<Btn ch="+ Añadir evento" onClick={()=>{ setShowMobilePanel(false); setEForm({...emptyEForm,fecha:mobilePanelDay}); setShowEv(true); }} v="g"/>}
            </div>
          )}
        </div>
      </>)}

      {/* ── Reprogramar modal */}
      {showReprog&&(
        <Modal onClose={()=>setShowReprog(null)} w={360}>
          <MHead title="Reprogramar" onClose={()=>setShowReprog(null)}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ fontSize:13,fontWeight:600,color:T.sub,borderLeft:`3px solid ${showReprog._color}`,paddingLeft:10 }}>{showReprog.titulo}</div>
            <Field label="Nueva fecha *"><input type="date" value={reprogDate} onChange={e=>setReprogDate(e.target.value)} style={inp()}/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setShowReprog(null)} v="g"/>
              <Btn ch={savingReprog?"Guardando...":"Guardar"} onClick={reprogramar} disabled={savingReprog||!reprogDate}/>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Nuevo / Editar evento modal */}
      {showEv&&(
        <Modal onClose={closeEv} w={480}>
          <MHead title={eForm.editId?"Editar evento":"Nuevo evento"} onClose={closeEv}/>
          <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:13 }}>
            <Field label="Tipo"><select value={eForm.tipo} onChange={e=>eUpd("tipo",e.target.value)} style={inp()}>{Object.entries(ET).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}</select></Field>
            <Field label="Título *"><input value={eForm.titulo} onChange={e=>eUpd("titulo",e.target.value)} style={inp()} placeholder="Descripción del evento"/></Field>
            <Field label="Fecha *"><input type="date" value={eForm.fecha} onChange={e=>eUpd("fecha",e.target.value)} style={inp()}/></Field>
            <Field label="Cliente"><select value={eForm.clienteId} onChange={e=>eUpd("clienteId",e.target.value)} style={inp()}><option value="">— Sin cliente —</option>{(data.clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
            <Field label="Dirección"><input value={eForm.direccion} onChange={e=>eUpd("direccion",e.target.value)} style={inp()} placeholder="Dirección del trabajo"/></Field>
            <Field label="Notas"><textarea value={eForm.notas} onChange={e=>eUpd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Observaciones..."/></Field>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
              <Btn ch="Cancelar" onClick={closeEv} v="g"/>
              <Btn ch={eForm.editId?"Guardar cambios":"Añadir evento"} onClick={addEvento} disabled={!eForm.titulo.trim()||!eForm.fecha}/>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
