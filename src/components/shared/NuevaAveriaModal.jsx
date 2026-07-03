import React, { useState } from "react";
import { useTheme }      from "../../ThemeContext.jsx";
import { mkInp }         from "../../utils/styles.js";
import { useIsMobile }   from "../../hooks/useIsMobile.js";
import { todayStr }      from "../../utils/dates.js";
import { supabase }      from "../../supabase.js";
import Modal             from "../ui/Modal.jsx";
import MHead             from "../ui/MHead.jsx";
import Field             from "../ui/Field.jsx";
import Btn               from "../ui/Btn.jsx";
import ClienteSelector   from "./ClienteSelector.jsx";

export default function NuevaAveriaModal({ data, user, techs, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];

  const [clienteId, setClienteId] = useState(cls[0]?.id || "");
  const [direccion, setDireccion] = useState(cls[0]?.direccion || "");
  const [form, setForm] = useState({
    equipo:"Caldera", descripcion:"",
    fechaVisita:todayStr(),
    tecnicoId: isAdmin ? (techs||[])[0]?.id || "" : user.id,
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [saving, setSaving] = useState(false);

  function handleClienteChange(id) {
    setClienteId(id);
    const c = cls.find(x=>x.id===id);
    setDireccion(c?.direccion || "");
  }

  async function handleNewCliente(nuevoForm) {
    const payload = { ...nuevoForm, dni:nuevoForm.dni||null, notas:nuevoForm.notas||null };
    const { data:nc, error } = await supabase.from("clientes").insert([payload]).select().single();
    if (!error && nc) { refresh?.(); setClienteId(nc.id); setDireccion(nc.direccion||""); }
    else alert("Error al crear cliente: " + (error?.message||""));
  }

  async function save() {
    if (!form.descripcion.trim() || !clienteId) { alert("Selecciona un cliente y escribe la descripción."); return; }
    setSaving(true);
    const { error } = await supabase.from("averias").insert([{
      cliente_id:  clienteId,
      direccion:   direccion,
      equipo:      form.equipo,
      descripcion: form.descripcion.trim(),
      fecha_visita:form.fechaVisita,
      tecnico_id:  form.tecnicoId || null,
      status: "nueva",
      from_form:   false,
    }]);
    if (!error) {
      refresh?.(); onClose();
    } else alert("Error: " + error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={560}>
      <MHead title="Nueva avería" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <ClienteSelector clientes={cls} value={clienteId} onChange={handleClienteChange} onNewCliente={handleNewCliente}/>
        {clienteId && (
          <Field label="Dirección de la visita">
            <input value={direccion} onChange={e=>setDireccion(e.target.value)} style={inp()} placeholder="Dirección donde realizar la visita"/>
          </Field>
        )}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          <Field label="Equipo">
            <select value={form.equipo} onChange={e=>upd("equipo",e.target.value)} style={inp()}>
              {["Caldera","Split A/C","Bomba de calor","Fan-coil","Climatizador","Aerotermia","VRV/VRF","Suelo radiante","Otro"].map(e=><option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Fecha visita">
            <input type="date" value={form.fechaVisita} onChange={e=>upd("fechaVisita",e.target.value)} style={inp()}/>
          </Field>
        </div>
        {isAdmin && (
          <Field label="Técnico asignado">
            <select value={form.tecnicoId||""} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar (visible para todos)</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}
        <Field label="Descripción del problema *">
          <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
            placeholder="Describe brevemente el problema..." style={{...inp(),minHeight:75,resize:"vertical"}}/>
        </Field>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear avería"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>

    </Modal>
  );
}
