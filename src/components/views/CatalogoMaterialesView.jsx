import { useState, useEffect } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../supabase.js";
import Modal from "../ui/Modal.jsx";
import MHead from "../ui/MHead.jsx";
import Btn from "../ui/Btn.jsx";
import ImportarExcelModal, { getMaterialesImportConfig } from "../shared/ImportarExcelModal.jsx";

export default function CatalogoMaterialesView({ onClose }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: d } = await supabase.from("materiales").select("*").eq("activo", true).order("nombre", { ascending: true });
    setRows((d || []).map(m => ({ id: m.id, nombre: m.nombre, precio: m.precio, _del: false })));
    setLoading(false);
  }

  function addRow() { setRows(r => [...r, { id: null, nombre: "", precio: "", _del: false }]); }

  function updRow(i, k, v) { setRows(r => r.map((row, j) => j === i ? { ...row, [k]: v } : row)); }

  function removeRow(i) {
    setRows(r => {
      if (r[i].id === null) return r.filter((_, j) => j !== i);
      return r.map((row, j) => j === i ? { ...row, _del: true } : row);
    });
  }

  async function guardar() {
    setSaving(true);
    const ops = [
      ...rows.filter(r => r.id === null && !r._del && r.nombre.trim()).map(r =>
        supabase.from("materiales").insert([{ nombre: r.nombre.trim(), precio: parseFloat(r.precio || 0) }])
      ),
      ...rows.filter(r => r.id !== null && !r._del).map(r =>
        supabase.from("materiales").update({ nombre: r.nombre.trim(), precio: parseFloat(r.precio || 0) }).eq("id", r.id)
      ),
      ...rows.filter(r => r.id !== null && r._del).map(r =>
        supabase.from("materiales").update({ activo: false }).eq("id", r.id)
      ),
    ];
    const results = await Promise.all(ops);
    const err = results.find(r => r.error);
    if (err) alert("Error: " + err.error.message);
    else await load();
    setSaving(false);
  }

  const visible = rows.reduce((acc, r, i) => {
    if (!r._del && (!search || r.nombre.toLowerCase().includes(search.toLowerCase()))) acc.push({ r, i });
    return acc;
  }, []);

  return (
    <Modal onClose={onClose} w={680}>
      <MHead title="Catálogo de materiales" sub='Los cambios se guardan al pulsar "Guardar cambios"' onClose={onClose} />
      <div style={{ padding: isMobile ? "12px 10px" : "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar material..." style={{ ...inp({ padding: "8px 12px", fontSize: 13 }), flex: 1 }} />
          <Btn ch="Importar Excel" onClick={() => setShowImport(true)} v="g" sm />
          <Btn ch="+ Añadir material" onClick={addRow} v="b" sm />
        </div>

        {loading ? (
          <div style={{ padding: "30px", textAlign: "center", color: T.muted, fontSize: 13 }}>Cargando...</div>
        ) : (
          <div style={{ background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", gap: 8, padding: "7px 12px", borderBottom: `1px solid ${T.border}`, background: T.card }}>
              {["Nombre", "Precio (€)", ""].map((h, i) => <span key={i} style={{ fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase" }}>{h}</span>)}
            </div>
            {visible.length === 0 ? (
              <div style={{ padding: "28px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                {search ? "Sin coincidencias para «" + search + "»" : "Sin materiales. Pulsa «+ Añadir material» para empezar."}
              </div>
            ) : visible.map(({ r, i }) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", gap: 8, padding: "6px 12px", borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
                <input value={r.nombre} onChange={e => updRow(i, "nombre", e.target.value)} placeholder="Nombre del material" style={inp({ padding: "5px 9px", fontSize: 13 })} />
                <input type="number" step="0.01" value={r.precio} onChange={e => updRow(i, "precio", e.target.value)} placeholder="0.00" style={inp({ padding: "5px 9px", fontSize: 13 })} />
                <button onClick={() => removeRow(i)} title="Eliminar" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.red}40`, background: T.redLight, color: T.red, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
          <Btn ch="Cancelar" onClick={onClose} v="g" />
          <Btn ch={saving ? "Guardando..." : "Guardar cambios"} onClick={guardar} disabled={saving || loading} />
        </div>

      </div>
      {showImport && <ImportarExcelModal config={getMaterialesImportConfig(rows)} refresh={() => { load(); setShowImport(false); }} onClose={() => setShowImport(false)} />}
    </Modal>
  );
}
