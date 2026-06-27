import { useTheme } from "../../ThemeContext.jsx";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export default function Modal({ onClose, children, w=660, zIndex=200 }) {
  const { T } = useTheme();
  const isMobile = useIsMobile();
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed",inset:0,zIndex,background:"rgba(15,23,42,0.45)",backdropFilter:"blur(6px)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:16 }}
    >
      <div style={{ width:"100%",maxWidth:w,maxHeight:"92vh",overflowY:"auto",borderRadius:isMobile?"16px 16px 0 0":"14px",background:T.card,border:`1px solid ${T.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.15)",paddingBottom:isMobile?80:20 }}>
        {children}
      </div>
    </div>
  );
}
