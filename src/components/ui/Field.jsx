import { useTheme } from "../../ThemeContext.jsx";

export default function Field({ label, children }) {
  const { T } = useTheme();
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
      <label style={{ fontSize:11,fontWeight:600,color:T.sub }}>{label}</label>
      {children}
    </div>
  );
}
