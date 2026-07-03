import React, { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp }    from "../../utils/styles.js";
import Field        from "../ui/Field.jsx";
import Btn          from "../ui/Btn.jsx";

export default function ClienteSelector({ clientes, value, onChange, onNewCliente }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const [modo, setModo] = useState("existente");
  const [form, setForm] = useState({ nombre:"", telefono:"", email:"", direccion:"" });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={{ background:T.surface, borderRadius:10, padding:"14px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:11, fontWeight:600, color:T.sub, marginBottom:10 }}>Cliente</div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[{k:"existente",l:"Cliente existente"},{k:"nuevo",l:"+ Nuevo cliente"}].map(o=>(
          <button key={o.k} onClick={()=>{ setModo(o.k); if(o.k==="nuevo") onChange(""); }} style={{ padding:"5px 13px",borderRadius:20,border:`1.5px solid ${modo===o.k?T.accent:T.border}`,background:modo===o.k?T.accent+"22":T.card,color:modo===o.k?T.accent:T.sub,fontSize:11,fontWeight:modo===o.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>{o.l}</button>
        ))}
      </div>
      {modo==="existente" ? (
        <select value={value} onChange={e=>onChange(e.target.value)} style={inp()}>
          <option value="">— Selecciona cliente —</option>
          {clientes.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Nombre *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Nombre o empresa"/></Field>
            <Field label="DNI / NIF / CIF"><input value={form.dni||""} onChange={e=>upd("dni",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="12345678A"/></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="6XX XXX XXX"/></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="correo@ejemplo.com"/></Field>
          </div>
          <Field label="Dirección"><input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Calle, número, piso..."/></Field>
          {form.nombre.trim() && (
            <Btn ch="Crear y seleccionar" onClick={()=>onNewCliente(form)} v="s"/>
          )}
        </div>
      )}
    </div>
  );
}
