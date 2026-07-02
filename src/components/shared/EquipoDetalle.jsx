import React, { useState } from "react";
import { useTheme }        from "../../ThemeContext.jsx";
import { mkInp }           from "../../utils/styles.js";
import { supabase }       from "../../supabase.js";
import { useIsMobile }    from "../../hooks/useIsMobile.js";
import Modal              from "../ui/Modal.jsx";
import MHead              from "../ui/MHead.jsx";
import Field              from "../ui/Field.jsx";
import Btn                from "../ui/Btn.jsx";

export default function EquipoDetalle({ equipo, data, refresh, onClose }) {
  const { T, BS, MS, PS } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...equipo, garantia_hasta:equipo.garantia_hasta||"", notas_tecnicas:equipo.notas_tecnicas||""});
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // Averías vinculadas directamente + partes asociados
  const averias = (data.averias||[]).filter(b=>
    b.equipo_id===equipo.id
  ).sort((a,b)=>b.id-a.id);

  // Revisiones del contrato si existe instalación para este equipo
  const revisiones = (data.revisiones||[]).filter(r=>
    (data.instalaciones||[]).find(i=>i.cliente_id===equipo.cliente_id && i.id===r.instalacion_id)
  ).sort((a,b)=>b.fecha?.localeCompare(a.fecha||"")||0).slice(0,5);

  async function save() {
    const { error } = await supabase.from("equipos").update({
      nombre:form.nombre, marca:form.marca, modelo:form.modelo,
      numero_serie:form.numero_serie, año_instalacion:form.año_instalacion?parseInt(form.año_instalacion):null,
      direccion:form.direccion, ubicacion:form.ubicacion, notas:form.notas,
      garantia_hasta:form.garantia_hasta||null, notas_tecnicas:form.notas_tecnicas||null,
    }).eq("id",equipo.id);
    if(!error) { refresh?.(); setEditing(false); }
    else alert("Error: "+error.message);
  }

  async function eliminar() {
    if(!window.confirm("¿Eliminar este equipo? No se pueden deshacer.")) return;
    await supabase.from("equipos").delete().eq("id",equipo.id);
    refresh?.(); onClose();
  }

  return (
    <Modal onClose={onClose} w={620}>
      <MHead title={equipo.nombre} sub={[equipo.marca,equipo.modelo].filter(Boolean).join(" · ")} onClose={onClose}/>
      <div style={{ padding:"18px 20px 22px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Info del equipo */}
        {!editing ? (
          <div style={{ background:T.surface, borderRadius:12, padding:"16px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              {[
                ["Marca", equipo.marca],
                ["Modelo", equipo.modelo],
                ["Nº serie", equipo.numero_serie],
                ["Año instalación", equipo.año_instalacion],
                ["Dirección", equipo.direccion],
                ["Ubicación", equipo.ubicacion],
              ].filter(([,v])=>v).map(([l,v])=>(
                <div key={l}>
                  <div style={{ fontSize:10,fontWeight:600,color:T.muted,textTransform:"uppercase",marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:13,color:T.text,fontWeight:500 }}>{v}</div>
                </div>
              ))}
            </div>
            {equipo.notas&&<div style={{ fontSize:13,color:T.sub,fontStyle:"italic",borderTop:`1px solid ${T.border}`,paddingTop:10 }}>{equipo.notas}</div>}
            {equipo.garantia_hasta && <Field label="Garantía hasta">{new Date(equipo.garantia_hasta).toLocaleDateString("es-ES")}</Field>}
            {equipo.notas_tecnicas && <Field label="Notas técnicas">{equipo.notas_tecnicas}</Field>}
            <div style={{ display:"flex",gap:8,marginTop:12 }}>
              <Btn ch="Editar" onClick={()=>setEditing(true)} v="g" sm/>
              <Btn ch="Eliminar equipo" onClick={eliminar} v="d" sm/>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()}/></Field>
              <Field label="Marca"><input value={form.marca||""} onChange={e=>upd("marca",e.target.value)} style={inp()}/></Field>
              <Field label="Modelo"><input value={form.modelo||""} onChange={e=>upd("modelo",e.target.value)} style={inp()}/></Field>
              <Field label="Nº serie"><input value={form.numero_serie||""} onChange={e=>upd("numero_serie",e.target.value)} style={inp()}/></Field>
              <Field label="Año"><input type="number" value={form.año_instalacion||""} onChange={e=>upd("año_instalacion",e.target.value)} style={inp()}/></Field>
            </div>
            <Field label="Dirección"><input value={form.direccion||""} onChange={e=>upd("direccion",e.target.value)} style={inp()}/></Field>
            <Field label="Ubicación"><input value={form.ubicacion||""} onChange={e=>upd("ubicacion",e.target.value)} style={inp()}/></Field>
            <Field label="Notas"><textarea value={form.notas||""} onChange={e=>upd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}}/></Field>
            <Field label="Garantía hasta">
              <input type="date" value={form.garantia_hasta} onChange={e=>setForm(p=>({...p,garantia_hasta:e.target.value}))} style={inp()}/>
            </Field>
            <Field label="Notas técnicas">
              <textarea value={form.notas_tecnicas} onChange={e=>setForm(p=>({...p,notas_tecnicas:e.target.value}))} style={{...inp(),minHeight:80}} placeholder="Observaciones técnicas del equipo"/>
            </Field>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              <Btn ch="Cancelar" onClick={()=>setEditing(false)} v="g"/>
              <Btn ch="Guardar" onClick={save}/>
            </div>
          </div>
        )}

        {/* Timeline técnico */}
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1,marginBottom:10}}>HISTORIAL TÉCNICO</div>
          {(()=>{
            const eventos = [
              ...(data.equipo_eventos||[]).filter(e=>e.equipo_id===equipo.id),
              ...(data.averias||[]).filter(a=>a.equipo_id===equipo.id).map(a=>({
                id:"av_"+a.id, tipo:"averia", titulo:a.descripcion,
                tecnico_nombre:a.tecnico_nombre||"", fecha:a.created_at,
                descripcion: "Estado: "+(BS[a.status]?.label||a.status||"")
              })),
              ...(data.mantenimientos||[]).filter(m=>m.equipo_id===equipo.id).map(m=>({
                id:"mt_"+m.id, tipo:"mantenimiento", titulo:m.descripcion,
                tecnico_nombre:m.tecnico_nombre||"", fecha:m.created_at,
                descripcion: "Estado: "+(MS[m.status]?.label||m.status||"")
              })),
              ...(data.presupuestos||[]).filter(p=>p.equipo_id===equipo.id).map(p=>({
                id:"pr_"+p.id, tipo:"presupuesto", titulo:p.descripcion,
                tecnico_nombre:"", fecha:p.created_at,
                descripcion: (PS[p.status]?.label||p.status||"")+(p.importe?" · "+p.importe.toFixed(2)+"€":"")
              })),
            ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));

            if(eventos.length===0) return (
              <div style={{textAlign:"center",padding:"30px 20px",color:T.muted,fontSize:13,
                background:T.surface,borderRadius:10,border:`2px dashed ${T.border}`}}>
                Sin historial técnico registrado
              </div>
            );

            const cfg = {
              averia:        {color:T.red,    label:"Avería"},
              mantenimiento: {color:T.accent, label:"Mantenimiento"},
              presupuesto:   {color:T.purple, label:"Presupuesto"},
              parte:         {color:T.green,  label:"Parte"},
              observacion:   {color:T.muted,  label:"Observación"},
            };

            return eventos.map(ev=>{
              const c = cfg[ev.tipo]||{color:T.muted,label:ev.tipo};
              return (
                <div key={ev.id} style={{display:"flex",gap:12,marginBottom:12}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0,marginTop:4}}/>
                    <div style={{width:2,flex:1,background:T.border,marginTop:4}}/>
                  </div>
                  <div style={{flex:1,paddingBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div>
                        <span style={{fontSize:11,fontWeight:700,color:c.color}}>{c.label}</span>
                        {ev.tecnico_nombre && <span style={{fontSize:11,color:T.muted,marginLeft:8}}>{ev.tecnico_nombre}</span>}
                      </div>
                      <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>
                        {new Date(ev.fecha).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    {ev.titulo && <div style={{fontSize:13,color:T.text,marginTop:2,lineHeight:1.4}}>{ev.titulo}</div>}
                    {ev.descripcion && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{ev.descripcion}</div>}
                  </div>
                </div>
              );
            });
          })()}
        </div>

      </div>
    </Modal>
  );
}
