import React, { useState, useRef } from "react";
import { useTheme }             from "../../ThemeContext.jsx";
import { mkInp }                from "../../utils/styles.js";
import { supabase }             from "../../supabase.js";
import { sendPushNotification } from "../../push.js";
import Modal                    from "../ui/Modal.jsx";
import MHead                    from "../ui/MHead.jsx";
import Field                    from "../ui/Field.jsx";
import Btn                      from "../ui/Btn.jsx";

export default function SolicitarPresupuestoModal({ averiaId, clienteId, clienteNombre, data, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);

  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving]           = useState(false);
  const savingRef = useRef(false);

  async function save() {
    if(savingRef.current) return;
    if(!descripcion.trim()) return;
    savingRef.current = true;
    setSaving(true);
    const { error } = await supabase.from("presupuestos").insert([{
      cliente_id: clienteId,
      descripcion: descripcion.trim(),
      averia_id: averiaId,
      status: "nuevo",
      importe: 0
    }]);
    if(!error){
      await supabase.from("averias").update({status:"presupuesto_enviado"}).eq("id",averiaId);
      sendPushNotification(data.profiles, "Nueva petición de presupuesto - " + (clienteNombre||"cliente"), descripcion.trim().slice(0,100), "admin");
      refresh?.();
      onClose();
    } else { alert("Error: "+error.message); }
    setSaving(false);
    savingRef.current = false;
  }

  return (
    <Modal onClose={onClose} w={480}>
      <MHead title="Solicitar presupuesto" sub={clienteNombre} onClose={onClose}/>
      <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>

        <Field label="Descripción del trabajo *">
          <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)}
            style={{...inp(),minHeight:90,resize:"vertical"}}
            placeholder="Describe qué hay que presupuestar..."/>
        </Field>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear petición"} onClick={save} disabled={saving||!descripcion.trim()}/>
        </div>
      </div>
    </Modal>
  );
}
