import { useTheme } from "../../ThemeContext.jsx";

export default function Badge({ status, type="b" }) {
  const { T, BS, PS } = useTheme();
  const s = (type==="b" ? BS : PS)[status] || { label:status, color:T.muted };
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:s.color+"14",border:`1px solid ${s.color}28`,color:s.color,whiteSpace:"nowrap" }}>
      <span style={{ width:5,height:5,borderRadius:"50%",background:s.color }}/>
      {s.label}
    </span>
  );
}
