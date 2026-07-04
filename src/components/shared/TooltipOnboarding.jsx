import React from "react";
import { useTheme } from "../../ThemeContext.jsx";

export default function TooltipOnboarding({ id, titulo, descripcion, onClose }) {
  const { T } = useTheme();
  return (
    <div style={{
      position:"fixed", bottom: 80, right: 24, zIndex:1200,
      background:T.accent, color:"#fff", borderRadius:14,
      padding:"16px 20px", maxWidth:320, boxShadow:"0 8px 32px rgba(0,0,0,0.18)",
      animation:"slideUp 0.3s ease"
    }}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700, fontSize:14, marginBottom:6}}>{titulo}</div>
          <div style={{fontSize:12, opacity:0.9, lineHeight:1.5}}>{descripcion}</div>
        </div>
        <button onClick={onClose}
          style={{background:"none", border:"none", color:"#fff", cursor:"pointer",
            fontSize:18, opacity:0.8, padding:0, flexShrink:0}}>✕</button>
      </div>
      <button onClick={onClose}
        style={{marginTop:12, padding:"6px 16px", borderRadius:8,
          background:"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)",
          color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600, width:"100%"}}>
        Entendido
      </button>
    </div>
  );
}
