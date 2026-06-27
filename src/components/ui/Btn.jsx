import { useTheme } from "../../ThemeContext.jsx";

export default function Btn({ ch, onClick, v="p", sm, disabled, full }) {
  const { T } = useTheme();
  const styles = {
    p: { background:T.accent,    color:"#fff",     border:"none" },
    g: { background:T.card,      color:T.sub,      border:`1.5px solid ${T.border}` },
    d: { background:T.redLight,  color:T.red,      border:`1.5px solid ${T.red}40` },
    s: { background:T.greenLight,color:T.green,    border:`1.5px solid ${T.green}40` },
    b: { background:T.accentLight,color:T.accent,  border:`1.5px solid ${T.accent}40` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:sm?"5px 13px":"9px 18px",width:full?"100%":undefined,fontSize:sm?12:13,fontWeight:600,borderRadius:8,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,fontFamily:"'DM Sans',sans-serif",...(styles[v]||styles.p) }}
    >
      {ch}
    </button>
  );
}
