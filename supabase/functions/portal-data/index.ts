import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST_URL      = `${SUPABASE_URL}/rest/v1`;

const ALLOWED_ORIGINS = [
  "https://thermogest-app.vercel.app",
  "http://localhost:5173",
];

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ── Helper: GET a una tabla via PostgREST con service role ────────────────────
async function rest(table: string, params: Record<string, string>) {
  const url = new URL(`${REST_URL}/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: restHeaders });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "token es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validar token → cliente
    const clientes = await rest("clientes", {
      portal_token: `eq.${token}`,
      select: "id,nombre,email,telefono,direccion",
      limit: "1",
    });

    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ error: "Enlace no válido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cliente = clientes[0];
    const clienteId = cliente.id;

    // 2. Datos del cliente (en paralelo)
    const [averias, presupuestos, instalaciones, equipos, revisiones] = await Promise.all([
      rest("averias", {
        cliente_id: `eq.${clienteId}`,
        select: "id,descripcion,equipo,fecha_visita,status",
        order: "created_at.desc",
      }),
      rest("presupuestos", {
        cliente_id: `eq.${clienteId}`,
        select: "id,descripcion,notas,importe,status",
        order: "created_at.desc",
      }),
      rest("instalaciones", {
        cliente_id: `eq.${clienteId}`,
        select: "id,nombre,tipo,ubicacion,descripcion,notas",
      }),
      rest("equipos", {
        cliente_id: `eq.${clienteId}`,
        select: "id,nombre,marca,modelo,año_instalacion,ubicacion,notas,tipo,instalacion_id,"
          + "activa_mensual,activa_trimestral,activa_semestral,activa_anual,"
          + "proxima_mensual,proxima_trimestral,proxima_semestral,proxima_anual",
      }),
      rest("revisiones", {
        cliente_id: `eq.${clienteId}`,
        select: "id,instalacion_id,tipo,fecha,checks",
        order: "fecha.desc",
      }),
    ]);

    // 3. Partes de las averías del cliente
    const averiaIds = averias.map((a: { id: number }) => a.id);
    let partes: any[] = [];
    if (averiaIds.length > 0) {
      const rawPartes = await rest("partes", {
        averia_id: `in.(${averiaIds.join(",")})`,
        select: "id,averia_id,tecnico_nombre,importe_total,aplicar_iva,fecha,hora_inicio,hora_fin,trabajo,forma_pago,firma_url",
      });
      partes = rawPartes.map((p: any) => {
        const { firma_url, ...rest } = p;
        return { ...rest, firmado: !!firma_url };
      });
    }

    return new Response(
      JSON.stringify({ cliente, averias, presupuestos, instalaciones, equipos, revisiones, partes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("portal-data error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
