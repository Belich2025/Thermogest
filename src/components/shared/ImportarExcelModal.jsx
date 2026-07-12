import React, { useState, useRef } from "react";
import { useTheme }                from "../../ThemeContext.jsx";
import { mkInp }                   from "../../utils/styles.js";
import { supabase }               from "../../supabase.js";
import { useIsMobile }            from "../../hooks/useIsMobile.js";
import Modal                      from "../ui/Modal.jsx";
import MHead                      from "../ui/MHead.jsx";
import Btn                        from "../ui/Btn.jsx";
import Field                      from "../ui/Field.jsx";

function normalizar(s) { return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }

const CL_CAMPOS = [
  {key:"nombre",      label:"Nombre",          required:true},
  {key:"apellidos",   label:"Apellidos",        info:"Se concatena al nombre con espacio"},
  {key:"telefono",    label:"Teléfono / Móvil", info:"Teléfono principal del cliente"},
  {key:"telefonoFijo",label:"Teléfono fijo",    info:"Se añade a las notas"},
  {key:"email",       label:"Email"},
  {key:"direccion",   label:"Dirección / Calle"},
  {key:"ciudad",      label:"Ciudad",           info:"Se añade tras la dirección"},
  {key:"provincia",   label:"Provincia",        info:"Se añade al final de la dirección"},
  {key:"dni",         label:"CIF / DNI",        info:"Se guarda en el campo DNI/NIF del cliente"},
  {key:"notas",       label:"Notas"},
];

export function getClientesImportConfig(data) {
  const existentes = data.clientes || [];
  return {
    campos: CL_CAMPOS,
    existentes,
    entidadPlural: "clientes",
    secondary: getEquiposImportConfig(),
    buildIndex(list) {
      const byPhone = {}, byEmail = {}, byNombre = {};
      list.forEach(c => {
        if(c.telefono) byPhone[c.telefono.replace(/\s/g,"")] = c.id;
        if(c.email)    byEmail[c.email.toLowerCase()] = c.id;
        byNombre[normalizar(c.nombre)] = c.id;
      });
      return { byPhone, byEmail, byNombre };
    },
    esDuplicado({ tel, email, nombre }, index) {
      return !!((tel && index.byPhone[tel]) || (email && index.byEmail[email]) || index.byNombre[normalizar(nombre)]);
    },
    registrarEnIndex(index, c) {
      if(c.telefono) index.byPhone[c.telefono.replace(/\s/g,"")] = c.id;
      if(c.email)    index.byEmail[c.email.toLowerCase()] = c.id;
      index.byNombre[normalizar(c.nombre)] = c.id;
    },
  };
}

const EQ_CAMPOS = [
  {key:"clienteRef",label:"Cliente (referencia)",required:true},{key:"nombre",label:"Nombre equipo",required:true},
  {key:"marca",label:"Marca"},{key:"modelo",label:"Modelo"},{key:"numero_serie",label:"Nº serie"},
  {key:"año_instalacion",label:"Año instalación"},{key:"direccion",label:"Dirección"},{key:"ubicacion",label:"Ubicación"},
];

export function getEquiposImportConfig() {
  return {
    campos: EQ_CAMPOS,
    vincularCliente(ref, clientesIndex) {
      const refN = String(ref||"").toLowerCase().replace(/\s/g,"");
      let clienteId = clientesIndex.byPhone[refN] || clientesIndex.byEmail[refN] || null;
      if(!clienteId) { const k=Object.keys(clientesIndex.byNombre).find(k=>k.includes(refN)||refN.includes(k)); if(k) clienteId=clientesIndex.byNombre[k]; }
      return clienteId;
    },
  };
}

const MATERIALES_CAMPOS = [
  {key:"nombre",     label:"Nombre",              required:true},
  {key:"precio",     label:"Precio",              required:true, info:"Se actualiza siempre en los materiales existentes"},
  {key:"referencia", label:"Referencia / Código",  info:"Si coincide con un material existente, se actualiza en vez de duplicar"},
];

export function getMaterialesImportConfig(existentes) {
  return {
    campos: MATERIALES_CAMPOS,
    existentes: existentes || [],
    entidadPlural: "materiales",
    autoMap(cols) {
      const m = { nombre:"", precio:"", referencia:"" };
      cols.forEach(c => {
        const cl = c.toLowerCase();
        if(!m.nombre     && (cl.includes("nombre")||cl.includes("descrip")||cl.includes("concepto"))) m.nombre = c;
        if(!m.precio     && (cl.includes("precio")||cl.includes("pvp")||cl.includes("importe")||cl.includes("coste"))) m.precio = c;
        if(!m.referencia && (cl.includes("referencia")||cl.includes("ref")||cl.includes("codigo")||cl.includes("código")||cl.includes("sku"))) m.referencia = c;
      });
      return m;
    },
    buildIndex(list) {
      const byReferencia = {}, byNombre = {}, byId = {};
      list.forEach(m => {
        byId[m.id] = m;
        const ref = String(m.referencia||"").toLowerCase().trim();
        if(ref) byReferencia[ref] = m.id;
        byNombre[normalizar(m.nombre)] = m.id;
      });
      return { byReferencia, byNombre, byId };
    },
    matchExistente(fila, index) {
      const ref = String(fila.referencia||"").toLowerCase().trim();
      if(ref) {
        const porReferencia = index.byReferencia[ref];
        if(porReferencia != null) return porReferencia;
        const porNombre = index.byNombre[normalizar(fila.nombre)];
        if(porNombre == null) return null;
        const existente = index.byId[porNombre];
        const refExistente = String(existente?.referencia||"").toLowerCase().trim();
        if(refExistente && refExistente !== ref) return null;
        return porNombre;
      }
      return index.byNombre[normalizar(fila.nombre)] ?? null;
    },
    resolverAccion(fila, index) {
      const id = this.matchExistente(fila, index);
      if(!id) return { tipo:"insert", payload:{ nombre:fila.nombre, precio:fila.precio, referencia:fila.referencia||null } };
      const existente = index.byId[id];
      const payload = { precio: fila.precio };
      if(fila.referencia && !existente?.referencia) payload.referencia = fila.referencia;
      return { tipo:"update", id, payload };
    },
    contarPlan(filas, index) {
      let añadir = 0, actualizar = 0;
      filas.forEach(f => { if(this.resolverAccion(f, index).tipo==="insert") añadir++; else actualizar++; });
      return { añadir, actualizar };
    },
    async ejecutarImportacion(filas, index, onProgress) {
      const BATCH = 50;
      let añadidos = 0, actualizados = 0, incompletos = 0;
      for(let i=0; i<filas.length; i+=BATCH) {
        const batch = filas.slice(i,i+BATCH);
        for(const fila of batch) {
          if(!fila.nombre || fila.precio==null || isNaN(fila.precio)) { incompletos++; continue; }
          const accion = this.resolverAccion(fila, index);
          if(accion.tipo==="insert") {
            const { data:ins, error } = await supabase.from("materiales").insert([accion.payload]).select("id,nombre,precio,referencia");
            if(!error && ins?.[0]) {
              const nuevo = ins[0];
              añadidos++;
              index.byId[nuevo.id] = nuevo;
              if(nuevo.referencia) index.byReferencia[String(nuevo.referencia).toLowerCase().trim()] = nuevo.id;
              index.byNombre[normalizar(nuevo.nombre)] = nuevo.id;
            }
          } else {
            const { error } = await supabase.from("materiales").update(accion.payload).eq("id", accion.id);
            if(!error) {
              actualizados++;
              Object.assign(index.byId[accion.id], accion.payload);
              if(accion.payload.referencia) index.byReferencia[String(accion.payload.referencia).toLowerCase().trim()] = accion.id;
            }
          }
        }
        onProgress?.(Math.min(100, Math.round(((i+BATCH)/filas.length)*100)));
      }
      return { añadidos, actualizados, incompletos };
    },
  };
}

export default function ImportarExcelModal({ config, refresh, onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const clientesConfig = config;
  const equiposConfig  = clientesConfig.secondary || null;
  const tieneSecundaria = !!equiposConfig;
  const pasoConfirmar   = tieneSecundaria ? 4 : 3;
  const [paso, setPaso]               = useState(1);
  const [clienteFile, setClienteFile] = useState(null);
  const [xlsCols, setXlsCols]         = useState([]);
  const [xlsRows, setXlsRows]         = useState([]);   // preview 3 filas (display)
  const [xlsAllRows, setXlsAllRows]   = useState([]);   // todas las filas (import)
  const [map, setMap]                 = useState({ nombre:"", apellidos:"", telefono:"", telefonoFijo:"", email:"", direccion:"", ciudad:"", provincia:"", dni:"", notas:"" });
  const [equipoFile, setEquipoFile]   = useState(null);
  const [eqCols, setEqCols]           = useState([]);
  const [eqRows, setEqRows]           = useState([]);   // preview 3 filas (display)
  const [eqAllRows, setEqAllRows]     = useState([]);   // todas las filas (import)
  const [eqMap, setEqMap]             = useState({ clienteRef:"", nombre:"", marca:"", modelo:"", numero_serie:"", año_instalacion:"", direccion:"", ubicacion:"" });
  const [importing, setImporting]     = useState(false);
  const [progress, setProgress]       = useState(0);
  const [result, setResult]           = useState(null);
  const fileRef   = useRef();
  const eqFileRef = useRef();

  async function loadXlsx() {
    if(window.XLSX) return window.XLSX;
    return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload=()=>res(window.XLSX); s.onerror=rej; document.head.appendChild(s); });
  }

  async function parseFile(file) {
    const XLSX = await loadXlsx();
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, {type:"array"});
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
    const cols = rows.length > 0 ? rows[0].map(String) : [];
    return { cols, preview: rows.slice(1,4), allRows: rows.slice(1) };
  }

  function autoMapCols(cols, type) {
    const m = type === "cliente"
      ? { nombre:"", apellidos:"", telefono:"", telefonoFijo:"", email:"", direccion:"", ciudad:"", provincia:"", dni:"", notas:"" }
      : { clienteRef:"", nombre:"", marca:"", modelo:"", numero_serie:"", año_instalacion:"", direccion:"", ubicacion:"" };
    cols.forEach(c => {
      const cl = c.toLowerCase();
      if(type==="cliente") {
        if(!m.nombre       && (cl.includes("nombre")||cl.includes("razon")||cl.includes("razón")||cl.includes("name"))) m.nombre = c;
        if(!m.apellidos    && cl.includes("apellido")) m.apellidos = c;
        if(!m.telefono     && (cl.includes("móvil")||cl.includes("movil")||cl.includes("celular"))) m.telefono = c;
        if(!m.telefono     && (cl.includes("telef")||cl.includes("phone")) && !cl.includes("fijo")) m.telefono = c;
        if(!m.telefonoFijo && (cl.includes("fijo")||cl.includes("landline"))) m.telefonoFijo = c;
        if(!m.email        && (cl.includes("email")||cl.includes("mail")||cl.includes("correo"))) m.email = c;
        if(!m.direccion    && (cl.includes("direcc")||cl.includes("domicilio")||cl.includes("address")||cl.includes("calle"))) m.direccion = c;
        if(!m.ciudad       && (cl.includes("ciudad")||cl.includes("poblac")||cl.includes("municipio")||cl.includes("localidad"))) m.ciudad = c;
        if(!m.provincia    && (cl.includes("provincia")||cl.includes("region")||cl.includes("región")||cl.includes("comunidad"))) m.provincia = c;
        if(!m.dni          && (cl.includes("dni")||cl.includes("nif")||cl.includes("cif")||cl.includes("fiscal"))) m.dni = c;
        if(!m.notas        && (cl.includes("nota")||cl.includes("observ")||cl.includes("comment"))) m.notas = c;
      } else {
        if(!m.clienteRef      && (cl.includes("cliente")||cl.includes("titular")||cl.includes("propiet"))) m.clienteRef = c;
        if(!m.nombre          && (cl.includes("equipo")||cl.includes("aparato")||cl.includes("nombre"))) m.nombre = c;
        if(!m.marca           && cl.includes("marca")) m.marca = c;
        if(!m.modelo          && cl.includes("modelo")) m.modelo = c;
        if(!m.numero_serie    && (cl.includes("serie")||cl.includes("serial")||cl.includes("num"))) m.numero_serie = c;
        if(!m.año_instalacion && (cl.includes("año")||cl.includes("anio")||cl.includes("instalac")||cl.includes("fecha"))) m.año_instalacion = c;
        if(!m.direccion       && (cl.includes("direcc")||cl.includes("domicilio"))) m.direccion = c;
        if(!m.ubicacion       && (cl.includes("ubicac")||cl.includes("lugar")||cl.includes("zona"))) m.ubicacion = c;
      }
    });
    return m;
  }

  async function handleClienteFile(e) {
    const file = e.target.files[0]; if(!file) return;
    setClienteFile(file);
    const { cols, preview, allRows } = await parseFile(file);
    console.log(`[Importar] Archivo clientes: ${file.name} — ${allRows.length} filas de datos, ${cols.length} columnas`);
    setXlsCols(cols); setXlsRows(preview); setXlsAllRows(allRows);
    setMap(clientesConfig.autoMap ? clientesConfig.autoMap(cols) : autoMapCols(cols,"cliente"));
  }

  async function handleEquipoFile(e) {
    const file = e.target.files[0]; if(!file) return;
    setEquipoFile(file);
    const { cols, preview, allRows } = await parseFile(file);
    console.log(`[Importar] Archivo equipos: ${file.name} — ${allRows.length} filas de datos, ${cols.length} columnas`);
    setEqCols(cols); setEqRows(preview); setEqAllRows(allRows);
    setEqMap(autoMapCols(cols,"equipo"));
  }

  function mappedClientes() {
    const idx = xlsCols.indexOf(map.nombre);
    return xlsAllRows.filter(r => idx>=0 && String(r[idx]||"").trim());
  }

  function getRow(row, cols, col) { return col ? String(row[cols.indexOf(col)]||"").trim() : ""; }

  function buildFilasGenericas() {
    return mappedClientes().map(row => {
      const fila = {};
      clientesConfig.campos.forEach(f => {
        const raw = getRow(row, xlsCols, map[f.key]);
        fila[f.key] = f.key==="precio" ? parseFloat(String(raw).replace(",",".")) : raw;
      });
      return fila;
    });
  }

  function buildNombre(row) {
    const n = getRow(row, xlsCols, map.nombre);
    const a = map.apellidos ? getRow(row, xlsCols, map.apellidos) : "";
    return [n, a].filter(Boolean).join(" ");
  }
  function buildTelefono(row) { return getRow(row, xlsCols, map.telefono).replace(/\s/g,""); }
  function buildDireccion(row) {
    return [map.direccion, map.ciudad, map.provincia]
      .map(col => col ? getRow(row, xlsCols, col) : "")
      .filter(Boolean).join(", ");
  }
  function buildNotas(row) {
    const fijo  = map.telefonoFijo ? getRow(row,xlsCols,map.telefonoFijo).replace(/\s/g,"") : "";
    const extra = map.notas        ? getRow(row,xlsCols,map.notas)        : "";
    return [fijo?"Tel. fijo: "+fijo:"", extra].filter(Boolean).join(" | ") || null;
  }

  function previewClientes() {
    return mappedClientes().slice(0,5).map(row => ({
      nombre:   buildNombre(row),
      telefono: buildTelefono(row),
      email:    getRow(row, xlsCols, map.email),
      direccion:buildDireccion(row),
    }));
  }

  function previewEquipos() {
    if(!eqRows.length) return [];
    const idx = eqCols.indexOf(eqMap.nombre);
    return eqRows.filter(r=>idx>=0&&String(r[idx]||"").trim()).slice(0,5).map(row => ({
      nombre:     getRow(row, eqCols, eqMap.nombre),
      clienteRef: getRow(row, eqCols, eqMap.clienteRef),
      marca:      getRow(row, eqCols, eqMap.marca),
      modelo:     getRow(row, eqCols, eqMap.modelo),
    }));
  }

  async function ejecutarImportacion() {
    setImporting(true); setProgress(0);

    if(clientesConfig.ejecutarImportacion) {
      const index = clientesConfig.buildIndex(clientesConfig.existentes);
      const filas = buildFilasGenericas();
      const stats = await clientesConfig.ejecutarImportacion(filas, index, p=>setProgress(p));
      setResult(stats);
      setImporting(false);
      refresh?.();
      return;
    }

    const BATCH = 50;
    const existentes = clientesConfig.existentes;
    const index = clientesConfig.buildIndex(existentes);

    const clienteRows = mappedClientes();
    console.log(`[Importar] Total filas con nombre válido: ${clienteRows.length} (existentes en BD: ${existentes.length})`);
    let importados = 0; let duplicados = 0; let incompletos = 0;

    for(let i=0; i<clienteRows.length; i+=BATCH) {
      const batch = clienteRows.slice(i,i+BATCH);
      const toInsert = [];
      batch.forEach(row => {
        const nombre   = buildNombre(row);
        const tel      = buildTelefono(row);
        const telefonoFijo = map.telefonoFijo ? getRow(row,xlsCols,map.telefonoFijo).replace(/\s/g,"") : "";
        const tieneNombre   = !!nombre;
        const tieneTelefono = !!(tel || telefonoFijo);
        const tieneDireccion= !!(buildDireccion(row));
        if(!tieneNombre || !tieneTelefono || !tieneDireccion) {
          console.log(`[Importar] Incompleto — nombre:"${nombre}" tel:"${tel||telefonoFijo}" dir:"${buildDireccion(row)}"`);
          incompletos++; return;
        }
        const email = getRow(row,xlsCols,map.email).toLowerCase();
        if(clientesConfig.esDuplicado({ tel, email, nombre }, index)) { duplicados++; return; }
        const dniVal = map.dni ? getRow(row,xlsCols,map.dni) : "";
        toInsert.push({ nombre, telefono:tel||telefonoFijo||null, email:email||null, direccion:buildDireccion(row)||null, dni:dniVal||null, notas:buildNotas(row) });
      });
      console.log(`[Importar] Lote ${Math.floor(i/BATCH)+1}: ${toInsert.length} a insertar, ${batch.length-toInsert.length} duplicados en este lote`);
      if(toInsert.length>0) {
        const { data:ins, error } = await supabase.from("clientes").insert(toInsert).select("id,nombre,telefono,email");
        if(error) console.error(`[Importar] Error en lote ${Math.floor(i/BATCH)+1}:`, error);
        if(ins) { importados+=ins.length; ins.forEach(c=>clientesConfig.registrarEnIndex(index, c)); }
        console.log(`[Importar] Lote ${Math.floor(i/BATCH)+1} insertado: ${ins?.length??0} ok — acumulado: ${importados}`);
      }
      setProgress(Math.min(70, Math.round(((i+BATCH)/clienteRows.length)*70)));
    }

    let equiposImportados = 0; let equiposSinCliente = 0;
    if(eqAllRows.length>0 && eqMap.nombre) {
      const eqIdx = eqCols.indexOf(eqMap.nombre);
      const equipoRows = eqAllRows.filter(r=>eqIdx>=0&&String(r[eqIdx]||"").trim());
      console.log(`[Importar] Total filas de equipos con nombre válido: ${equipoRows.length}`);
      for(let i=0; i<equipoRows.length; i+=BATCH) {
        const batch = equipoRows.slice(i,i+BATCH);
        const toInsert = [];
        batch.forEach(row => {
          const ref = getRow(row,eqCols,eqMap.clienteRef);
          const clienteId = equiposConfig.vincularCliente(ref, index);
          if(!clienteId) { equiposSinCliente++; return; }
          const añoStr = getRow(row,eqCols,eqMap.año_instalacion);
          const año = añoStr ? parseInt(añoStr) : null;
          toInsert.push({ cliente_id:clienteId, nombre:getRow(row,eqCols,eqMap.nombre), marca:getRow(row,eqCols,eqMap.marca)||null, modelo:getRow(row,eqCols,eqMap.modelo)||null, numero_serie:getRow(row,eqCols,eqMap.numero_serie)||null, año_instalacion:(año&&!isNaN(año))?año:null, direccion:getRow(row,eqCols,eqMap.direccion)||null, ubicacion:getRow(row,eqCols,eqMap.ubicacion)||null });
        });
        if(toInsert.length>0) { const { error }=await supabase.from("equipos").insert(toInsert); if(!error) equiposImportados+=toInsert.length; }
        setProgress(70+Math.min(30,Math.round(((i+BATCH)/equipoRows.length)*30)));
      }
    }

    setProgress(100);
    setResult({ importados, duplicados, incompletos, equiposImportados, equiposSinCliente });
    setImporting(false);
    refresh?.();
  }

  const ColSel = ({value, onChange, cols, rows}) => {
    const exampleVal = value && rows?.length ? rows.map(r=>String(r[cols.indexOf(value)]||"").trim()).find(v=>v)||"" : "";
    return (
      <div>
        <select value={value} onChange={e=>onChange(e.target.value)} style={{...inp({padding:"7px 10px",fontSize:12}),width:"100%"}}>
          <option value="">— No importar —</option>
          {cols.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {exampleVal&&<div style={{fontSize:11,color:T.accent,marginTop:3,paddingLeft:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {exampleVal}</div>}
      </div>
    );
  };

  const PreviewTable = ({cols, rows}) => (
    <div style={{ overflowX:"auto",borderRadius:8,border:`1px solid ${T.border}`,marginTop:8 }}>
      <table style={{ borderCollapse:"collapse",width:"100%",fontSize:11 }}>
        <thead><tr style={{ background:T.surface }}>{cols.map(c=><th key={c} style={{ padding:"6px 10px",textAlign:"left",color:T.sub,fontWeight:600,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",maxWidth:120 }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=><tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>{cols.map((c,j)=><td key={j} style={{ padding:"5px 10px",color:T.text,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{String(row[j]||"")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

  if(result) return (
    <Modal onClose={onClose} w={480}>
      <MHead title="Importación completada" onClose={onClose}/>
      <div style={{ padding:"24px 28px 28px",display:"flex",flexDirection:"column",gap:14 }}>
        {clientesConfig.ejecutarImportacion ? (
          <div style={{ background:T.greenLight,border:"1px solid #bbf7d0",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start" }}>
            <span style={{ fontSize:28 }}></span>
            <div>
              <div style={{ fontSize:15,fontWeight:700,color:T.green,marginBottom:4 }}>Materiales</div>
              <div style={{ fontSize:13,color:T.text }}><strong>{result.añadidos}</strong> materiales añadidos</div>
              <div style={{ fontSize:13,color:T.text }}><strong>{result.actualizados}</strong> materiales actualizados</div>
              {result.incompletos>0&&<div style={{ fontSize:12,color:"#b45309",marginTop:3 }}>{result.incompletos} incompletos saltados (falta nombre o precio)</div>}
            </div>
          </div>
        ) : (<>
          <div style={{ background:T.greenLight,border:"1px solid #bbf7d0",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start" }}>
            <span style={{ fontSize:28 }}></span>
            <div>
              <div style={{ fontSize:15,fontWeight:700,color:T.green,marginBottom:4 }}>Clientes</div>
              <div style={{ fontSize:13,color:T.text }}><strong>{result.importados}</strong> clientes importados correctamente</div>
              {result.duplicados>0&&<div style={{ fontSize:12,color:T.muted,marginTop:3 }}>{result.duplicados} duplicados saltados (ya existían)</div>}
              {result.incompletos>0&&<div style={{ fontSize:12,color:"#b45309",marginTop:3 }}>{result.incompletos} incompletos saltados (falta nombre, teléfono o dirección)</div>}
            </div>
          </div>
          {(result.equiposImportados>0||result.equiposSinCliente>0)&&(
            <div style={{ background:T.accentLight,border:"1px solid #bfdbfe",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start" }}>
              <span style={{ fontSize:28 }}></span>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:T.accent,marginBottom:4 }}>Equipos</div>
                <div style={{ fontSize:13,color:T.text }}><strong>{result.equiposImportados}</strong> equipos importados correctamente</div>
                {result.equiposSinCliente>0&&<div style={{ fontSize:12,color:T.muted,marginTop:3 }}>{result.equiposSinCliente} sin cliente encontrado (saltados)</div>}
              </div>
            </div>
          )}
        </>)}
        <div style={{ display:"flex",justifyContent:"flex-end" }}>
          <Btn ch="Cerrar" onClick={onClose}/>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} w={660}>
      <MHead title="Importar desde Excel" onClose={onClose}/>
      {/* Steps indicator */}
      <div style={{ padding:"14px 28px 0",display:"flex",alignItems:"center" }}>
        {(tieneSecundaria?["Archivo","Columnas","Equipos","Confirmar"]:["Archivo","Columnas","Confirmar"]).map((label,i)=>{ const s=i+1; return (
          <React.Fragment key={s}>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:paso>=s?T.accent:T.border,color:paso>=s?"#fff":T.muted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,transition:"all 0.2s" }}>{paso>s?"":s}</div>
              <span style={{ fontSize:9,color:paso>=s?T.accent:T.muted,fontWeight:paso===s?700:400,whiteSpace:"nowrap" }}>{label}</span>
            </div>
            {i<(tieneSecundaria?3:2)&&<div style={{ flex:1,height:2,background:paso>s?T.accent:T.border,margin:"0 6px 18px",transition:"background 0.3s" }}/>}
          </React.Fragment>
        );})}
      </div>

      <div style={{ padding:"16px 28px 28px",display:"flex",flexDirection:"column",gap:16,maxHeight:"70vh",overflowY:"auto" }}>

        {/* PASO 1 */}
        {paso===1&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Sube un archivo Excel (.xlsx) o CSV con los datos de tus {clientesConfig.entidadPlural||"registros"}. La primera fila debe contener los nombres de las columnas.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleClienteFile}/>
          <button onClick={()=>fileRef.current?.click()} style={{ padding:"32px",borderRadius:12,border:`2px dashed ${clienteFile?T.green:T.border}`,background:clienteFile?T.greenLight:"#fafafa",color:clienteFile?T.green:T.sub,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center",transition:"all 0.15s" }}>
            {clienteFile?`${clienteFile.name}`:"Haz clic para seleccionar archivo .xlsx o .csv"}
          </button>
          {xlsCols.length>0&&<div style={{ background:T.surface,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.sub }}><strong style={{ color:T.text }}>Columnas detectadas ({xlsCols.length}):</strong> {xlsCols.join(" · ")}</div>}
          <div style={{ display:"flex",justifyContent:"flex-end" }}>
            <Btn ch="Siguiente →" onClick={()=>setPaso(2)} disabled={xlsCols.length===0}/>
          </div>
        </>)}

        {/* PASO 2 */}
        {paso===2&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Indica qué columna del Excel corresponde a cada campo. Los campos marcados con * son obligatorios.</p>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10 }}>
            {clientesConfig.campos.map(f=>(
              <div key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:T.sub}}>{f.label}{f.required?" *":""}</label>
                <ColSel value={map[f.key]} onChange={v=>setMap(p=>({...p,[f.key]:v}))} cols={xlsCols} rows={xlsRows}/>
                {f.info&&<div style={{fontSize:10,color:T.muted,lineHeight:1.3}}>{f.info}</div>}
              </div>
            ))}
          </div>
          {xlsRows.length>0&&(<>
            <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em" }}>Vista previa del archivo (3 filas)</div>
            <PreviewTable cols={xlsCols} rows={xlsRows}/>
          </>)}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(1)} v="g"/>
            <Btn ch="Siguiente →" onClick={()=>setPaso(3)} disabled={!map.nombre}/>
          </div>
        </>)}

        {/* PASO 3 (solo si la config primaria trae entidad secundaria) */}
        {paso===3&&tieneSecundaria&&(<>
          <p style={{ fontSize:13,color:T.sub,margin:0 }}>Opcionalmente sube un archivo con los equipos de los clientes. La columna "Cliente" debe contener el nombre, teléfono o email del cliente para vincularlos.</p>
          <input ref={eqFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleEquipoFile}/>
          <button onClick={()=>eqFileRef.current?.click()} style={{ padding:"24px",borderRadius:12,border:`2px dashed ${equipoFile?T.green:T.border}`,background:equipoFile?T.greenLight:"#fafafa",color:equipoFile?T.green:T.sub,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center",transition:"all 0.15s" }}>
            {equipoFile?`${equipoFile.name}`:"Seleccionar archivo de equipos (opcional)"}
          </button>
          {eqCols.length>0&&(<>
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10 }}>
              {equiposConfig.campos.map(f=>(
                <Field key={f.key} label={f.label+(f.required?" *":"")}>
                  <ColSel value={eqMap[f.key]} onChange={v=>setEqMap(p=>({...p,[f.key]:v}))} cols={eqCols}/>
                </Field>
              ))}
            </div>
            {eqRows.length>0&&(<>
              <div style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.05em" }}>Vista previa del archivo (3 filas)</div>
              <PreviewTable cols={eqCols} rows={eqRows}/>
            </>)}
          </>)}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(2)} v="g"/>
            <div style={{ display:"flex",gap:8 }}>
              <Btn ch="Saltar equipos" onClick={()=>setPaso(pasoConfirmar)} v="g"/>
              <Btn ch="Siguiente →" onClick={()=>setPaso(pasoConfirmar)}/>
            </div>
          </div>
        </>)}

        {/* PASO Confirmar */}
        {paso===pasoConfirmar&&(<>
          {clientesConfig.ejecutarImportacion ? (<>
            <p style={{ fontSize:13,color:T.sub,margin:0 }}>Revisa los datos antes de importar. Los que coincidan con un material existente (por referencia o por nombre) se actualizarán en vez de duplicarse.</p>
            {(() => {
              const index = clientesConfig.buildIndex(clientesConfig.existentes);
              const filas = buildFilasGenericas();
              const plan = clientesConfig.contarPlan ? clientesConfig.contarPlan(filas, index) : null;
              return (
                <div>
                  <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:8 }}>
                    {clientesConfig.entidadPlural} a importar — <span style={{ color:T.accent }}>{filas.length} registros</span>
                    {plan&&<span style={{ color:T.muted,fontWeight:400 }}> ({plan.añadir} nuevos, {plan.actualizar} actualizaciones)</span>}
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {filas.slice(0,5).map((f,i)=>(
                      <div key={i} style={{ background:T.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
                        <span style={{ fontSize:13,fontWeight:600,color:T.text,minWidth:130 }}>{f.nombre||"—"}</span>
                        {f.precio!=null&&!isNaN(f.precio)&&<span style={{ fontSize:12,color:T.sub }}>{f.precio} €</span>}
                        {f.referencia&&<span style={{ fontSize:11,color:T.muted }}>{f.referencia}</span>}
                      </div>
                    ))}
                    {filas.length>5&&<div style={{ fontSize:11,color:T.muted,textAlign:"center" }}>… y {filas.length-5} más</div>}
                  </div>
                </div>
              );
            })()}
          </>) : (<>
            <p style={{ fontSize:13,color:T.sub,margin:0 }}>Revisa los datos antes de importar. Se saltarán automáticamente los clientes con teléfono, email o nombre completo duplicado.</p>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:8 }}>
                Clientes a importar — <span style={{ color:T.accent }}>{mappedClientes().length} registros</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {previewClientes().map((c,i)=>(
                  <div key={i} style={{ background:T.surface,borderRadius:8,padding:"8px 12px",border:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
                    <span style={{ fontSize:13,fontWeight:600,color:T.text,minWidth:130 }}>{c.nombre||"—"}</span>
                    {c.telefono&&<span style={{ fontSize:12,color:T.sub }}>{c.telefono}</span>}
                    {c.email&&<span style={{ fontSize:12,color:T.sub }}>{c.email}</span>}
                    {c.direccion&&<span style={{ fontSize:11,color:T.muted,flex:1 }}>{c.direccion}</span>}
                  </div>
                ))}
                {mappedClientes().length>5&&<div style={{ fontSize:11,color:T.muted,textAlign:"center" }}>… y {mappedClientes().length-5} más</div>}
              </div>
            </div>
            {previewEquipos().length>0&&(
              <div>
                <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:8 }}>
                  Equipos a importar — <span style={{ color:T.accent }}>{eqRows.filter(r=>{ const i=eqCols.indexOf(eqMap.nombre); return i>=0&&String(r[i]||"").trim(); }).length} registros</span>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {previewEquipos().map((e,i)=>(
                    <div key={i} style={{ background:"#eff6ff",borderRadius:8,padding:"8px 12px",border:"1px solid #bfdbfe",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center" }}>
                      <span style={{ fontSize:13,fontWeight:600,color:T.accent,minWidth:130 }}>{e.nombre}</span>
                      <span style={{ fontSize:12,color:T.sub }}>→ {e.clienteRef||"sin cliente"}</span>
                      {e.marca&&<span style={{ fontSize:11,color:T.muted }}>{e.marca}{e.modelo?` · ${e.modelo}`:""}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
          {importing&&(
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontSize:12,color:T.sub }}>Importando datos...</span>
                <span style={{ fontSize:12,fontWeight:700,color:T.accent }}>{progress}%</span>
              </div>
              <div style={{ background:T.border,borderRadius:99,height:8,overflow:"hidden" }}>
                <div style={{ background:T.accent,height:8,borderRadius:99,width:`${progress}%`,transition:"width 0.4s" }}/>
              </div>
            </div>
          )}
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <Btn ch="← Atrás" onClick={()=>setPaso(tieneSecundaria?3:2)} v="g" disabled={importing}/>
            <Btn ch={importing?"Importando...":"Importar ahora"} onClick={ejecutarImportacion} disabled={importing}/>
          </div>
        </>)}

      </div>
    </Modal>
  );
}
