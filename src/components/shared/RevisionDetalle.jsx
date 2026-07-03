import React, { useState } from "react";
import { useTheme }  from "../../ThemeContext.jsx";
import { sendEmail } from "../../utils/links.js";
import { MT }        from "../../constants/status.js";
import Modal         from "../ui/Modal.jsx";
import MHead         from "../ui/MHead.jsx";
import Btn           from "../ui/Btn.jsx";

export default function RevisionDetalle({ rev, insts, cls, empresa={}, onClose }) {
  const { T } = useTheme();
  const mt=MT[rev.tipo]||{label:rev.tipo,color:T.teal};
  const inst=insts.find(i=>i.id===rev.instalacion_id);
  const cliente=cls.find(c=>c.id===rev.cliente_id);
  const items=(inst?.["items_"+rev.tipo])||[];
  const done=Object.values(rev.checks||{}).filter(Boolean).length;
  const total=Object.keys(rev.checks||{}).length;
  const [generando,setGenerando]=useState(false);

  async function generarPDF(yEnviar=false) {
    setGenerando(true);
    try {
      const JsPDF = await (async ()=>{
        if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
        return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); });
      })();
      const doc = new JsPDF({unit:"mm",format:"a4"});
      const rgb=rev.tipo==="mensual"?[13,148,136]:rev.tipo==="trimestral"?[217,119,6]:rev.tipo==="semestral"?[124,58,237]:[220,38,38];
      const [W,D,G,L]=[[255,255,255],[15,23,42],[100,116,139],[248,250,252]];
      // Header
      doc.setFillColor(...rgb); doc.rect(0,0,210,38,"F");
      doc.setTextColor(...W); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(empresa.nombre||"BLCH",12,13);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      if(empresa.cif) doc.text("CIF: "+empresa.cif,12,20);
      if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
      doc.setFontSize(11); doc.setFont("helvetica","bold");
      doc.text("PARTE MANTENIMIENTO "+mt.label.toUpperCase(),198,12,{align:"right"});
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text("N.º: "+(rev.num_parte||"—"),198,20,{align:"right"});
      doc.text("Fecha: "+rev.fecha,198,28,{align:"right"});
      // Client + installation
      let y=44;
      doc.setFillColor(...L); doc.rect(10,y,190,22,"F");
      doc.setTextColor(...D); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("CLIENTE",14,y+7); doc.text("INSTALACIÓN",105,y+7);
      doc.setFont("helvetica","normal"); doc.setFontSize(10);
      doc.text(rev.cliente_nombre||"—",14,y+15);
      doc.text(rev.instalacion_nombre||"—",105,y+15);
      doc.setFontSize(8); doc.setTextColor(...G);
      if(cliente?.telefono) doc.text(cliente.telefono,14,y+20);
      if(inst?.tipo) doc.text(inst.tipo+(inst.ubicacion?" · "+inst.ubicacion:""),105,y+20);
      y+=28;
      doc.setTextColor(...D); doc.setFontSize(9); doc.setFont("helvetica","normal");
      doc.text("Técnico: "+(rev.tecnico_nombre||"—"),14,y); y+=10;
      // Progress
      doc.setFillColor(...rgb); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text(`CHECKLIST — ${done}/${total} verificados`,14,y+5); y+=10;
      // Items
      items.forEach((item,i)=>{
        const checked=rev.checks?.[i]===true;
        if(i%2===0){ doc.setFillColor(...L); doc.rect(10,y-1,190,7,"F"); }
        if(checked){ doc.setFillColor(...rgb); } else { doc.setFillColor(200,200,200); }
        doc.rect(14,y,4,4,"F");
        doc.setTextColor(checked?D[0]:160,checked?D[1]:160,checked?D[2]:160);
        doc.setFont("helvetica","normal"); doc.setFontSize(9);
        doc.text(item,22,y+3.5); y+=8;
        if(y>255){ doc.addPage(); y=20; }
      });
      y+=4;
      if(rev.observaciones){
        const oLines=doc.splitTextToSize(rev.observaciones,178);
        doc.setFillColor(254,252,232); doc.rect(10,y,190,6+oLines.length*5.5,"F");
        doc.setTextColor(146,100,4); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.text("OBSERVACIONES:",14,y+5);
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(oLines,14,y+11); y+=12+oLines.length*5.5;
      }
      if(rev.firma_url){ doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G); doc.text("FIRMA:",14,y); y+=4; try{doc.addImage(rev.firma_url,"PNG",14,y,65,26);}catch(e){} }
      // Footer
      const ph=doc.internal.pageSize.height;
      doc.setFillColor(...D); doc.rect(0,ph-12,210,12,"F");
      doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
      doc.text((empresa.nombre||"")+(empresa.cif?" · CIF:"+empresa.cif:""),14,ph-5);
      if(empresa.cuenta_iban) doc.text("IBAN: "+empresa.cuenta_iban,105,ph-5,{align:"center"});
      doc.text((empresa.telefono||"")+(empresa.email?" · "+empresa.email:""),198,ph-5,{align:"right"});
      // Open PDF
      const blobUrl=doc.output("bloburl");
      window.open(blobUrl,"_blank");
      // Send email if requested
      if(yEnviar&&cliente?.email){
        setTimeout(()=>{
          const body=["PARTE DE MANTENIMIENTO "+mt.label.toUpperCase(),"","N.º Parte: "+(rev.num_parte||"—"),"Fecha: "+rev.fecha,"Instalación: "+rev.instalacion_nombre,"Cliente: "+rev.cliente_nombre,"Técnico: "+rev.tecnico_nombre,"","Checklist: "+done+"/"+total+" ítems verificados",rev.observaciones?"Observaciones: "+rev.observaciones:"","","El PDF del parte se adjunta a este correo."].join("\n");
          sendEmail({to:cliente.email,subject:`Parte mantenimiento ${mt.label} #${rev.num_parte} — ${rev.instalacion_nombre}`,body});
        },600);
      }
    } catch(e) { alert("Error al generar PDF. Permite ventanas emergentes en tu navegador."); }
    setGenerando(false);
  }

  return (<Modal onClose={onClose} w={620}>
    <MHead title={`Parte #${rev.num_parte} — Mantenimiento ${mt.label}`} sub={`${rev.instalacion_nombre} · ${rev.cliente_nombre}`} onClose={onClose}/>
    <div style={{ padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14 }}>
      <div style={{ background:T.surface,borderRadius:10,padding:"14px",border:`1px solid ${T.border}` }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
          {[["Técnico",rev.tecnico_nombre],["Fecha",rev.fecha],["Resultado",`${done}/${total} ítems`]].map(([l,v])=><div key={l}><div style={{ fontSize:10,color:T.muted,fontWeight:600,textTransform:"uppercase",marginBottom:4 }}>{l}</div><div style={{ fontSize:13,fontWeight:600,color:T.text }}>{v}</div></div>)}
        </div>
      </div>
      <div style={{ maxHeight:"35vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:3 }}>
        {items.map((item,i)=>{
          const checked=rev.checks?.[i]===true;
          return <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:7,background:checked?mt.color+"08":T.surface,border:`1px solid ${checked?mt.color+"30":T.border}` }}>
            <div style={{ width:18,height:18,borderRadius:4,flexShrink:0,background:checked?mt.color:T.border,display:"flex",alignItems:"center",justifyContent:"center" }}>{checked&&<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}</div>
            <span style={{ fontSize:12,color:checked?T.text:T.muted,flex:1 }}>{item}</span>
          </div>;
        })}
      </div>
      {rev.observaciones&&<div style={{ background:T.orange+"18",border:`1px solid ${T.orange}`,borderRadius:10,padding:"12px 14px" }}><div style={{ fontSize:11,fontWeight:600,color:T.orange,marginBottom:4 }}>Observaciones</div><div style={{ fontSize:13,color:T.orange }}>{rev.observaciones}</div></div>}
      {rev.firma_url&&<div><div style={{ fontSize:11,fontWeight:600,color:T.sub,marginBottom:6 }}>Firma del cliente</div><img src={rev.firma_url} alt="firma" style={{ maxWidth:260,borderRadius:8,border:`1px solid ${T.border}` }}/></div>}
      <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
        <Btn ch={generando?"Generando...":"Ver PDF"} onClick={()=>generarPDF(false)} v="b" disabled={generando}/>
        {cliente?.email&&<Btn ch="PDF + Enviar email" onClick={()=>generarPDF(true)} v="s" disabled={generando}/>}
      </div>
    </div>
  </Modal>);
}
