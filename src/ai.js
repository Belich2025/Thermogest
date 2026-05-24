const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = "llama-3.1-8b-instant";

function extractJSON(text) {
  if(!text) return null;
  // Strip markdown code blocks if present
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Try direct parse first
  try { return JSON.parse(stripped); } catch(_) {}
  // Try to find first { ... } or [ ... ] block
  const objMatch = stripped.match(/(\{[\s\S]*\})/);
  if(objMatch) { try { return JSON.parse(objMatch[1]); } catch(_) {} }
  const arrMatch = stripped.match(/(\[[\s\S]*\])/);
  if(arrMatch) { try { return JSON.parse(arrMatch[1]); } catch(_) {} }
  console.error("No se pudo extraer JSON de:", stripped.slice(0,300));
  return null;
}

async function callAI(systemPrompt, userMessage) {
  console.log("Llamando a Groq...");
  console.log("API Key existe:", !!import.meta.env.VITE_GROQ_API_KEY);
  console.log("API Key primeros chars:", import.meta.env.VITE_GROQ_API_KEY?.slice(0,10));
  console.log("System prompt primeros 200 chars:", systemPrompt.slice(0,200));
  console.log("User message:", userMessage);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });
    console.log("Respuesta status:", response.status);
    const data = await response.json();
    console.log("Respuesta data:", JSON.stringify(data).slice(0,200));
    return data.choices[0].message.content;
  } catch(e) {
    console.error("Error en callAI:", e);
    return null;
  }
}

async function callAIText(systemPrompt, userMessage) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch(e) {
    console.error("Error en callAIText:", e);
    return null;
  }
}

export async function detectarAveria(texto, clientes, tecnicos, materiales) {
  const system = `Eres un asistente para empresas HVAC. Analiza el texto y devuelve un JSON con estos campos exactos:
{"clienteNombre":"nombre del cliente o null","descripcion":"descripción profesional del problema","equipo":"tipo de equipo o null","marca":"marca o null","tecnicoNombre":"nombre del técnico o null","prioridad":"urgente|normal|baja"}

REGLAS CRÍTICAS:
- NUNCA inventes datos que no estén en el texto
- NUNCA rellenes un campo si no se menciona explícitamente
- Si no se menciona el técnico, devuelve tecnicoNombre: null
- Si no se menciona el cliente, devuelve clienteNombre: null
- Solo rellena lo que el usuario mencione de forma explícita

Clientes: ${clientes.slice(0,50).map(c=>c.nombre).join(", ")}
Técnicos: ${tecnicos.map(t=>t.nombre).join(", ")}`;

  console.log("Texto recibido en detectarAveria:", texto);
  console.log("Clientes disponibles:", clientes?.slice(0,5).map(c=>c.nombre));
  const result = await callAI(system, texto);
  const parsed = extractJSON(result);
  console.log("detectarAveria resultado:", parsed);
  return parsed;
}

export async function mejorarDescripcion(texto) {
  const system = "Eres un técnico HVAC profesional. Mejora la redacción del siguiente texto de parte de trabajo haciéndolo más profesional y claro. Devuelve SOLO el texto mejorado, sin explicaciones ni formato markdown.";
  return await callAIText(system, texto);
}

export async function detectarMateriales(texto, catalogo) {
  const system = `Eres un asistente HVAC. Analiza el texto y detecta los materiales mencionados. Devuelve un JSON array:
[{"nombre":"nombre del material","cantidad":1,"precioUnitario":null}]
Catálogo: ${catalogo.slice(0,100).map(m=>m.nombre+" ("+m.precio+"€)").join(", ")}`;

  console.log("Texto recibido en detectarMateriales:", texto);
  const result = await callAI(system, texto);
  const parsed = extractJSON(result);
  console.log("detectarMateriales resultado:", parsed);
  if(Array.isArray(parsed)) return parsed;
  // json_object mode may wrap array: {"materiales": [...]}
  if(parsed && Array.isArray(parsed.materiales)) return parsed.materiales;
  if(parsed && Array.isArray(parsed.items)) return parsed.items;
  return [];
}

export async function asistirPresupuesto(descripcion, catalogo) {
  const system = `Eres un experto en presupuestos HVAC. Genera una estructura de presupuesto basada en la descripción. Devuelve un JSON:
{"descripcionMejorada":"descripción profesional","lineas":[{"concepto":"texto","cantidad":1,"precioSugerido":0}]}
Catálogo: ${catalogo.slice(0,100).map(m=>m.nombre+" ("+m.precio+"€)").join(", ")}`;

  console.log("Descripción recibida:", descripcion);
  const result = await callAI(system, descripcion);
  const parsed = extractJSON(result);
  console.log("asistirPresupuesto resultado:", parsed);
  return parsed;
}

export async function generarLineasPresupuesto(descripcion, catalogo) {
  const system = `Eres un experto en presupuestos HVAC/SAT. Analiza la descripción y genera líneas de presupuesto detalladas. Devuelve SOLO un JSON array:
  [
    {"concepto": "descripción del concepto", "cantidad": número, "precioUnitario": precio_si_esta_en_catalogo_sino_0, "enCatalogo": true_o_false}
  ]

  Reglas:
  - Siempre incluye mano de obra como primera línea
  - Incluye desplazamiento si es una instalación
  - Si el material está en el catálogo usa su precio exacto y marca enCatalogo:true
  - Si el material NO está en el catálogo pon precioUnitario:0 y marca enCatalogo:false
  - Sé específico con los conceptos, profesional y detallado
  - Máximo 10 líneas

  Catálogo disponible: ${catalogo.slice(0,100).map(m=>m.nombre+" ("+m.precio+"€)").join(", ")}

  IMPORTANTE: Responde ÚNICAMENTE con el JSON array, sin texto adicional, sin markdown.`;

  const result = await callAI(system, descripcion);
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    const arr = extractJSON(result);
    return Array.isArray(arr) ? arr : (arr?.lineas||arr?.items||[]);
  }
}

export async function generarPresupuestoCompleto(texto, clientes, tecnicos, averias) {
  const system = `Eres un asistente para empresas HVAC. Analiza el texto y devuelve SOLO un JSON:
  {
    "clienteNombre": "nombre exacto del cliente mencionado o null",
    "descripcion": "descripción profesional del presupuesto",
    "tecnicoNombre": "nombre del técnico mencionado o null",
    "notas": "condiciones o notas mencionadas o null",
    "averiaDescripcion": "descripción de avería mencionada para vincular o null"
  }
  Clientes disponibles: ${clientes.slice(0,50).map(c=>c.nombre).join(", ")}
  Técnicos disponibles: ${tecnicos.map(t=>t.nombre).join(", ")}
  Averías recientes: ${averias.slice(0,20).map(a=>a.id+": "+a.descripcion?.slice(0,50)).join(", ")}
  IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown.`;

  const result = await callAI(system, texto);
  try { return JSON.parse(result); } catch(e) { return extractJSON(result); }
}

export async function generarParteCompleto(texto, catalogo) {
  const system = `Eres un asistente para empresas HVAC. Analiza el texto del técnico y extrae SOLO lo que menciona explícitamente.

REGLAS CRÍTICAS:
- NUNCA inventes datos que no estén en el texto
- NUNCA pongas las horas en la descripción del trabajo
- NUNCA añadas materiales vacíos o sin nombre
- Si no se menciona algo, devuelve null para ese campo

DETECCIÓN DE HORAS:
- "de diez a once" → horaInicio: "10:00", horaFin: "11:00"
- "de 9 a 13:30" → horaInicio: "09:00", horaFin: "13:30"
- "de nueve y media a dos" → horaInicio: "09:30", horaFin: "14:00"
- Si no se mencionan horas → horaInicio: null, horaFin: null

DETECCIÓN DE MATERIALES:
- Solo añade materiales que el técnico mencione explícitamente
- Busca el precio en el catálogo si existe, sino precio: 0
- Formato: {"desc": "nombre exacto del material", "qty": cantidad_mencionada_o_1, "price": precio_catalogo_o_0}
- Si no se menciona ningún material → array vacío []

DETECCIÓN DE FORMA DE PAGO:
- "efectivo", "en mano" → "efectivo"
- "transferencia", "bizum" → "transferencia"
- "tarjeta" → "tarjeta"
- Si no se menciona → null

DESCRIPCIÓN DEL TRABAJO:
- Todo lo que el técnico describe que ha hecho, redactado de forma profesional
- NO incluyas las horas ni los materiales en la descripción
- Si no hay descripción → null

Catálogo de materiales disponible: ${catalogo.slice(0,100).map(m=>m.nombre+" ("+m.precio+"€)").join(", ")}

Devuelve SOLO este JSON sin markdown ni explicaciones:
{
  "horaInicio": "HH:MM o null",
  "horaFin": "HH:MM o null",
  "trabajo": "descripción profesional o null",
  "materiales": [{"desc": "nombre", "qty": 1, "price": 0}],
  "formaPago": "efectivo|transferencia|tarjeta|null"
}`;

  const result = await callAI(system, texto);
  try {
    const parsed = JSON.parse(result);
    if(parsed.materiales) {
      parsed.materiales = parsed.materiales.filter(m => m.desc && m.desc.trim() !== "");
    }
    return parsed;
  } catch(e) { return null; }
}
