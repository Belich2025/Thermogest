import React from "react";
import { useTheme } from "../../ThemeContext.jsx";

class ErrorBoundaryClass extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(e){ return {err:e}; }
  render(){
    if(this.state.err)
      return (
        <div style={{ padding:24,background:this.props.redLight,border:"1px solid #fecaca",borderRadius:12,margin:20 }}>
          <div style={{ fontWeight:700,color:this.props.red,marginBottom:8 }}>Error en el componente</div>
          <pre style={{ fontSize:11,color:this.props.red,whiteSpace:"pre-wrap" }}>{String(this.state.err)}</pre>
        </div>
      );
    return this.props.children;
  }
}

export default function ErrorBoundary({ children }) {
  const { T } = useTheme();
  return <ErrorBoundaryClass red={T.red} redLight={T.redLight}>{children}</ErrorBoundaryClass>;
}
