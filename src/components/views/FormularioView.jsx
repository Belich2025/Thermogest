import React, { useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export default function FormularioView({ data, empresa }) {
  const { T } = useTheme();
  const inp = mkInp(T);

  const [query, setQuery] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [showDrop, setShowDrop] = useState(false);
  const isMobile = useIsMobile();

  const clientes = data.clientes || [];
  const filtrados = query.length > 1
    ? clientes.filter(c =>
        (c.nombre||"").toLowerCase().includes(query.toLowerCase()) ||
        (c.telefono||"").replace(/\s/g,"").includes(query.replace(/\s/g,""))
      ).slice(0,8)
    : [];

  const telefonoFinal = clienteSel?.telefono || query.replace(/\D/g,"");
  const nombreFinal = clienteSel?.nombre || "";
  const enlace = window.location.origin + "/contacto";
  const mensaje = encodeURIComponent(
    (nombreFinal ? "Hola " + nombreFinal + ",\n\n" : "Hola,\n\n") +
    "Te enviamos nuestro formulario de contacto para gestionar tu solicitud. Por favor, rellénalo cuando puedas:\n\n" +
    enlace + "\n\nGracias,\n" + (empresa?.nombre || "")
  );
  const waUrl = "https://wa.me/" + telefonoFinal.replace(/\D/g,"") + "?text=" + mensaje;

  return (
    <div style={{ padding: isMobile?12:28, maxWidth:500 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:T.text, margin:0 }}>Formulario</h1>
        <p style={{ fontSize:13, color:T.muted, marginTop:4 }}>
          Envía el formulario de contacto a un cliente por WhatsApp
        </p>
      </div>

      {/* Buscador de cliente */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.muted, marginBottom:6, letterSpacing:1 }}>
          CLIENTE
        </div>
        <div style={{ position:"relative" }}>
          <input
            value={clienteSel ? clienteSel.nombre + (clienteSel.telefono?" · "+clienteSel.telefono:"") : query}
            onChange={e=>{ setQuery(e.target.value); setClienteSel(null); setShowDrop(true); }}
            onFocus={()=>setShowDrop(true)}
            placeholder="Buscar por nombre o teléfono..."
            style={{...inp(), width:"100%"}}
          />
          {clienteSel && (
            <button onClick={()=>{ setClienteSel(null); setQuery(""); }}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18}}>×</button>
          )}
          {showDrop && filtrados.length>0 && !clienteSel && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.card,
              border:`1px solid ${T.border}`,borderRadius:8,zIndex:100,boxShadow:"0 4px 12px #0002",
              maxHeight:200,overflowY:"auto"}}>
              {filtrados.map(c=>(
                <div key={c.id} onClick={()=>{ setClienteSel(c); setQuery(""); setShowDrop(false); }}
                  style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,
                    fontSize:13,color:T.text}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                  onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                  <div style={{fontWeight:600}}>{c.nombre} {c.apellidos||""}</div>
                  {c.telefono&&<div style={{fontSize:11,color:T.muted}}>{c.telefono}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {!clienteSel && query.length>1 && filtrados.length===0 && (
          <div style={{fontSize:12,color:T.muted,marginTop:6}}>
            Cliente no encontrado — se creará nuevo al rellenar el formulario
          </div>
        )}
      </div>

      {/* Info del cliente seleccionado */}
      {clienteSel && (
        <div style={{background:T.surface,borderRadius:10,padding:"12px 14px",
          border:`1px solid ${T.border}`,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>{clienteSel.nombre} {clienteSel.apellidos||""}</div>
          {clienteSel.telefono&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{clienteSel.telefono}</div>}
          {clienteSel.email&&<div style={{fontSize:12,color:T.muted}}>{clienteSel.email}</div>}
        </div>
      )}

      {/* Número manual si no hay cliente */}
      {!clienteSel && (
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,marginBottom:6,letterSpacing:1}}>
            TELÉFONO
          </div>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Ej: 612345678"
            style={{...inp(),width:"100%"}}
          />
        </div>
      )}

      {/* Botón enviar */}
      <a
        href={telefonoFinal.replace(/\D/g,"").length >= 9 ? waUrl : undefined}
        target="_blank" rel="noopener noreferrer"
        onClick={e=>{ if(telefonoFinal.replace(/\D/g,"").length < 9) e.preventDefault(); }}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          padding:"14px", borderRadius:12, textDecoration:"none",
          background: telefonoFinal.replace(/\D/g,"").length >= 9 ? T.green : T.border,
          color:"#fff", fontWeight:700, fontSize:15,
          cursor: telefonoFinal.replace(/\D/g,"").length >= 9 ? "pointer" : "not-allowed",
          transition:"all 0.15s"
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.021.502 3.927 1.385 5.604L0 24l6.545-1.371A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.032-1.387l-.361-.214-3.733.979.998-3.648-.235-.374A9.818 9.818 0 1112 21.818z"/>
        </svg>
        Enviar formulario por WhatsApp
      </a>

      {telefonoFinal.replace(/\D/g,"").length < 9 && (
        <div style={{fontSize:12,color:T.muted,textAlign:"center",marginTop:8}}>
          Introduce un teléfono válido para enviar
        </div>
      )}
    </div>
  );
}
