import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROJECT_ID   = "thermogest-60f98";
const CLIENT_EMAIL = "firebase-adminsdk-fbsvc@thermogest-60f98.iam.gserviceaccount.com";
const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const FCM_URL      = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JWT RS256 ─────────────────────────────────────────────────────────────────

function b64url(data: ArrayBuffer | string): string {
  const str = typeof data === "string" ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function makeJWT(privateKeyPem: string): Promise<string> {
  // Strip PEM headers and decode base64
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss:   CLIENT_EMAIL,
    sub:   CLIENT_EMAIL,
    aud:   TOKEN_URL,
    iat:   now,
    exp:   now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  }));

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${b64url(signature)}`;
}

async function getAccessToken(privateKeyPem: string): Promise<string> {
  const jwt = await makeJWT(privateKeyPem);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, title, body } = await req.json();

    if (!token || !title) {
      return new Response(JSON.stringify({ error: "token y title son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
    if (!privateKey) {
      return new Response(JSON.stringify({ error: "FIREBASE_PRIVATE_KEY no configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(privateKey);

    const fcmRes = await fetch(FCM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body: body ?? "" },
          webpush: {
            notification: {
              title,
              body:  body ?? "",
              icon:  "/icon-192.png",
              badge: "/icon-192.png",
            },
            fcm_options: { link: "/" },
          },
        },
      }),
    });

    const result = await fcmRes.json();

    if (!fcmRes.ok) {
      console.error("FCM error:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: result }), {
        status: fcmRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, name: result.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
