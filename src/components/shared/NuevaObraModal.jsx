import React, { useState, useRef }   from "react";
import { useTheme }                  from "../../ThemeContext.jsx";
import { mkInp }                     from "../../utils/styles.js";
import { supabase }                  from "../../supabase.js";
import { useIsMobile }               from "../../hooks/useIsMobile.js";
import { todayStr }                  from "../../utils/dates.js";
import Modal                         from "../ui/Modal.jsx";
import MHead                         from "../ui/MHead.jsx";
import Btn                           from "../ui/Btn.jsx";
import Field                         from "../ui/Field.jsx";
import ClienteBuscadorField          from "./ClienteBuscadorField.jsx";

export default function NuevaObraModal({ data, user, techs, refresh, onClose, presupuestoId }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const isAdmin  = user.role === "admin";
  const cls      = data.clientes || [];
  const pres     = data.presupuestos || [];

  const [clienteId, setClienteId] = useState("");
  const [presupId, setPresupId]   = useState("");
  const [form, setForm] = useState({
    descripcion: "", direccion: "", fechaInicio: todayStr(), fechaFin: "", tecnicoId: "", notas: "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const voiceActiveRef = useRef(false);
  const [voiceActive, setVoiceActive] = useState(false);
  function startVoice(cb) {
    if(voiceActiveRef.current) return;
    if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){ alert("Tu navegador no soporta dictado"); return; }
    voiceActiveRef.current = true;
    setVoiceActive(true);
    let transcript = ""; let active = true; let currentR = null;
    function finish() {
      active = false; voiceActiveRef.current = false; setVoiceActive(false);
      if(currentR) { try { currentR.stop(); } catch(e){} }
      if(transcript) cb(transcript);
    }
    window.__stopVoice = finish;
    function startRecognizer() {
      if(!active) return;
      const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
      const r = new SR(); currentR = r;
      r.lang = "es-ES"; r.interimResults = false; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = e => {
        for(let i = e.resultIndex; i < e.results.length; i++) {
          if(e.results[i].isFinal) transcript += (transcript ? " " : "") + e.results[i][0].transcript;
        }
      };
      r.onend = () => { if(active) setTimeout(() => startRecognizer(), 100); };
      r.onerror = (e) => { if(active && e.error === "no-speech") setTimeout(() => startRecognizer(), 100); };
      r.start();
    }
    startRecognizer();
  }
  const MicBtn = ({onResult}) => voiceActive
    ? <button type="button" onClick={()=>window.__stopVoice&&window.__stopVoice()}
        style={{ padding:"0 10px",height:34,borderRadius:8,border:"none",background:"#dc2626",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap",animation:"pulse-red 1.5s infinite" }}>
        ⏹ Parar IA
      </button>
    : <button type="button" onClick={()=>startVoice(onResult)}
        style={{ width:34,height:34,borderRadius:8,border:"none",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:700 }}>
        ✦ IA
      </button>;

  const presCliente = pres.filter(p=>p.cliente_id===clienteId && p.status==="aceptado");

  async function save() {
    if(!form.descripcion.trim()||!clienteId){ alert("Selecciona un cliente y añade descripción."); return; }
    setSaving(true);
    const { error } = await supabase.from("instalaciones_obras").insert([{
      cliente_id:     clienteId,
      presupuesto_id: presupId||null,
      tecnico_id:     form.tecnicoId||null,
      descripcion:    form.descripcion.trim(),
      direccion:      form.direccion,
      fecha_inicio:   form.fechaInicio,
      fecha_fin:      form.fechaFin||null,
      status: "pendiente",
      notas:          form.notas||null,
    }]);
    if(!error){ refresh?.(); onClose(); }
    else alert("Error: "+error.message);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={580}>
      <MHead title="Nueva instalación" onClose={onClose}/>
      <div style={{ padding:isMobile?"16px 14px":"20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
        <ClienteBuscadorField clientes={cls} clienteId={clienteId}
          onSelect={(id,c)=>{ setClienteId(id); setPresupId(""); upd("direccion",c?.direccion||""); }}
          onDeselect={()=>{ setClienteId(""); setPresupId(""); upd("direccion",""); }}
          onCreated={(nc)=>{ setClienteId(nc.id); upd("direccion",nc.direccion||""); }}
          refresh={refresh}/>

        {/* Presupuesto relacionado */}
        {presCliente.length>0&&(
          <Field label="Presupuesto relacionado (opcional)">
            <select value={presupId} onChange={e=>{ setPresupId(e.target.value); const p=pres.find(x=>String(x.id)===e.target.value); if(p) upd("descripcion",p.descripcion); }} style={inp()}>
              <option value="">Sin presupuesto relacionado</option>
              {presCliente.map(p=><option key={p.id} value={p.id}>#{p.id} — {p.descripcion?.slice(0,50)} ({(p.importe||0).toFixed(2)}€)</option>)}
            </select>
          </Field>
        )}

        <Field label="Descripción del trabajo *">
          <div style={{ display:"flex",gap:6,alignItems:"flex-start" }}>
            <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)} style={{...inp(),minHeight:70,resize:"vertical",flex:1}} placeholder="Describe la instalación a realizar..."/>
            <MicBtn onResult={t=>setForm(p=>({...p,descripcion:p.descripcion?p.descripcion+" "+t:t}))}/>
          </div>
        </Field>

        <Field label="Dirección">
          <input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Dirección de la instalación"/>
        </Field>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Fecha inicio"><input type="date" value={form.fechaInicio} onChange={e=>upd("fechaInicio",e.target.value)} style={inp()}/></Field>
          <Field label="Fecha fin prevista"><input type="date" value={form.fechaFin} onChange={e=>upd("fechaFin",e.target.value)} style={inp()}/></Field>
        </div>

        {isAdmin&&(
          <Field label="Técnico responsable">
            <select value={form.tecnicoId||""} onChange={e=>upd("tecnicoId",e.target.value)} style={inp()}>
              <option value="">Sin asignar</option>
              {(techs||[]).map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Field>
        )}

        <Field label="Notas">
          <textarea value={form.notas} onChange={e=>upd("notas",e.target.value)} style={{...inp(),minHeight:55,resize:"vertical"}} placeholder="Observaciones adicionales..."/>
        </Field>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear instalación"} onClick={save} disabled={saving||!form.descripcion.trim()||!clienteId}/>
        </div>
      </div>
    </Modal>
  );
}
