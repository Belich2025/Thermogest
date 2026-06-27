import { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../supabase.js";
import { mkInp } from "../../utils/styles.js";
import Field from "../ui/Field.jsx";

export default function Login({ onLogin }) {
  const { T } = useTheme();
  const isMobile = useIsMobile();
  const inp = mkInp(T);

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasNotif = "Notification" in window;
  const [notifPerm, setNotifPerm] = useState(hasNotif ? Notification.permission : "unsupported");

  async function activarNotificaciones() {
    const p = await Notification.requestPermission();
    console.log("Permiso notificaciones:", p);
    setNotifPerm(p);
  }

  async function submit(e) {
    e.preventDefault(); if(!email||!pw) return;
    setLoading(true); setError("");
    const { data, error:err } = await supabase.auth.signInWithPassword({ email:email.trim(), password:pw });
    if (err) { setError("Email o contraseña incorrectos"); setLoading(false); return; }
    const { data:profile } = await supabase.from("profiles").select("*").eq("id",data.user.id).single();
    if (!profile||!profile.activo) { await supabase.auth.signOut(); setError("Usuario inactivo."); setLoading(false); return; }
    onLogin(profile); setLoading(false);
  }

  const notifBtn = hasNotif && notifPerm !== "unsupported" && (
    <button type="button" onClick={activarNotificaciones}
      style={{ width:"100%",padding:"11px",borderRadius:10,border:`1.5px solid ${notifPerm==="granted"?"#bbf7d0":"#bfdbfe"}`,background:notifPerm==="granted"?"#f0fdf4":"#eff6ff",color:notifPerm==="granted"?"#15803d":notifPerm==="denied"?"#dc2626":"#1d4ed8",fontSize:14,fontWeight:600,cursor:notifPerm==="granted"||notifPerm==="denied"?"default":"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
      {notifPerm==="granted" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
      {notifPerm==="denied"  && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
      {notifPerm==="default" && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
      {notifPerm==="granted" ? "Notificaciones activadas" : notifPerm==="denied" ? "Notificaciones bloqueadas (actívalas en ajustes)" : "Activar notificaciones"}
    </button>
  );

  return (
    <div style={{ minHeight:"100vh",background:T.bg,display:"flex",flexDirection:isMobile?"column":"row",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:isMobile?"100%":"40%",background:"linear-gradient(160deg,#1e3a8a,#1d4ed8)",display:"flex",flexDirection:"column",justifyContent:"center",padding:isMobile?"32px 24px":"60px 48px",minHeight:isMobile?"auto":"100vh" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:32 }}><div style={{ width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff" }}>BL</div><div><div style={{ fontSize:17,fontWeight:700,color:"#fff",fontFamily:"'Sora',sans-serif" }}>BLCH</div><div style={{ fontSize:10,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em" }}>Gestión Técnica</div></div></div>
        {!isMobile&&<><h1 style={{ fontSize:28,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:12,fontFamily:"'Sora',sans-serif" }}>Calefacción &<br/>Climatización</h1><p style={{ color:"rgba(255,255,255,0.65)",fontSize:14,lineHeight:1.7,maxWidth:280 }}>Plataforma de gestión de averías, presupuestos, instalaciones y mantenimiento preventivo.</p></>}
      </div>
      <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"28px 20px 40px":"40px 48px" }}>
        <div style={{ width:"100%",maxWidth:380 }}>
          <h2 style={{ fontSize:22,fontWeight:700,color:T.text,marginBottom:6,fontFamily:"'Sora',sans-serif" }}>Acceder</h2>
          <p style={{ color:T.muted,fontSize:14,marginBottom:28 }}>Introduce tus credenciales</p>
          <form onSubmit={submit} style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp()} placeholder="correo@empresa.com" autoComplete="email"/></Field>
            <Field label="Contraseña"><input type="password" value={pw} onChange={e=>setPw(e.target.value)} style={inp()} placeholder="••••••••" autoComplete="current-password"/></Field>
            {error&&<div style={{ padding:"10px 14px",background:T.redLight,border:"1px solid #fecaca",borderRadius:8,fontSize:13,color:T.red }}>{error}</div>}
            <button type="submit" disabled={loading||!email||!pw} style={{ width:"100%",padding:"12px",borderRadius:10,border:"none",background:T.accent,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:loading?0.7:1,marginTop:4 }}>{loading?"Accediendo...":"Acceder"}</button>
            {notifBtn}
          </form>
        </div>
      </div>
    </div>
  );
}
