import { useTheme } from "../../ThemeContext.jsx";

function guardarContacto(cliente) {
  if (!cliente) return;
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${cliente.nombre||""}`,
    `N:${(cliente.nombre||"").split(" ").slice(1).join(" ")};${(cliente.nombre||"").split(" ")[0]};;;`,
    cliente.telefono ? `TEL;TYPE=CELL:${cliente.telefono}` : "",
    cliente.email    ? `EMAIL:${cliente.email}` : "",
    cliente.direccion? `ADR:;;${cliente.direccion};;;;` : "",
    "END:VCARD"
  ].filter(Boolean).join("\n");
  const blob = new Blob([vcf], { type: "text/vcard" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${cliente.nombre||"contacto"}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BtnContacto({ cliente, size=36 }) {
  const { T } = useTheme();
  if (!cliente?.nombre) return null;
  return (
    <button onClick={()=>guardarContacto(cliente)} title="Guardar contacto"
      style={{ width:size,height:size,borderRadius:8,background:T.greenLight,border:"1.5px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    </button>
  );
}
