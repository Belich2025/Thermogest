import { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../supabase.js";
import Modal from "../ui/Modal.jsx";
import MHead from "../ui/MHead.jsx";
import Field from "../ui/Field.jsx";
import Btn from "../ui/Btn.jsx";
import Ava from "../ui/Ava.jsx";

const COLORES = ["#1d4ed8","#16a34a","#dc2626","#d97706","#7c3aed","#0d9488","#db2777","#ea580c","#0891b2","#65a30d"];

function NuevoUsuarioModal({ onClose, onCreated, colores }) {
  const isMobile = useIsMobile();
  const { T } = useTheme();
  const inp = mkInp(T);
  const [form, setForm] = useState({ nombre:"", email:"", password:"", role:"tecnico", color:"#1d4ed8", telefono:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  async function crear() {
    if(!form.nombre.trim()||!form.email.trim()||!form.password.trim()){ setError("Nombre, email y contraseña son obligatorios."); return; }
    if(form.password.length < 6){ setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/usuarios", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accion:"crear", email:form.email.trim(), password:form.password,
          nombre:form.nombre.trim(), telefono:form.telefono||null,
          role:form.role, color:form.color,
        }),
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json.error||"Error al crear usuario");
      onCreated();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={500}>
      <MHead title="Nuevo usuario" onClose={onClose}/>
      <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Nombre completo *"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()} placeholder="Nombre y apellidos"/></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()} placeholder="6XX XXX XXX"/></Field>
        </div>
        <Field label="Email *"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} style={inp()} placeholder="correo@empresa.com"/></Field>
        <Field label="Contraseña *"><input type="password" value={form.password} onChange={e=>upd("password",e.target.value)} style={inp()} placeholder="Mínimo 6 caracteres"/></Field>
        <Field label="Rol">
          <div style={{ display:"flex",gap:8 }}>
            {[{k:"admin",l:"Admin"},{k:"tecnico",l:"Técnico"}].map(r=>(
              <button type="button" key={r.k} onClick={()=>upd("role",r.k)}
                style={{ flex:1,padding:"10px",borderRadius:9,border:`2px solid ${form.role===r.k?T.accent:T.border}`,background:form.role===r.k?T.accent+"22":T.card,color:form.role===r.k?T.accent:T.sub,fontSize:13,fontWeight:form.role===r.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {r.k==="admin"?"Admin":"Técnico"}
              </button>
            ))}
          </div>
          <p style={{ fontSize:11,color:T.muted,marginTop:4 }}>{form.role==="admin"?"Acceso completo a toda la app.":"Ve sus averías, mantenimientos y contratos asignados."}</p>
        </Field>
        <Field label="Color identificativo">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {colores.map(c=>(
              <div key={c} onClick={()=>upd("color",c)} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #0f172a":"3px solid transparent",boxSizing:"border-box" }}/>
            ))}
          </div>
        </Field>
        {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
          <Btn ch="Cancelar" onClick={onClose} v="g"/>
          <Btn ch={saving?"Creando...":"Crear usuario"} onClick={crear} disabled={saving||!form.nombre.trim()||!form.email.trim()||!form.password.trim()}/>
        </div>
      </div>
    </Modal>
  );
}

function EditarUsuarioModal({ u, onClose, onSaved, colores }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const [form, setForm] = useState({ nombre:u.nombre||"", email:u.email||"", telefono:u.telefono||"", role:u.role||"tecnico", color:u.color||"#1d4ed8", activo:u.activo!==false, newPassword:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  async function guardar() {
    setSaving(true); setError("");
    try {
      const { error:profErr } = await supabase.from("profiles").update({
        nombre:form.nombre.trim(), telefono:form.telefono||null,
        role:form.role, color:form.color, activo:form.activo,
      }).eq("id",u.id);
      if(profErr) throw profErr;
      onSaved();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  async function eliminar() {
    if(!window.confirm(`¿Eliminar a ${u.nombre}? Perderá el acceso permanentemente.`)) return;
    setSaving(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/usuarios", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accion:"eliminar", userId:u.id }),
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json.error||"Error al eliminar");
      onSaved();
    } catch(e) { setError("Error: "+(e.message||"desconocido")); }
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} w={500}>
      <MHead title="Editar usuario" sub={u.email} onClose={onClose}/>
      <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Nombre completo"><input value={form.nombre} onChange={e=>upd("nombre",e.target.value)} style={inp()}/></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={e=>upd("telefono",e.target.value)} style={inp()}/></Field>
        </div>
        <Field label="Rol">
          <div style={{ display:"flex",gap:8 }}>
            {[{k:"admin",l:"Admin"},{k:"tecnico",l:"Técnico"}].map(r=>(
              <button type="button" key={r.k} onClick={()=>upd("role",r.k)}
                style={{ flex:1,padding:"10px",borderRadius:9,border:`2px solid ${form.role===r.k?T.accent:T.border}`,background:form.role===r.k?T.accent+"22":T.card,color:form.role===r.k?T.accent:T.sub,fontSize:13,fontWeight:form.role===r.k?700:400,cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                {r.l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color identificativo">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {colores.map(c=>(
              <div key={c} onClick={()=>upd("color",c)} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #0f172a":"3px solid transparent",boxSizing:"border-box" }}/>
            ))}
          </div>
        </Field>
        <div onClick={()=>upd("activo",!form.activo)}
          style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:form.activo?T.greenLight:T.redLight,borderRadius:10,border:`1px solid ${form.activo?"#bbf7d0":"#fecaca"}`,cursor:"pointer" }}>
          <div style={{ width:42,height:22,borderRadius:11,background:form.activo?T.green:T.red,position:"relative",transition:"background 0.2s",flexShrink:0 }}>
            <span style={{ position:"absolute",top:3,left:form.activo?22:3,width:16,height:16,borderRadius:"50%",background:T.card,transition:"left 0.2s" }}/>
          </div>
          <span style={{ fontSize:13,fontWeight:600,color:form.activo?T.green:T.red }}>{form.activo?"Usuario activo":"Usuario inactivo — no puede acceder"}</span>
        </div>
        {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
        <div style={{ display:"flex",justifyContent:"space-between",gap:8 }}>
          <Btn ch="Eliminar usuario" onClick={eliminar} v="d" sm/>
          <div style={{ display:"flex",gap:8 }}>
            <Btn ch="Cancelar" onClick={onClose} v="g"/>
            <Btn ch={saving?"Guardando...":"Guardar cambios"} onClick={guardar} disabled={saving||!form.nombre.trim()}/>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function UsuariosView({ techs, refresh, user, onTooltip }) {
  const isMobile = useIsMobile();
  const { T } = useTheme();
  const [showNew, setShowNew] = useState(false);
  const [editando, setEditando] = useState(null);

  const admins   = techs.filter(u=>u.role==="admin");
  const tecnicos = techs.filter(u=>u.role==="tecnico");

  return (
    <div style={{ padding:isMobile?12:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:isMobile?20:24,fontWeight:700,color:T.text,margin:"0 0 4px",fontFamily:"'Sora',sans-serif" }}>Usuarios</h1>
          <p style={{ color:T.muted,fontSize:13,margin:0 }}>{techs.length} usuarios · {admins.length} admins · {tecnicos.length} técnicos</p>
        </div>
        <button onClick={()=>onTooltip("personal")} title="Ayuda de Personal" style={{ width:32,height:32,borderRadius:"50%",background:T.surface,border:`1.5px solid ${T.border}`,color:T.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,marginRight:8 }}>?</button>
        <Btn ch="+ Nuevo usuario" onClick={()=>setShowNew(true)}/>
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:20,maxWidth:700 }}>
        {admins.length>0&&(
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>Administradores</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {admins.map(u=>(
                <div key={u.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:14 }}>
                  <Ava name={u.nombre||"?"} size={44} color={u.color||T.accent}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:2 }}>
                      {u.nombre}
                      {u.id===user.id&&<span style={{ fontSize:10,color:T.accent,fontWeight:600,marginLeft:8,padding:"1px 7px",borderRadius:20,background:T.accentLight }}>Tú</span>}
                    </div>
                    <div style={{ fontSize:12,color:T.muted,marginBottom:6 }}>{u.email}{u.telefono?` · ${u.telefono}`:""}</div>
                    <span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:"#fef3c7",color:"#92400e",fontWeight:600,border:"1px solid #fde68a" }}>Admin</span>
                    {!u.activo&&<span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.redLight,color:T.red,fontWeight:600,border:"1px solid #fecaca",marginLeft:6 }}>Inactivo</span>}
                  </div>
                  {u.id!==user.id&&<Btn ch="Editar" onClick={()=>setEditando(u)} v="g" sm/>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tecnicos.length>0&&(
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>Técnicos</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {tecnicos.map(u=>(
                <div key={u.id} style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px",display:"flex",alignItems:"center",gap:14 }}>
                  <Ava name={u.nombre||"?"} size={44} color={u.color||T.accent}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:2 }}>{u.nombre}</div>
                    <div style={{ fontSize:12,color:T.muted,marginBottom:6 }}>{u.email}{u.telefono?` · ${u.telefono}`:""}</div>
                    <span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.greenLight,color:T.green,fontWeight:600,border:"1px solid #bbf7d0" }}>Técnico</span>
                    {!u.activo&&<span style={{ fontSize:11,padding:"2px 10px",borderRadius:20,background:T.redLight,color:T.red,fontWeight:600,border:"1px solid #fecaca",marginLeft:6 }}>Inactivo</span>}
                  </div>
                  <Btn ch="Editar" onClick={()=>setEditando(u)} v="g" sm/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showNew&&<NuevoUsuarioModal onClose={()=>setShowNew(false)} onCreated={()=>{ refresh?.(); setShowNew(false); }} colores={COLORES}/>}
      {editando&&<EditarUsuarioModal u={editando} onClose={()=>setEditando(null)} onSaved={()=>{ refresh?.(); setEditando(null); }} colores={COLORES}/>}
    </div>
  );
}
