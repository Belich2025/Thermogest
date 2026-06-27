export default function BadgeProg({ fecha }) {
  if(!fecha) return null;
  const dd = fecha.slice(8,10)+"/"+fecha.slice(5,7);
  return <span style={{ fontSize:10,padding:"2px 9px",borderRadius:20,background:"#ecfdf5",border:"1px solid #6ee7b7",color:"#047857",fontWeight:700,whiteSpace:"nowrap",flexShrink:0 }}>Prog. {dd}</span>;
}
