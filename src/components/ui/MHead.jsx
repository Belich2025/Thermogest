import { useTheme } from "../../ThemeContext.jsx";

export default function MHead({ title, sub, onClose }) {
  const { T } = useTheme();
  return (
    <div style={{ padding:"16px 18px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0 }}>
      <div>
        <h2 style={{ margin:0,fontSize:16,fontWeight:700,color:T.text,fontFamily:"'Sora',sans-serif" }}>{title}</h2>
        {sub && <p style={{ margin:"3px 0 0",fontSize:12,color:T.muted }}>{sub}</p>}
      </div>
      <button onClick={onClose} style={{ background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:20,flexShrink:0 }}>×</button>
    </div>
  );
}
