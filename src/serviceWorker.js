// Registro del Service Worker, independiente del SDK de Firebase para no
// romper el code-splitting (firebase.js solo se importa tras el login).
// Memoizado: siempre devuelve la misma promesa de registro, la llame quien
// la llame (arranque de la app o el flujo de notificaciones), así nunca se
// registra dos veces.
let _reg = null;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!_reg) {
    _reg = navigator.serviceWorker.register("/firebase-messaging-sw.js")
      .catch(e => { console.error("Error registrando Service Worker:", e); return null; });
  }
  return _reg;
}
