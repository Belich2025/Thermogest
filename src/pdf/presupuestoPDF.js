import { getTextColor } from "../utils/color.js";

export async function generarPresupuestoPDF(pres, cliente, empresa={}) {
  try {
    const JsPDF = await (async()=>{
      if(window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=()=>res(window.jspdf.jsPDF); s.onerror=rej; document.head.appendChild(s); });
    })();
    const doc = new JsPDF({unit:"mm",format:"a4"});
    const corp = empresa.color_corporativo||"#1d4ed8";
    const hr = h=>{ const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return [r,g,b]; };
    const [O,D,G,L] = [hr(corp),[15,23,42],[100,116,139],[248,250,252]];
    const W = getTextColor(empresa.color_corporativo || '#1d4ed8');
    const PW=210, M=14;
    let y=0;

    // ── Cabecera ────────────────────────────────────────────────────────────
    doc.setFillColor(...O); doc.rect(0,0,PW,36,"F");
    if(empresa.logo_url) {
      try {
        const logoImg = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = empresa.logo_url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = logoImg.naturalWidth;
        canvas.height = logoImg.naturalHeight;
        canvas.getContext("2d").drawImage(logoImg, 0, 0);
        const logoData = canvas.toDataURL("image/png");
        const maxW = 22, maxH = 16;
        const ratio = Math.min(maxW/logoImg.naturalWidth*3.7795, maxH/logoImg.naturalHeight*3.7795);
        const lw = (logoImg.naturalWidth * ratio)/3.7795;
        const lh = (logoImg.naturalHeight * ratio)/3.7795;
        doc.addImage(logoData, "PNG", 12, 6, lw, lh);
        doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
        doc.text(empresa.nombre||"BLCH", 12, 6+lh+4);
        doc.setFontSize(7); doc.setFont("helvetica","normal");
        if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,6+lh+9);
        if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,6+lh+14);
        if(empresa.direccion)doc.text(empresa.direccion,12,6+lh+19);
      } catch(e) {
        doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
        doc.text(empresa.nombre||"BLCH", 12, 13);
        doc.setFontSize(8); doc.setFont("helvetica","normal");
        if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,20);
        if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
        if(empresa.direccion)doc.text(empresa.direccion,12,33);
      }
    } else {
      doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
      doc.text(empresa.nombre||"BLCH", 12, 13);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      if(empresa.cif)      doc.text("CIF: "+empresa.cif,12,20);
      if(empresa.telefono) doc.text("Tel: "+empresa.telefono+(empresa.email?" · "+empresa.email:""),12,27);
      if(empresa.direccion)doc.text(empresa.direccion,12,33);
    }

    // Número presupuesto + fecha (arriba derecha)
    const numStr = pres.num_presupuesto ? `PRESUPUESTO Nº ${pres.num_presupuesto}` : `PRESUPUESTO #${pres.id}`;
    const fechaStr = new Date(pres.updated_at||pres.created_at||Date.now()).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...W);
    doc.text(numStr, PW-M, 16, {align:"right"});
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(fechaStr, PW-M, 23, {align:"right"});

    y=36;

    // ── Sección cliente ─────────────────────────────────────────────────────
    y+=8;
    doc.setFillColor(...L); doc.rect(M,y,PW-M*2,28,"F");
    doc.setDrawColor(220,224,232); doc.setLineWidth(0.3); doc.rect(M,y,PW-M*2,28,"S");

    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...G);
    doc.text("DATOS DEL CLIENTE", M+5, y+6);
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...D);
    doc.text(cliente?.nombre||"—", M+5, y+14);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
    const clInfo = [cliente?.telefono, cliente?.email, cliente?.direccion].filter(Boolean).join(" | ");
    if(clInfo) doc.text(clInfo, M+5, y+21);

    y+=36;

    // ── Descripción del trabajo ─────────────────────────────────────────────
    doc.setFillColor(...O); doc.rect(M,y,PW-M*2,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...W);
    doc.text("DESCRIPCIÓN DEL TRABAJO", M+4, y+5); y+=10;

    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...D);
    const descLines = doc.splitTextToSize(pres.descripcion||"Sin descripción.", PW-M*2);
    descLines.forEach(line=>{ doc.text(line,M,y); y+=5.5; });
    y+=4;

    // ── Conceptos del presupuesto ───────────────────────────────────────────
    const lineas = (pres.lineas||[]).filter(l=>l.concepto?.trim());
    if(lineas.length > 0){
      doc.setFillColor(...O); doc.rect(M,y,PW-M*2,7,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...W);
      doc.text("CONCEPTOS DEL PRESUPUESTO", M+4, y+5); y+=9;
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      lineas.forEach((l,idx)=>{
        if(idx%2===0){ doc.setFillColor(...L); doc.rect(M,y-1,PW-M*2,7,"F"); }
        doc.setTextColor(...D);
        doc.text((l.concepto||"—").slice(0,90), M+4, y+4);
        y+=7;
        if(y>250){ doc.addPage(); y=20; }
      });
      y+=4;
    }

    // ── Totales ─────────────────────────────────────────────────────────────
    const aplicarIva = pres.aplicar_iva !== false;
    const base = parseFloat(pres.importe)||0;
    const iva = aplicarIva ? base*0.21 : 0;
    const total = base + iva;

    const tblX = PW-M-70;
    const tblW = 70;

    // Subtotal
    doc.setFillColor(...L); doc.rect(tblX,y,tblW,8,"F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
    doc.text("Base imponible", tblX+4, y+5.5);
    doc.setFont("helvetica","bold"); doc.setTextColor(...D);
    doc.text(`${base.toFixed(2)} €`, tblX+tblW-4, y+5.5, {align:"right"});
    y+=8;

    if(aplicarIva){
      doc.setFillColor(...L); doc.rect(tblX,y,tblW,8,"F");
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
      doc.text("IVA (21%)", tblX+4, y+5.5);
      doc.setFont("helvetica","bold"); doc.setTextColor(...D);
      doc.text(`${iva.toFixed(2)} €`, tblX+tblW-4, y+5.5, {align:"right"});
      y+=8;
    }

    // Total
    doc.setFillColor(...O); doc.rect(tblX,y,tblW,10,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...W);
    doc.text("TOTAL", tblX+4, y+7);
    doc.text(`${total.toFixed(2)} €`, tblX+tblW-4, y+7, {align:"right"});
    y+=18;

    // ── Condiciones / Notas ─────────────────────────────────────────────────
    if(pres.notas && pres.notas.trim()){
      doc.setFillColor(...O); doc.rect(M,y,PW-M*2,7,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...W);
      doc.text("CONDICIONES Y NOTAS", M+4, y+5); y+=10;
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...G);
      const notaLines = doc.splitTextToSize(pres.notas.trim(), PW-M*2);
      notaLines.forEach(line=>{ doc.text(line,M,y); y+=5; });
      y+=6;
    }

    // Validez presupuesto
    doc.setFont("helvetica","italic"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.text("Este presupuesto tiene una validez de 30 días desde la fecha de emisión.", M, y);
    y+=10;

    // ── Firma de aceptación ─────────────────────────────────────────────────
    // Asegurar que cabe en la página actual
    if(y > 230){ doc.addPage(); y=20; }

    doc.setDrawColor(220,224,232); doc.setLineWidth(0.3);
    const firmaBoxY = y;
    doc.rect(M, firmaBoxY, PW-M*2, 40, "S");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G);
    doc.text("ACEPTACIÓN DEL PRESUPUESTO", M+4, firmaBoxY+7);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...G);
    doc.text("En conformidad con el presupuesto presentado, el cliente acepta las condiciones expuestas.", M+4, firmaBoxY+14);

    // Línea firma cliente
    doc.setDrawColor(...G); doc.setLineWidth(0.4);
    doc.line(M+4, firmaBoxY+32, M+80, firmaBoxY+32);
    doc.setFontSize(7.5);
    doc.text("Firma y fecha del cliente", M+4, firmaBoxY+37);

    // Línea firma empresa
    doc.line(PW-M-76, firmaBoxY+32, PW-M-4, firmaBoxY+32);
    doc.text("Sello y firma de la empresa", PW-M-76, firmaBoxY+37);

    y = firmaBoxY+46;

    // ── Pie de página ───────────────────────────────────────────────────────
    const pieY = 287;
    doc.setFillColor(...O); doc.rect(0, pieY-6, PW, 12, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...W);
    const pieLeft = (empresa.nombre||"BLCH");
    const pieRight = [empresa.telefono, empresa.email].filter(Boolean).join(" · ");
    doc.text(pieLeft, M, pieY);
    if(pieRight) doc.text(pieRight, PW-M, pieY, {align:"right"});

    // ── Descargar ───────────────────────────────────────────────────────────
    const num = pres.num_presupuesto || pres.id;
    doc.save(`presupuesto_${num}.pdf`);
  } catch(err) {
    console.error("generarPresupuestoPDF error:", err);
    alert("Error generando el PDF: "+err.message);
  }
}
