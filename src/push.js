import { supabase } from "./supabase.js";

export async function sendPushNotification(profiles, title, body, role) {
  const targets = (profiles||[]).filter(p=>
    (role==null||p.role===role) && p.fcm_token && p.activo!==false
  );
  const tokensUnicos = [...new Set(targets.map(p=>p.fcm_token))];
  console.log("Enviando", tokensUnicos.length, "notificaciones");
  await Promise.all(tokensUnicos.map(token=>
    supabase.functions.invoke("send-notification", { body:{ token, title, body } })
      .catch(e=>console.error("FCM push error:", e))
  ));
}
