import React, { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { supabase } from "../../supabase.js";

export default function BotonNomina({ n }) {
  const { T } = useTheme();
  const [cargando, setCargando] = useState(false);
  async function abrir() {
    setCargando(true);
    const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(n.archivo_url, 3600);
    setCargando(false);
    if (error) { alert("No se pudo generar el enlace: " + error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  return (
    <button onClick={abrir} disabled={cargando}
      style={{ padding:"8px 16px",borderRadius:9,background:T.accentLight,border:"1.5px solid "+T.accent+"40",
               color:T.accent,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",
               flexShrink:0,opacity:cargando?0.6:1 }}>
      {cargando ? "Cargando…" : "Ver / Descargar"}
    </button>
  );
}
