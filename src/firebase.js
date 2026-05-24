import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC40dyuVwVflnxWDY2dabu7Q0RaMLIw0_M",
  authDomain: "thermogest-60f98.firebaseapp.com",
  projectId: "thermogest-60f98",
  storageBucket: "thermogest-60f98.firebasestorage.app",
  messagingSenderId: "489422877811",
  appId: "1:489422877811:web:1e09279e185d88161aa606"
};

const VAPID_KEY = "BPePN4j31e0bBmg3TMbIhiv4aRzFSskAc8VwoqiJWAYBRNje-jgCr6sW_GiH_PvzlGYluYUVBUuV2IpVWevBExA";

const app = initializeApp(firebaseConfig);

let _messaging = null;
function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

export async function requestNotificationPermission() {
  try {
    console.log("1. Iniciando solicitud de permiso de notificaciones");
    console.log("2. Notification soportado:", "Notification" in window);
    console.log("3. ServiceWorker soportado:", "serviceWorker" in navigator);

    if (!("Notification" in window)) return null;
    if (!("serviceWorker" in navigator)) return null;

    console.log("4. Permiso actual:", Notification.permission);

    const permission = await Notification.requestPermission();
    console.log("4b. Permiso tras solicitud:", permission);
    if (permission !== "granted") return null;

    console.log("5. Registrando Service Worker...");
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("6. SW registrado:", reg.scope);
    await navigator.serviceWorker.ready;
    console.log("7. SW activo y listo");

    console.log("8. Solicitando token FCM...");
    const token = await getToken(getMsg(), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    console.log("9. Token FCM:", token ? token.slice(0, 20) + "..." : "null/vacío");
    return token || null;
  } catch (e) {
    console.error("ERROR en requestNotificationPermission:", e);
    return null;
  }
}

export { onMessage, getMsg as messaging };
