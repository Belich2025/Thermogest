import React from "react";
import { useTheme } from "../../ThemeContext.jsx";

function esErrorDeChunk(err) {
  const s = String(err?.name || "") + " " + String(err?.message || "");
  return /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(s);
}

class ChunkErrorBoundaryClass extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(e){ return {err:e}; }
  render(){
    if(this.state.err){
      const { T } = this.props;
      const chunk = esErrorDeChunk(this.state.err);
      return (
        <div style={{ padding:40, textAlign:"center", fontFamily:"'DM Sans',sans-serif" }}>
          <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:8 }}>
            {chunk ? "No se pudo cargar esta sección" : "Error en la sección"}
          </div>
          <div style={{ fontSize:13, color:T.muted, marginBottom:16 }}>
            {chunk ? "Comprueba tu conexión e inténtalo de nuevo." : String(this.state.err)}
          </div>
          <button onClick={()=>window.location.reload()}
            style={{ padding:"8px 18px", borderRadius:8, border:"none", background:T.accent, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ChunkErrorBoundary({ children }) {
  const { T } = useTheme();
  return <ChunkErrorBoundaryClass T={T}>{children}</ChunkErrorBoundaryClass>;
}
