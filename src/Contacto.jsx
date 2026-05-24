import React, { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://sqwbxmewymvmnegszzte.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd2J4bWV3eW12bW5lZ3N6enRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODMzNzcsImV4cCI6MjA5Mzg1OTM3N30.z_vGOPEqZXTQp9hWaiAjU-7Q1s8vACwfseB4UWIrfgM",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const T = {
  accent:"#1d4ed8", accentLight:"#eff6ff",
  green:"#16a34a", greenLight:"#f0fdf4",
  red:"#dc2626", redLight:"#fef2f2",
  border:"#e2e8f0", text:"#0f172a", sub:"#475569", muted:"#94a3b8",
  surface:"#f8fafc",
};

const inp = (x={}) => ({
  width:"100%", boxSizing:"border-box", background:"#fff",
  border:`1.5px solid ${T.border}`, borderRadius:10, padding:"12px 14px",
  color:T.text, fontSize:15, outline:"none", fontFamily:"'DM Sans',sans-serif",
  transition:"border-color 0.15s", ...x,
});

function Field({ label, required, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:13, fontWeight:600, color:T.sub }}>
        {label}{required && <span style={{ color:T.red, marginLeft:3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function Contacto() {
  const [empresa, setEmpresa] = useState({ nombre:"", color_corporativo:"#1d4ed8", logo_url:"", telefono:"", email:"", web:"" });
  const [form, setForm] = useState({
    nombre:"", apellidos:"", email:"", telefono:"",
    direccion:"", municipio:"", cp:"",
    dni:"", tipo:"averia", descripcion:"", lopd:false,
  });
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    supabase.from("empresa").select("*").eq("id",1).single()
      .then(({data})=>{ if(data) setEmpresa(data); });
  },[]);

  const color = empresa.color_corporativo || "#1d4ed8";

  const tipoLabel = { averia:"Avería", mantenimiento:"Mantenimiento", presupuesto:"Presupuesto" };

  function handleFotos(e) {
    const files = Array.from(e.target.files).slice(0, 4 - fotos.length);
    files.forEach(f => {
      const r = new FileReader();
      r.onload = ev => setFotos(p=>[...p, { file:f, preview:ev.target.result }]);
      r.readAsDataURL(f);
    });
    e.target.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if(!form.nombre.trim()||!form.telefono.trim()||!form.descripcion.trim()||!form.lopd) {
      setError("Por favor rellena todos los campos obligatorios y acepta la política de privacidad.");
      return;
    }
    setEnviando(true); setError("");
    try {
      const nombre = `${form.nombre.trim()} ${form.apellidos.trim()}`.trim();
      const direccion = [form.direccion, form.municipio, form.cp].filter(Boolean).join(", ");
      const res = await fetch("/api/contacto", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre, email:form.email, telefono:form.telefono, direccion, dni:form.dni, tipo:form.tipo, descripcion:form.descripcion }),
      });
      if(!res.ok) throw new Error("Error al enviar");
      setEnviado(true);
    } catch(err) {
      setError("Ha ocurrido un error. Por favor inténtalo de nuevo o llámanos directamente.");
    }
    setEnviando(false);
  }

  if (enviado) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"48px 36px", maxWidth:460, width:"100%", textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
        <div style={{ width:72,height:72,borderRadius:"50%",background:T.greenLight,border:"2px solid #bbf7d0",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32 }}>✓</div>
        <h1 style={{ fontSize:24, fontWeight:800, color:T.text, marginBottom:12, fontFamily:"'Sora',sans-serif" }}>¡Solicitud recibida!</h1>
        <p style={{ fontSize:15, color:T.sub, lineHeight:1.7, marginBottom:8 }}>Hemos recibido tu solicitud correctamente. Nos pondremos en contacto contigo a la mayor brevedad posible.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}input:focus,textarea:focus,select:focus{border-color:${color} !important;box-shadow:0 0 0 3px ${color}1a;}body{-webkit-text-size-adjust:100%;}`}</style>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${color}dd,${color})`, padding:"28px 20px 32px" }}>
        <div style={{ maxWidth:600, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
            {empresa.logo_url ? (
              <img src={empresa.logo_url} alt="logo" style={{ height:40, objectFit:"contain" }}/>
            ) : (
              <div style={{ width:40,height:40,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff" }}>
                {(empresa.nombre||"T")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize:17,fontWeight:700,color:"#fff",fontFamily:"'Sora',sans-serif" }}>{empresa.nombre||"BLCH"}</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.65)",textTransform:"uppercase",letterSpacing:"0.08em" }}>Calefacción · Climatización</div>
            </div>
          </div>
          <h1 style={{ fontSize:26,fontWeight:800,color:"#fff",marginBottom:10,fontFamily:"'Sora',sans-serif",lineHeight:1.2 }}>¿Necesitas ayuda?</h1>
          <p style={{ fontSize:15,color:"rgba(255,255,255,0.8)",lineHeight:1.7 }}>Rellena el formulario y nos pondremos en contacto contigo lo antes posible.</p>
        </div>
      </div>

      {/* Formulario */}
      <div style={{ maxWidth:600, margin:"0 auto", padding:"24px 16px 48px" }}>
        <form onSubmit={handleSubmit} style={{ background:"#fff",borderRadius:16,padding:"28px 24px",boxShadow:"0 2px 16px rgba(0,0,0,0.06)",display:"flex",flexDirection:"column",gap:20 }}>

          {/* Datos personales */}
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:16 }}>Datos personales</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <Field label="Nombre" required><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Tu nombre"/></Field>
                <Field label="Apellidos"><input value={form.apellidos} onChange={e=>upd("apellidos",e.target.value)} style={inp()} placeholder="Tus apellidos"/></Field>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <Field label="Teléfono" required><input type="tel" value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="6XX XXX XXX"/></Field>
                <Field label="Email"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="tu@email.com"/></Field>
              </div>
              <Field label="DNI / NIF"><input value={form.dni} onChange={e=>upd("dni",e.target.value)} style={inp()} placeholder="Opcional"/></Field>
            </div>
          </div>

          {/* Dirección */}
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:16 }}>Dirección</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <Field label="Calle y número"><input value={form.direccion} onChange={e=>upd("direccion",e.target.value)} style={inp()} placeholder="Calle Mayor, 5"/></Field>
              <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:12 }}>
                <Field label="Municipio"><input value={form.municipio} onChange={e=>upd("municipio",e.target.value)} style={inp()} placeholder="Tu municipio"/></Field>
                <Field label="CP"><input value={form.cp} onChange={e=>upd("cp",e.target.value)} style={{...inp(),width:90}} placeholder="30800"/></Field>
              </div>
            </div>
          </div>

          {/* Solicitud */}
          <div>
            <div style={{ fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:16 }}>Tu solicitud</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <Field label="Tipo de solicitud" required>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {[{k:"averia",l:"🔧 Avería"},{k:"mantenimiento",l:"🔄 Mantenimiento"},{k:"presupuesto",l:"📋 Presupuesto"}].map(op=>(
                    <button type="button" key={op.k} onClick={()=>upd("tipo",op.k)}
                      style={{ padding:"10px 18px",borderRadius:10,border:`2px solid ${form.tipo===op.k?color:T.border}`,background:form.tipo===op.k?color+"12":"#fff",color:form.tipo===op.k?color:T.sub,fontSize:14,fontWeight:form.tipo===op.k?600:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s" }}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Descripción" required>
                <textarea value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
                  placeholder={form.tipo==="averia"?"Describe el problema que tienes...":form.tipo==="mantenimiento"?"¿Qué equipo necesita mantenimiento?":"¿Qué te gustaría presupuestar?"}
                  style={{...inp(),minHeight:100,resize:"vertical"}}/>
              </Field>
              <Field label="Fotos (opcional)">
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleFotos}/>
                <button type="button" onClick={()=>fileRef.current.click()} disabled={fotos.length>=4}
                  style={{ padding:"10px 18px",borderRadius:10,border:`1.5px dashed ${T.border}`,background:T.surface,color:T.sub,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",width:"100%",marginBottom:fotos.length>0?10:0 }}>
                  📷 Adjuntar fotos {fotos.length>0?`(${fotos.length}/4)`:"(máx. 4)"}
                </button>
                {fotos.length>0&&(
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                    {fotos.map((f,i)=>(
                      <div key={i} style={{ position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden" }}>
                        <img src={f.preview} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                        <button type="button" onClick={()=>setFotos(p=>p.filter((_,j)=>j!==i))}
                          style={{ position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          </div>

          {/* LOPD */}
          <label style={{ display:"flex",gap:12,cursor:"pointer",alignItems:"flex-start" }}>
            <div onClick={()=>upd("lopd",!form.lopd)}
              style={{ width:22,height:22,borderRadius:6,border:`2px solid ${form.lopd?color:T.border}`,background:form.lopd?color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,cursor:"pointer",transition:"all 0.15s" }}>
              {form.lopd&&<svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>}
            </div>
            <span style={{ fontSize:12,color:T.sub,lineHeight:1.7 }}>
              Acepto que {empresa.nombre||"la empresa"} trate mis datos personales para gestionar mi solicitud, conforme al <strong>Reglamento General de Protección de Datos (RGPD)</strong> y la <strong>Ley Orgánica de Protección de Datos (LOPDGDD)</strong>. Los datos no serán cedidos a terceros. <span style={{ color:T.red }}>*</span>
            </span>
          </label>

          {error&&<div style={{ padding:"12px 16px",background:T.redLight,border:"1px solid #fecaca",borderRadius:10,fontSize:13,color:T.red }}>{error}</div>}

          <button type="submit" disabled={enviando||!form.nombre.trim()||!form.telefono.trim()||!form.descripcion.trim()||!form.lopd}
            style={{ padding:"16px",borderRadius:12,border:"none",background:enviando||!form.nombre.trim()||!form.telefono.trim()||!form.descripcion.trim()||!form.lopd?"#94a3b8":color,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 4px 14px ${color}40`,transition:"all 0.2s" }}>
            {enviando?"Enviando...":"Enviar solicitud"}
          </button>
        </form>
      </div>
    </div>
  );
}
