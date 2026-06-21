export async function generarPresupuestoPDF(pres, cliente, empresa={}) {
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

    // ── Cabecera ────────────────────────────────────────────────────────────
    doc.setFillColor(...O); doc.rect(0,0,PW,42,"F");

    // Nombre empresa
    doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.setTextColor(...W);
    doc.text((empresa.nombre||"BLCH").toUpperCase(), M, 16);

    // Subtítulo empresa
    const sub = [empresa.telefono, empresa.email, empresa.web].filter(Boolean).join(" · ");
    if(sub){ doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(255,255,255); doc.text(sub, M, 23); }

    // Número presupuesto + fecha (arriba derecha)
    const numStr = pres.num_presupuesto ? `PRESUPUESTO Nº ${pres.num_presupuesto}` : `PRESUPUESTO #${pres.id}`;
    const fechaStr = pres.created_at ? new Date(pres.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"}) : new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...W);
    doc.text(numStr, PW-M, 16, {align:"right"});
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text(fechaStr, PW-M, 23, {align:"right"});

    y=42;

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
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...O);
    doc.text("DESCRIPCIÓN DEL TRABAJO", M, y);
    doc.setDrawColor(...O); doc.setLineWidth(0.5); doc.line(M,y+2,PW-M,y+2);
    y+=7;

    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...D);
    const descLines = doc.splitTextToSize(pres.descripcion||"Sin descripción.", PW-M*2);
    descLines.forEach(line=>{ doc.text(line,M,y); y+=5.5; });
    y+=4;

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
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...O);
      doc.text("CONDICIONES Y NOTAS", M, y);
      doc.setDrawColor(...O); doc.setLineWidth(0.5); doc.line(M,y+2,PW-M,y+2);
      y+=7;
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
