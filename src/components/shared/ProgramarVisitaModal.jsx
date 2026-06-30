import { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import Field from "../ui/Field.jsx";
import Btn from "../ui/Btn.jsx";
import { todayStr } from "../../utils/dates.js";
import { supabase } from "../../supabase.js";

export default function ProgramarVisitaModal({ averia, cliente }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const [show, setShow] = useState(false);
  const [fecha, setFecha] = useState(averia.fecha_visita||todayStr());
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  async function programar() {
    setSaving(true);
    const { error } = await supabase.from("eventos").insert([{
      tipo:"averia_programada",
      titulo:`${String(averia.id).startsWith("mant_")?"Mantenimiento":"Avería"}: ${averia.descripcion?.slice(0,50)}`,
      cliente_id:averia.cliente_id,
      direccion:averia.direccion||cliente?.direccion||"",
      fecha:fecha,
      notas:hora?`${hora}h — ${nota}`:nota,
      color:"#d97706",
      averia_id:String(averia.id),
    }]);
    if(!error){ setShow(false); alert("Visita añadida al calendario."); }
    else alert("Error: "+error.message);
    setSaving(false);
  }

  return (
    <div>
      {!show ? (
        <button onClick={()=>setShow(true)}
          style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid "+T.accent+"40", background:T.accentLight, color:T.accent, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          Programar
        </button>
      ) : (
        <div style={{ background:T.accentLight, borderRadius:10, padding:"14px", border:"1.5px solid "+T.accent+"40" }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.accent, marginBottom:12 }}>Programar visita</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Fecha"><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})}/></Field>
              <Field label="Hora (opcional)"><input type="time" value={hora} onChange={e=>setHora(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})}/></Field>
            </div>
            <Field label="Notas"><input value={nota} onChange={e=>setNota(e.target.value)} style={inp({fontSize:13,padding:"7px 10px"})} placeholder="Observaciones para la visita..."/></Field>
            <div style={{ display:"flex", gap:8 }}>
              <Btn ch="Cancelar" onClick={()=>setShow(false)} v="g" sm/>
              <Btn ch={saving?"Guardando...":"Añadir al calendario"} onClick={programar} disabled={saving||!fecha} sm/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
