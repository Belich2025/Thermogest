import { useTheme } from "../../ThemeContext.jsx";

export default function Ava({ name="?", size=32, color }) {
  const { T } = useTheme();
  const c = color || T.accent;
  const p = (name || "?").trim().split(" ");
  const i = ((p[0] || "")[0] || "") + ((p[1] || "")[0] || "");
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",flexShrink:0,background:c+"16",border:`1.5px solid ${c}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.36,fontWeight:700,color:c,fontFamily:"'Sora',sans-serif" }}>
      {i.toUpperCase() || "?"}
    </div>
  );
}
