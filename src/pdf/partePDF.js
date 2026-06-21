import { getTextColor } from "../utils/color.js";

export async function generarPartePDF(parte, averia, cliente, empresa={}, titulo="PARTE DE TRABAJO") {
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
    const horas = (parte.hora_inicio&&parte.hora_fin)?(()=>{ const [h1,m1]=parte.hora_inicio.split(":").map(Number),[h2,m2]=parte.hora_fin.split(":").map(Number); return Math.max(0,((h2*60+m2)-(h1*60+m1))/60); })():0;
    const ph = parseFloat(parte.precio_hora||0);
    const tMO = horas*ph;
    const mats = (parte.materiales||[]).filter(m=>m.desc);
    const tMat = mats.reduce((s,m)=>s+(parseFloat(m.qty||0)*parseFloat(m.precio||0)),0);
    const base = tMO+tMat;
    const iva = parte.aplicar_iva!==false ? base*0.21 : 0;
    const total = base+iva;

    // ── 1. CABECERA EMPRESA ──
    doc.setFillColor(...O); doc.rect(0,0,210,36,"F");
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
    doc.setFontSize(12); doc.setFont("helvetica","bold");
    doc.text(titulo,198,12,{align:"right"});
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("Nº: "+String(averia.id||""),198,20,{align:"right"});
    doc.text("Fecha: "+(parte.fecha||new Date().toLocaleDateString("es-ES")),198,27,{align:"right"});
    if(parte.forma_pago) doc.text("Pago: "+({efectivo:"Efectivo",tarjeta:"Tarjeta",transferencia:"Transferencia"}[parte.forma_pago]||""),198,34,{align:"right"});

    // ── 2. CLIENTE + AVERÍA ──
    let y=42;
    const extraClienteLines=(cliente?.dni?1:0)+(cliente?.email?1:0)+(cliente?.direccion?1:0);
    const clienteBoxH=20+extraClienteLines*5;
    doc.setFillColor(...L); doc.rect(10,y,190,clienteBoxH,"F");
    doc.setTextColor(...D); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("CLIENTE",14,y+6); doc.text("EQUIPO / AVERÍA",105,y+6);
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    doc.text(cliente?.nombre?(cliente.nombre+(cliente.apellidos?" "+cliente.apellidos:"")):"—",14,y+13);
    doc.setFontSize(8); doc.setTextColor(...G);
    let cy=y+13;
    if(cliente?.telefono){ cy+=5; doc.text(cliente.telefono,14,cy); }
    if(cliente?.dni){ cy+=5; doc.text("DNI/NIF: "+cliente.dni,14,cy); }
    if(cliente?.email){ cy+=5; doc.text(cliente.email,14,cy); }
    if(cliente?.direccion){ cy+=5; doc.text(cliente.direccion.slice(0,45),14,cy); }
    doc.setFontSize(9); doc.setTextColor(...D);
    doc.text((averia.equipo||"—").slice(0,35),105,y+13);
    y+=clienteBoxH+6;

    // ── 3. DESCRIPCIÓN DEL TRABAJO ──
    if(parte.trabajo) {
      doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("DESCRIPCIÓN DEL TRABAJO",14,y+5); y+=10;
      const lines=doc.splitTextToSize(parte.trabajo,182);
      doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text(lines,14,y); y+=lines.length*5.5+6;
    }

    // ── 4. TÉCNICO + HORAS ──
    doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("TÉCNICO Y HORAS DE SERVICIO",14,y+5); y+=9;
    doc.setFillColor(226,232,240); doc.rect(10,y,190,6,"F");
    doc.setTextColor(...G);
    ["Técnico","H. Inicio","H. Fin","Horas","€/hora","M.O."].forEach((h,i)=>doc.text(h,[14,70,100,130,155,178][i],y+4));
    y+=7; doc.setFont("helvetica","normal"); doc.setTextColor(...D); doc.setFontSize(9);
    [parte.tecnico_nombre||"—",parte.hora_inicio||"—",parte.hora_fin||"—",horas>0?horas.toFixed(2)+"h":"—",ph>0?ph+"€":"—",tMO>0?tMO.toFixed(2)+"€":"0.00€"].forEach((v,i)=>doc.text(v,[14,70,100,130,155,178][i],y+4));
    y+=10;

    // ── 5. MATERIALES ──
    if(mats.length>0){
      doc.setFillColor(...O); doc.rect(10,y,190,7,"F");
      doc.setTextColor(...W); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text("MATERIALES UTILIZADOS",14,y+5); y+=9;
      doc.setFillColor(226,232,240); doc.rect(10,y,190,6,"F");
      doc.setTextColor(...G);
      ["Descripción","Cantidad","Precio ud.","Total"].forEach((h,i)=>doc.text(h,[14,130,155,182][i],y+4));
      y+=7;
      mats.forEach((m,idx)=>{
        if(idx%2===0){ doc.setFillColor(...L); doc.rect(10,y-1,190,7,"F"); }
        doc.setTextColor(...D); doc.setFont("helvetica","normal"); doc.setFontSize(9);
        const tot=(parseFloat(m.qty||0)*parseFloat(m.precio||0)).toFixed(2);
        [m.desc?.slice(0,45)||"—",String(m.qty||0),parseFloat(m.precio||0).toFixed(2)+" €",tot+" €"].forEach((v,i)=>doc.text(v,[14,130,155,182][i],y+4));
        y+=7; if(y>250){ doc.addPage(); y=20; }
      });
      // Total materiales
      doc.setFillColor(240,244,248); doc.rect(130,y,70,7,"F");
      doc.setFont("helvetica","bold"); doc.setTextColor(...D);
      doc.text("Total materiales:",132,y+5); doc.text(tMat.toFixed(2)+" €",198,y+5,{align:"right"});
      y+=12;
    }

    // ── 6. TOTALES ──
    doc.setFillColor(...L); doc.rect(10,y,190,7,"F");
    doc.setTextColor(...G); doc.setFont("helvetica","bold"); doc.setFontSize(8);
    doc.text("Base imponible:",14,y+5); doc.text(base.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
    if(parte.aplicar_iva!==false){
      doc.setFillColor(...L); doc.rect(10,y,190,7,"F");
      doc.text("IVA (21%):",14,y+5); doc.text(iva.toFixed(2)+" €",198,y+5,{align:"right"}); y+=8;
    }
    doc.setFillColor(...O); doc.rect(10,y,190,14,"F");
    doc.setTextColor(...W); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("TOTAL"+(parte.aplicar_iva!==false?" (IVA inc.)":""),14,y+10);
    doc.text(total.toFixed(2)+" €",198,y+10,{align:"right"}); y+=20;

    // ── 7. FIRMA ──
    const firmaData = parte.firma_base64 || parte.firma_url;
    if(firmaData){
      try {
        const loadImg = (src) => new Promise(res=>{
          const img=new Image(); img.crossOrigin="anonymous";
          img.onload=()=>res(img); img.onerror=()=>res(null);
          img.src=src;
        });
        const img = await loadImg(firmaData);
        if(img){
          doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G);
          doc.text("FIRMA DEL CLIENTE:",14,y+4);
          doc.addImage(img,"PNG",14,y+6,80,28);
          doc.line(14,y+36,94,y+36);
          doc.setFont("helvetica","normal"); doc.text(cliente?.nombre||"",14,y+40);
          y+=44;
        }
      } catch(e){}
    } else {
      // Espacio para firma manual
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...G);
      doc.text("FIRMA DEL CLIENTE:",14,y+4);
      doc.rect(14,y+6,80,28);
      doc.line(14,y+36,94,y+36);
      y+=44;
    }

    // ── 8. OBSERVACIONES ──
    if(parte.observaciones){
      doc.setFont("helvetica","italic"); doc.setFontSize(8); doc.setTextColor(...G);
      const obs=doc.splitTextToSize("Observaciones: "+parte.observaciones,182);
      doc.text(obs,14,y); y+=obs.length*5+4;
    }

    // ── PIE ──
    const ph2=doc.internal.pageSize.height;
    doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(102,102,102);
    doc.setFillColor(...D); doc.rect(0,ph2-10,210,10,"F");
    doc.setTextColor(100,116,139); doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.text((empresa.nombre||"")+(empresa.cif?" · CIF:"+empresa.cif:""),14,ph2-4);
    if(empresa.cuenta_iban) doc.text("IBAN: "+empresa.cuenta_iban,105,ph2-4,{align:"center"});
    doc.text((empresa.telefono||"")+(empresa.email?" · "+empresa.email:""),198,ph2-4,{align:"right"});

    const textLOPD = `De acuerdo con lo establecido en el artículo 7 del Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos, el interesado concede su consentimiento libre y expreso en el tratamiento de sus datos personales, por parte del responsable del tratamiento ${empresa.nombre||""}.\n\nEn base al derecho de información establecido en el artículo 12 del mismo RGPD y en base al artículo 11 de la LOPD GDD, se le facilita la siguiente información, puede consultar la información ampliada en el siguiente enlace (https://intranet.laboralrgpd.com/rgpdA/index.php?id=26337.73963).\n\nFinalidades a tratar: Gestión contable, administrativa, de facturación y gestión de cobros, Prestarles un servicio, Tramitación de presupuestos, Envíos de información recíproca mediante la plataforma Whatsapp, sin que el Responsable pueda asegurar que dicha plataforma tome medidas de seguridad y realicen tratamientos adecuados al RGPD y la LOPDGDD.\n\nLegitimación: consentimiento inequívoco.\n\nDestinatarios: Administración tributaria, Bancos y entidades financieras, Gestoría/Asesoría, Encargados de destrucción de documentación, Entidades de Consultoría/Auditoría, Otros encargados del tratamiento.\n\nTiene derecho a acceder, rectificar y suprimir los datos, así como otros derechos, como se explica en la información adicional. Puede consultar la información adicional y detallada sobre Protección de Datos en el siguiente enlace: (Información Adicional). Sólo conservaremos su información por el periodo de tiempo necesario para cumplir con la finalidad para la que fuere cogida, dar cumplimiento a las obligaciones legales que nos vienen impuestas y atender las posibles responsabilidades que pudieran derivar del cumplimiento de la finalidad por la que los datos fueron recabados.`;

    doc.addPage();
    doc.setFillColor(...O);
    doc.rect(0,0,210,20,"F");
    doc.setTextColor(...W);
    doc.setFontSize(10);
    doc.setFont("helvetica","bold");
    doc.text("INFORMACIÓN SOBRE PROTECCIÓN DE DATOS", 14, 13);
    doc.setFontSize(7);
    doc.setFont("helvetica","normal");
    doc.setTextColor(30,30,30);
    const lopd = doc.splitTextToSize(textLOPD, 182);
    doc.text(lopd, 14, 30);

    doc.save(`parte_${String(averia.id||"")}_${(cliente?.nombre||"cliente").replace(/ /g,"_")}.pdf`);
  } catch(e){ console.error("PDF error:",e); alert("Error al generar PDF: "+e.message); }
}
