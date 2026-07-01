import React, { useState } from "react";
import { useTheme }              from "../../ThemeContext.jsx";
import { mkInp }                 from "../../utils/styles.js";
import { useIsMobile }           from "../../hooks/useIsMobile.js";
import { supabase }              from "../../supabase.js";
import { TIPO_EQUIPO_OPTIONS, RITE_CHECKLIST } from "../../constants/equipment.js";
import { MT }                    from "../../constants/status.js";
import Modal                     from "../ui/Modal.jsx";
import MHead                     from "../ui/MHead.jsx";

export default function NuevoEquipoModal({ clienteId, instalacionId, onSave, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    nombre: "", tipo: "", marca: "", modelo: "",
    potencia: "", numero_serie: "", año_fabricacion: "",
    ubicacion: "", notas: "",
  });
  const [periodicidad, setPeriodicidad] = useState({
    mensual: false, trimestral: false, semestral: false, anual: false
  });
  const [proximas, setProximas] = useState({
    mensual: "", trimestral: "", semestral: "", anual: ""
  });
  const [checklist, setChecklist] = useState([]);
  const [nuevoItem, setNuevoItem] = useState("");
  const [saving, setSaving] = useState(false);

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // Al cambiar tipo de equipo carga checklist RITE automáticamente
  const onTipoChange = (tipo) => {
    upd("tipo", tipo);
    const items = RITE_CHECKLIST[tipo] || [];
    setChecklist(items.map(item => ({ texto: item, activo: true })));
  };

  const toggleItem = (i) => {
    setChecklist(p => p.map((it,idx) => idx===i ? {...it, activo:!it.activo} : it));
  };

  const addItem = () => {
    if(!nuevoItem.trim()) return;
    setChecklist(p => [...p, { texto: nuevoItem.trim(), activo: true }]);
    setNuevoItem("");
  };

  const removeItem = (i) => {
    setChecklist(p => p.filter((_,idx) => idx!==i));
  };

  const save = async () => {
    if(!form.nombre.trim()){ alert("El nombre del equipo es obligatorio"); return; }
    setSaving(true);
    const itemsGuardar = checklist.filter(it=>it.activo).map(it=>it.texto);
    const payload = {
      cliente_id: clienteId,
      instalacion_id: instalacionId||null,
      nombre: form.nombre,
      tipo: form.tipo||null,
      marca: form.marca||null,
      modelo: form.modelo||null,
      potencia: form.potencia||null,
      numero_serie: form.numero_serie||null,
      año_instalacion: form.año_fabricacion ? parseInt(form.año_fabricacion) : null,
      ubicacion: form.ubicacion||null,
      notas: form.notas||null,
      activa_mensual: periodicidad.mensual,
      activa_trimestral: periodicidad.trimestral,
      activa_semestral: periodicidad.semestral,
      activa_anual: periodicidad.anual,
      proxima_mensual: proximas.mensual||null,
      proxima_trimestral: proximas.trimestral||null,
      proxima_semestral: proximas.semestral||null,
      proxima_anual: proximas.anual||null,
      items_mensual: periodicidad.mensual ? itemsGuardar : [],
      items_trimestral: periodicidad.trimestral ? itemsGuardar : [],
      items_semestral: periodicidad.semestral ? itemsGuardar : [],
      items_anual: periodicidad.anual ? itemsGuardar : [],
    };
    const { error } = await supabase.from("equipos").insert([payload]);
    setSaving(false);
    if(error){ alert("Error: "+error.message); return; }
    onSave?.(); onClose();
  };

  return (
    <Modal onClose={onClose} w={600}>
      <MHead title="Nuevo equipo" onClose={onClose}/>
      <div style={{padding: isMobile?"14px":"20px 24px", display:"flex",
        flexDirection:"column", gap:14, maxHeight:"80vh", overflowY:"auto"}}>

        {/* Tipo de equipo */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:6,fontWeight:600}}>TIPO DE EQUIPO</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {TIPO_EQUIPO_OPTIONS.map(opt=>(
              <button key={opt.value} onClick={()=>onTipoChange(opt.value)}
                style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                  cursor:"pointer",border:`1.5px solid ${form.tipo===opt.value ? T.accent : T.border}`,
                  background: form.tipo===opt.value ? T.accentLight : T.surface,
                  color: form.tipo===opt.value ? T.accent : T.text}}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datos del equipo */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOMBRE *</div>
            <input value={form.nombre} onChange={e=>upd("nombre",e.target.value)}
              placeholder="Ej: Caldera sala principal" style={inp()}/>
          </div>
          {[
            {k:"marca",l:"MARCA",pl:"Ej: Roca"},
            {k:"modelo",l:"MODELO",pl:"Ej: Condens Gold"},
            {k:"potencia",l:"POTENCIA (kW)",pl:"Ej: 24"},
            {k:"numero_serie",l:"Nº SERIE",pl:"Ej: ABC123456"},
            {k:"año_fabricacion",l:"AÑO FABRICACIÓN",pl:"Ej: 2018"},
            {k:"ubicacion",l:"UBICACIÓN",pl:"Ej: Sala de calderas"},
          ].map(f=>(
            <div key={f.k}>
              <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>{f.l}</div>
              <input value={form[f.k]} onChange={e=>upd(f.k,e.target.value)}
                placeholder={f.pl} style={inp()}/>
            </div>
          ))}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:4,fontWeight:600}}>NOTAS TÉCNICAS</div>
            <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)}
              placeholder="Observaciones técnicas..." style={{...inp(),minHeight:60}}/>
          </div>
        </div>

        {/* Periodicidad */}
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>PERIODICIDAD DE REVISIÓN</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {["mensual","trimestral","semestral","anual"].map(tipo=>{
              const mt = MT[tipo];
              const activa = periodicidad[tipo];
              return (
                <div key={tipo} style={{borderRadius:10,overflow:"hidden",
                  border:`1.5px solid ${activa ? mt.color+"60" : T.border}`}}>
                  <div onClick={()=>setPeriodicidad(p=>({...p,[tipo]:!p[tipo]}))}
                    style={{padding:"10px 14px",cursor:"pointer",
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      background: activa ? mt.color+"15" : T.surface}}>
                    <span style={{fontSize:13,fontWeight:600,
                      color: activa ? mt.color : T.text,textTransform:"capitalize"}}>{tipo}</span>
                    <div style={{width:36,height:20,borderRadius:10,position:"relative",
                      background: activa ? mt.color : T.border,transition:"all 0.2s"}}>
                      <div style={{position:"absolute",top:2,
                        left: activa ? 18 : 2,width:16,height:16,
                        borderRadius:"50%",background:"#fff",transition:"all 0.2s"}}/>
                    </div>
                  </div>
                  {activa && (
                    <div style={{padding:"10px 14px",background:T.card,
                      borderTop:`1px solid ${T.border}`}}>
                      <div style={{fontSize:11,color:T.muted,marginBottom:4}}>Primera revisión</div>
                      <input type="date" value={proximas[tipo]}
                        onChange={e=>setProximas(p=>({...p,[tipo]:e.target.value}))}
                        style={inp()}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checklist */}
        {checklist.length>0 && (
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>
              CHECKLIST DE REVISIÓN — marca los que aplican
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {checklist.map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                  padding:"8px 12px",borderRadius:8,
                  background: item.activo ? T.accentLight : T.surface,
                  border:`1px solid ${item.activo ? T.accent+"40" : T.border}`}}>
                  <div onClick={()=>toggleItem(i)}
                    style={{width:18,height:18,borderRadius:4,flexShrink:0,cursor:"pointer",
                      border:`2px solid ${item.activo ? T.accent : T.border}`,
                      background: item.activo ? T.accent : "none",
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {item.activo && <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline points="1,5 4,8 9,2" stroke="#fff" strokeWidth="2" fill="none"/>
                    </svg>}
                  </div>
                  <span style={{flex:1,fontSize:12,color: item.activo ? T.text : T.muted}}>
                    {item.texto}
                  </span>
                  <button onClick={()=>removeItem(i)}
                    style={{background:"none",border:"none",color:T.muted,
                      cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <input value={nuevoItem} onChange={e=>setNuevoItem(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addItem()}
                placeholder="Añadir ítem al checklist..."
                style={{...inp(),flex:1,fontSize:12}}/>
              <button onClick={addItem}
                style={{padding:"0 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontWeight:600}}>+</button>
            </div>
          </div>
        )}

        {form.tipo==="otro" && checklist.length===0 && (
          <div>
            <div style={{fontSize:11,color:T.muted,marginBottom:8,fontWeight:600}}>
              CHECKLIST DE REVISIÓN
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={nuevoItem} onChange={e=>setNuevoItem(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addItem()}
                placeholder="Añadir ítem al checklist..."
                style={{...inp(),flex:1,fontSize:12}}/>
              <button onClick={addItem}
                style={{padding:"0 14px",borderRadius:8,border:"none",
                  background:T.accent,color:"#fff",cursor:"pointer",fontWeight:600}}>+</button>
            </div>
          </div>
        )}

        {/* Botón guardar */}
        <button onClick={save} disabled={saving}
          style={{padding:"12px",borderRadius:10,border:"none",
            background: saving ? T.border : T.accent,
            color:"#fff",cursor: saving?"not-allowed":"pointer",
            fontSize:14,fontWeight:700,marginTop:4}}>
          {saving ? "Guardando..." : "Guardar equipo"}
        </button>
      </div>
    </Modal>
  );
}
