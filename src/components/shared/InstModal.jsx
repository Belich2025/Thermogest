import React, { useState } from "react";
import { useTheme }        from "../../ThemeContext.jsx";
import { mkInp }           from "../../utils/styles.js";
import { useIsMobile }     from "../../hooks/useIsMobile.js";
import { supabase }        from "../../supabase.js";
import { MT }              from "../../constants/status.js";
import { TIPO_EQUIPO_OPTIONS } from "../../constants/equipment.js";
import Modal               from "../ui/Modal.jsx";
import MHead               from "../ui/MHead.jsx";
import ClienteSelector     from "./ClienteSelector.jsx";
import NuevoEquipoModal    from "./NuevoEquipoModal.jsx";

export default function InstModal({ initClienteId, inst, clientes, data, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isEdit = !!inst;
  const [clienteId, setClienteId] = useState(initClienteId || inst?.cliente_id || null);
  const [form, setForm] = useState({
    nombre: inst?.nombre || "",
    notas: inst?.notas || "",
    activo: inst?.activo !== false,
  });
  const [equipos, setEquipos] = useState([]);
  const [showAddEquipo, setShowAddEquipo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedInstId, setSavedInstId] = useState(inst?.id || null);

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const saveContrato = async () => {
    if(!clienteId){ alert("Selecciona un cliente"); return; }
    if(!form.nombre.trim()){ alert("El nombre del contrato es obligatorio"); return; }
    setSaving(true);
    const clean = { nombre: form.nombre, notas: form.notas||null, activo: form.activo };
    if(isEdit){
      await supabase.from("instalaciones").update(clean).eq("id", inst.id);
      setSaving(false);
      refresh?.(); onClose();
    } else {
      const { data: newInst, error } = await supabase.from("instalaciones")
        .insert([{ ...clean, cliente_id: clienteId }]).select().single();
      setSaving(false);
      if(error){ alert("Error: "+error.message); return; }
      setSavedInstId(newInst.id);
      refresh?.();
    }
  };

  const eliminar = async () => {
    if(!window.confirm("¿Eliminar este contrato?")) return;
    await supabase.from("equipos").update({ instalacion_id: null }).eq("instalacion_id", inst.id);
    await supabase.from("revisiones").delete().eq("instalacion_id", inst.id);
    await supabase.from("instalaciones").delete().eq("id", inst.id);
    refresh?.(); onClose();
  };

  return (
    <Modal onClose={onClose} w={620}>
      <MHead title={isEdit ? "Editar contrato" : "Nuevo contrato"} onClose={onClose}/>
      <div style={{padding: isMobile?"14px":"20px 24px", display:"flex",
        flexDirection:"column", gap:14, maxHeight:"85vh", overflowY:"auto"}}>

        {/* Cliente */}
        <ClienteSelector clientes={clientes} value={clienteId} onChange={setClienteId}
          onNewCliente={async(f)=>{
            const {data:nc,error} = await supabase.from("clientes").insert([f]).select().single();
            if(!error&&nc) setClienteId(nc.id);
            else alert("Error: "+(error?.message||""));
          }}/>

        {/* Nombre y notas */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOMBRE DEL CONTRATO *</div>
          <input value={form.nombre} onChange={e=>upd("nombre",e.target.value)}
            placeholder="Ej: Mantenimiento anual calderas..." style={inp()}/>
        </div>
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOTAS</div>
          <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)}
            placeholder="Observaciones, condiciones especiales..."
            style={{...inp(), minHeight:60}}/>
        </div>

        {/* Toggle activo */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 14px",background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>
          <span style={{fontSize:13,fontWeight:600,color:T.text}}>Contrato activo</span>
          <button onClick={()=>upd("activo",!form.activo)}
            style={{width:44,height:24,borderRadius:12,position:"relative",border:"none",
              background: form.activo ? T.accent : T.border,cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{position:"absolute",top:2,
              left: form.activo ? 22 : 2,width:20,height:20,
              borderRadius:"50%",background:"#fff",transition:"all 0.2s"}}/>
          </button>
        </div>

        {/* Botón guardar contrato */}
        {!savedInstId && (
          <button onClick={saveContrato} disabled={saving}
            style={{padding:"11px",borderRadius:10,border:"none",
              background: saving ? T.border : T.accent,
              color:"#fff",cursor:saving?"not-allowed":"pointer",
              fontSize:14,fontWeight:700}}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear contrato"}
          </button>
        )}

        {/* Sección equipos — aparece tras crear el contrato o en edición */}
        {(savedInstId) && (
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:1}}>
                EQUIPOS ({equipos.length})
              </div>
              <button onClick={()=>setShowAddEquipo(true)}
                style={{padding:"7px 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",
                  fontSize:12,fontWeight:600}}>
                + Añadir equipo
              </button>
            </div>

            {equipos.length===0 && !showAddEquipo && (
              <div onClick={()=>setShowAddEquipo(true)}
                style={{textAlign:"center",padding:"24px",color:T.muted,fontSize:13,
                  background:T.surface,borderRadius:10,
                  border:`2px dashed ${T.border}`,cursor:"pointer"}}>
                Sin equipos. Pulsa para añadir el primero.
              </div>
            )}

            {equipos.map((eq,i)=>(
              <div key={i} style={{background:T.surface,borderRadius:10,padding:"10px 14px",
                border:`1px solid ${T.border}`,marginBottom:8,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:T.text}}>{eq.nombre}</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                    {[TIPO_EQUIPO_OPTIONS.find(t=>t.value===eq.tipo)?.label,
                      eq.marca, eq.modelo].filter(Boolean).join(" · ")}
                  </div>
                  <div style={{fontSize:11,color:T.accent,marginTop:2}}>
                    {["mensual","trimestral","semestral","anual"]
                      .filter(t=>eq["activa_"+t])
                      .map(t=>MT[t]?.label||t).join(" · ")}
                  </div>
                </div>
                <button onClick={()=>setEquipos(p=>p.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:T.red,
                    cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>
              </div>
            ))}

            {showAddEquipo && (
              <NuevoEquipoModal
                clienteId={clienteId}
                instalacionId={savedInstId}
                onSave={()=>{
                  refresh?.();
                  setShowAddEquipo(false);
                  // Recarga equipos de esta instalación
                  supabase.from("equipos")
                    .select("*")
                    .eq("instalacion_id", savedInstId)
                    .then(({data:eqs})=>setEquipos(eqs||[]));
                }}
                onClose={()=>setShowAddEquipo(false)}
              />
            )}

            <button onClick={onClose}
              style={{width:"100%",padding:"11px",borderRadius:10,marginTop:8,
                border:`1px solid ${T.border}`,background:T.surface,
                color:T.text,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Cerrar
            </button>
          </div>
        )}

        {/* Botones edición */}
        {isEdit && !savedInstId && (
          <div style={{display:"flex",gap:8}}>
            <button onClick={eliminar}
              style={{padding:"10px 16px",borderRadius:8,border:`1px solid ${T.red}40`,
                background:T.redLight,color:T.red,cursor:"pointer",fontSize:13,fontWeight:600}}>
              Eliminar
            </button>
            <button onClick={onClose}
              style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${T.border}`,
                background:T.surface,color:T.text,cursor:"pointer",fontSize:13}}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
