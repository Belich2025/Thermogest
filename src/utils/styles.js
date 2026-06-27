export const mkInp = (T) => (x={}) => ({
  width:"100%", boxSizing:"border-box", background:T.input,
  border:`1.5px solid ${T.border}`, borderRadius:8, padding:"9px 12px",
  color:T.text, fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif",
  transition:"border-color 0.15s", ...x,
});
