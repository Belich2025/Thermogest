import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { supabase } from "../../supabase.js";
import Btn          from "../ui/Btn.jsx";

const COLUMNA = {
  averia:            "averia_id",
  mantenimiento:     "mantenimiento_id",
  presupuesto:       "presupuesto_id",
  instalacion_obra:  "instalacion_id",
};

const CARPETA = {
  averia:            "averias",
  mantenimiento:     "mantenimientos",
  presupuesto:       "presupuestos",
  instalacion_obra:  "instalaciones",
};

export default function FotosEntidad({ entidad, entidadId }) {
  const { T } = useTheme();
  const columna = COLUMNA[entidad];
  const carpeta = CARPETA[entidad];
  const [fotos, setFotos]               = useState([]);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const fileRef    = useRef();
  const galleryRef = useRef();

  useEffect(()=>{ loadFotos(); }, [entidad, entidadId]);

  async function loadFotos() {
    const {data:d} = await supabase.from("fotos_averias").select("*").eq(columna, entidadId);
    setFotos(d||[]);
  }

  function getFotoUrl(path) {
    const {data} = supabase.storage.from("fotos").getPublicUrl(path);
    return data?.publicUrl||"";
  }

  async function subirFoto(e) {
    const files = Array.from(e.target.files).slice(0, 4 - fotos.length);
    for(const file of files) {
      const compressed = await new Promise(resolve => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => { URL.revokeObjectURL(url); resolve(blob); }, "image/jpeg", 0.7);
        };
        img.src = url;
      });
      const path = `${carpeta}/${entidadId}/${Date.now()}.jpg`;
      const {error:uploadError} = await supabase.storage.from("fotos").upload(path, compressed, {
        upsert:false, contentType:"image/jpeg"
      });
      if(uploadError) continue;
      const {error:insertError} = await supabase.from("fotos_averias").insert([{ [columna]: entidadId, storage_path:path }]);
      if(insertError) {
        alert("Error al guardar la foto: "+insertError.message);
        await supabase.storage.from("fotos").remove([path]);
      }
    }
    loadFotos(); e.target.value="";
  }

  async function borrarFoto(f) {
    await supabase.storage.from("fotos").remove([f.storage_path]);
    await supabase.from("fotos_averias").delete().eq("id",f.id);
    loadFotos();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8 }}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} onChange={subirFoto}/>
        <input ref={galleryRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={subirFoto}/>
        <span style={{ fontSize:12,color:T.sub }}>{fotos.length}/4 fotos</span>
        {fotos.length<4 && (
          <div style={{ display:"flex", gap:6 }}>
            <Btn ch="Cámara" onClick={()=>fileRef.current.click()} v="g" sm/>
            <Btn ch="Galería" onClick={()=>galleryRef.current.click()} v="s" sm/>
          </div>
        )}
      </div>
      {fotos.length===0
        ? <div onClick={()=>fileRef.current.click()} style={{ border:`2px dashed ${T.border}`,borderRadius:10,padding:30,textAlign:"center",cursor:"pointer",color:T.muted }}>Pulsa para añadir fotos</div>
        : <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8 }}>
            {fotos.map(f=>(
              <div key={f.id} style={{ position:"relative",aspectRatio:"4/3",borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}` }}>
                <img src={getFotoUrl(f.storage_path)} alt="" onClick={()=>setFotoAmpliada(getFotoUrl(f.storage_path))} style={{ width:"100%",height:"100%",objectFit:"cover",cursor:"pointer" }}/>
                <button onClick={()=>borrarFoto(f)} style={{ position:"absolute",top:6,right:6,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer" }}>×</button>
              </div>
            ))}
          </div>}
      {fotoAmpliada && (
        <div onClick={()=>setFotoAmpliada(null)}
          style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",
            background:"#000000dd",zIndex:2000,display:"flex",
            alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <img src={fotoAmpliada} alt=""
            style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain",borderRadius:8}}
            onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setFotoAmpliada(null)}
            style={{position:"absolute",top:20,right:20,background:"none",
              border:"none",color:"#fff",fontSize:32,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </div>
  );
}
