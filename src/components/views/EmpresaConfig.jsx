import { useState, useRef } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import { mkInp } from "../../utils/styles.js";
import { getTextColor } from "../../utils/color.js";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import { supabase } from "../../supabase.js";
import Btn from "../ui/Btn.jsx";
import Field from "../ui/Field.jsx";
import CatalogoMaterialesView from "./CatalogoMaterialesView.jsx";

export default function EmpresaConfig({ empresa, setEmpresa }) {
  const { T } = useTheme();
  const inp = mkInp(T);
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ ...empresa });
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [showCatalogo, setShowCatalogo] = useState(false);

  async function uploadLogo(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop().toLowerCase();
    const path = `logos/empresa_logo_${Date.now()}.${ext}`;
    let publicUrl = "";
    // Intentar primero en bucket "fotos"
    const { error: err1 } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
    if (!err1) {
      const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
      publicUrl = urlData.publicUrl;
      console.log("Logo URL (bucket fotos):", publicUrl);
      setForm(prev => ({ ...prev, logo_url: publicUrl }));
      setEmpresa(prev => ({ ...prev, logo_url: publicUrl }));
    } else {
      console.log("uploadLogo error en bucket 'fotos':", err1);
      // Fallback al bucket "logos"
      const { error: err2 } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (!err2) {
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
        publicUrl = urlData.publicUrl;
        console.log("Logo URL (bucket logos):", publicUrl);
        setForm(prev => ({ ...prev, logo_url: publicUrl }));
        setEmpresa(prev => ({ ...prev, logo_url: publicUrl }));
      } else {
        console.log("uploadLogo error en bucket 'logos':", err2);
        alert("Error subiendo logo: " + err2.message);
      }
    }
    if (publicUrl) {
      const { error: dbErr } = await supabase.from("empresa").update({ logo_url: publicUrl }).eq("id", 1);
      if (dbErr) console.log("Error guardando logo_url en BD:", dbErr);
      else console.log("logo_url guardado en BD correctamente");
    }
    setUploading(false);
    e.target.value = "";
  }

  async function save() {
    const payload = { ...form, id: 1 };
    console.log("Guardando empresa:", payload);
    const { error } = await supabase.from("empresa").upsert([payload]);
    if (!error) { setEmpresa(form); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else alert("Error: " + error.message);
  }

  const color = form.color_corporativo || "#1d4ed8";

  return (
    <>
    <div style={{ padding: isMobile ? 12 : 28 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.text, margin: "0 0 4px", fontFamily: "'Sora',sans-serif" }}>Mi empresa</h1>
        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Estos datos aparecerán en los partes y formularios enviados al cliente.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>

        {/* Imagen corporativa */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Imagen corporativa</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            {/* Logo */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.sub, display: "block", marginBottom: 8 }}>Logo de la empresa</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {form.logo_url ? (
                  <div style={{ position: "relative", width: 160, height: 80, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={form.logo_url} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    <button onClick={() => upd("logo_url", "")} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current.click()} style={{ width: 160, height: 80, borderRadius: 10, border: `2px dashed ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>🖼</span>
                    <span style={{ fontSize: 11, color: T.muted }}>Subir logo</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: "none" }} onChange={uploadLogo} />
                <Btn ch={uploading ? "Subiendo..." : "Cambiar logo"} onClick={() => fileRef.current.click()} v="g" sm disabled={uploading} />
                <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>PNG, JPG o SVG. Fondo transparente recomendado.</p>
              </div>
            </div>
            {/* Color corporativo */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.sub, display: "block", marginBottom: 8 }}>Color corporativo</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="color" value={color} onChange={e => upd("color_corporativo", e.target.value)}
                    style={{ width: 56, height: 56, borderRadius: 10, border: `1px solid ${T.border}`, cursor: "pointer", padding: 4 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{color.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>Color principal</div>
                  </div>
                </div>
                {/* Preview */}
                <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
                  <div style={{ background: color, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    {form.logo_url ? <img src={form.logo_url} alt="" style={{ height: 28, objectFit: "contain" }} /> : <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: getTextColor(color || '#1d4ed8').map(v => v.toString(16).padStart(2, '0')).reduce((a, b) => '#' + a + b) }}>{(form.nombre || "E")[0]}</div>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#' + getTextColor(color || '#1d4ed8').map(v => v.toString(16).padStart(2, '0')).join(''), fontFamily: "'Sora',sans-serif" }}>{form.nombre || "Mi empresa"}</span>
                  </div>
                  <div style={{ background: T.bg, padding: "8px 14px" }}>
                    <div style={{ fontSize: 11, color: T.muted }}>Vista previa de cabecera PDF</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos de la empresa */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Datos de la empresa</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <Field label="Nombre / Razón social">
              <input value={form.nombre || ""} onChange={e => upd("nombre", e.target.value)} style={inp()} placeholder="Nombre de tu empresa" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Field label="CIF / NIF"><input value={form.cif || ""} onChange={e => upd("cif", e.target.value)} style={inp()} placeholder="B12345678" /></Field>
              <Field label="Teléfono"><input value={form.telefono || ""} onChange={e => upd("telefono", e.target.value)} style={inp()} placeholder="968 XXX XXX" /></Field>
              <Field label="Email"><input type="email" value={form.email || ""} onChange={e => upd("email", e.target.value)} style={inp()} placeholder="info@empresa.com" /></Field>
              <Field label="Web"><input value={form.web || ""} onChange={e => upd("web", e.target.value)} style={inp()} placeholder="www.empresa.com" /></Field>
            </div>
            <Field label="Dirección fiscal">
              <input value={form.direccion || ""} onChange={e => upd("direccion", e.target.value)} style={inp()} placeholder="Calle, número, municipio, CP" />
            </Field>
          </div>
        </div>

        {/* Datos bancarios */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Datos bancarios</div>
          <Field label="IBAN">
            <input value={form.cuenta_iban || ""} onChange={e => upd("cuenta_iban", e.target.value)} style={inp()} placeholder="ES00 0000 0000 0000 0000 0000" />
          </Field>
        </div>

        {/* Configuración de fichajes */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Configuración de fichajes</div>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 16px" }}>Ajusta cómo registran la jornada tus empleados.</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>¿Tu empresa tiene pausa para comer?</div>
              <div style={{ fontSize: 12, color: T.muted }}>Actívalo si tus empleados fichan entrada, pausa y vuelta del descanso.</div>
            </div>
            <div onClick={() => upd("tiene_descanso", !form.tiene_descanso)}
              style={{ width: 44, height: 24, borderRadius: 12, background: form.tiene_descanso ? T.accent : "#cbd5e1", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 3, left: form.tiene_descanso ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: T.card, boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
            </div>
          </div>
        </div>

        {/* Catálogo de materiales */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>Catálogo de materiales</div>
            <div style={{ fontSize: 12, color: T.muted }}>Materiales y precios disponibles en partes y presupuestos</div>
          </div>
          <Btn ch="Gestionar catálogo" onClick={() => setShowCatalogo(true)} v="b" sm />
        </div>

        {/* Guardar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn ch="Guardar cambios" onClick={save} full />
          {saved && <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Guardado correctamente</span>}
        </div>

      </div>
    </div>
    {showCatalogo && <CatalogoMaterialesView onClose={() => setShowCatalogo(false)} />}
    </>
  );
}
