export async function generarResumenObraPDF(partes, obra, cliente, empresa={}) {
  try {
    const JsPDF = await (async()=>{
      if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); });
    })();
    const doc = new JsPDF({unit:"mm",format:"a4"});
    const corp = empresa.color_corporativo||"#1d4ed8";
    const hr = h=>{ const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return [r,g,b]; };
    const [O,W,D,G,L] = [hr(corp),[255,255,255],[15,23,42],[100,116,139],[248,250,252]];
    const PW=210, M=14;
    let y=0;

    // Cabecera
    doc.setFillColor(...O); doc.rect(0,0,PW,42,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.setTextColor(...W);
    doc.text((empresa.nombre||"BLCH").toUpperCase(), M, 16);
    const sub=[empresa.telefono,empresa.email,empresa.web].filter(Boolean).join(" · ");
    if(sub){ doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(255,255,255); doc.text(sub,M,23); }
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...W);
    doc.text("RESUMEN DE PARTES", PW-M, 16, {align:"right"});
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"}), PW-M, 23, {align:"right"});
    y=42;

    // Cliente
    y+=8;
    doc.setFillColor(...L); doc.rect(M,y,PW-M*2,28,"F");
    doc.setDrawColor(220,224,232); doc.setLineWidth(0.3); doc.rect(M,y,PW-M*2,28,"S");
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...G);
    doc.text("CLIENTE", M+5, y+6);
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...D);
    doc.text(cliente?.nombre||"—", M+5, y+14);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
    const clInfo=[cliente?.telefono,cliente?.email,cliente?.direccion].filter(Boolean).join(" | ");
    if(clInfo) doc.text(clInfo, M+5, y+21);
    y+=36;

    // Instalación
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...O);
    doc.text("INSTALACIÓN / OBRA", M, y);
    doc.setDrawColor(...O); doc.setLineWidth(0.5); doc.line(M,y+2,PW-M,y+2);
    y+=7;
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...D);
    const descLines=doc.splitTextToSize(obra.descripcion||"Sin descripción.", PW-M*2);
    descLines.forEach(l=>{ doc.text(l,M,y); y+=5.5; });
    y+=4;

    // Partes — cabecera tabla
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...O);
    doc.text("PARTES DE TRABAJO", M, y);
    doc.setDrawColor(...O); doc.setLineWidth(0.5); doc.line(M,y+2,PW-M,y+2);
    y+=8;
    doc.setFillColor(...O); doc.rect(M,y,PW-M*2,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...W);
    doc.text("Técnico", M+3, y+5);
    doc.text("Fecha", M+58, y+5);
    doc.text("Horas", M+88, y+5);
    doc.text("Importe", PW-M-3, y+5, {align:"right"});
    y+=7;

    let totalBase=0;
    partes.forEach((p,i)=>{
      if(y>265){ doc.addPage(); y=20; }
      doc.setFillColor(...(i%2===0?L:[255,255,255])); doc.rect(M,y,PW-M*2,8,"F");
      const h=(p.hora_inicio&&p.hora_fin)?(()=>{ const [h1,m1]=p.hora_inicio.split(":").map(Number),[h2,m2]=p.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0;
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...D);
      doc.text(p.tecnico_nombre||"—", M+3, y+5.5);
      doc.text(p.fecha?.split("-").reverse().join("/")||"—", M+58, y+5.5);
      doc.text(h>0?`${h.toFixed(1)}h`:"—", M+88, y+5.5);
      doc.setFont("helvetica","bold");
      doc.text(`${(p.importe_total||0).toFixed(2)} €`, PW-M-3, y+5.5, {align:"right"});
      totalBase+=parseFloat(p.importe_total)||0;
      y+=8;
    });

    // Totales
    y+=4;
    const iva=totalBase*0.21;
    const total=totalBase+iva;
    const tblX=PW-M-70, tblW=70;
    doc.setFillColor(...L); doc.rect(tblX,y,tblW,8,"F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
    doc.text("Base imponible", tblX+4, y+5.5);
    doc.setFont("helvetica","bold"); doc.setTextColor(...D);
    doc.text(`${totalBase.toFixed(2)} €`, tblX+tblW-4, y+5.5, {align:"right"});
    y+=8;
    doc.setFillColor(...L); doc.rect(tblX,y,tblW,8,"F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
    doc.text("IVA (21%)", tblX+4, y+5.5);
    doc.setFont("helvetica","bold"); doc.setTextColor(...D);
    doc.text(`${iva.toFixed(2)} €`, tblX+tblW-4, y+5.5, {align:"right"});
    y+=8;
    doc.setFillColor(...O); doc.rect(tblX,y,tblW,10,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...W);
    doc.text("TOTAL", tblX+4, y+7);
    doc.text(`${total.toFixed(2)} €`, tblX+tblW-4, y+7, {align:"right"});

    // Pie
    const pieY=287;
    doc.setFillColor(...O); doc.rect(0,pieY-6,PW,12,"F");
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...W);
    doc.text(empresa.nombre||"BLCH", M, pieY);
    const pieR=[empresa.telefono,empresa.email].filter(Boolean).join(" · ");
    if(pieR) doc.text(pieR, PW-M, pieY, {align:"right"});

    doc.save(`resumen_partes_obra_${obra.id}.pdf`);
  } catch(err){ console.error("generarResumenObraPDF error:",err); alert("Error generando PDF: "+err.message); }
}
