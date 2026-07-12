import { useEffect, useState } from "react";
import { useTheme } from "../../ThemeContext.jsx";
import Btn from "../ui/Btn.jsx";

// Capturado a nivel de módulo (no de componente): el evento puede disparar
// antes de que este componente llegue a montarse (p.ej. mientras se restaura
// la sesión y Login se desmonta antes de que el Sidebar aparezca), así que
// nunca dependemos de que un componente concreto esté vivo para no perderlo.
let capturedPrompt = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    capturedPrompt = e;
    listeners.forEach(fn => fn(e));
  });
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function InstalarAppBtn() {
  const { T } = useTheme();
  const [prompt, setPrompt] = useState(capturedPrompt);
  const [standalone, setStandalone] = useState(isStandalone());
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    const onCaptured = (e) => setPrompt(e);
    listeners.add(onCaptured);
    return () => listeners.delete(onCaptured);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(isStandalone());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  if (standalone) return null;

  async function instalar() {
    if (!prompt) return;
    setInstalando(true);
    prompt.prompt();
    await prompt.userChoice;
    capturedPrompt = null;
    setPrompt(null);
    setInstalando(false);
  }

  if (prompt) {
    return <Btn ch={instalando ? "Instalando..." : "Instalar app"} onClick={instalar} v="b" sm disabled={instalando} />;
  }

  if (isIOS()) {
    return (
      <div style={{ fontSize:11, lineHeight:1.5, color:T.muted, padding:"7px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.surface }}>
        Para instalar: pulsa <b>Compartir</b> y luego <b>"Añadir a pantalla de inicio"</b>.
      </div>
    );
  }

  return null;
}
