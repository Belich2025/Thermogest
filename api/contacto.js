import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendPush(token, title, body) {
  try {
    await fetch('https://sqwbxmewymvmnegszzte.supabase.co/functions/v1/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ token, title, body }),
    });
  } catch (e) {
    console.error('sendPush error:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { nombre, email, telefono, direccion, dni, tipo, descripcion } = req.body;

    // Check if client already exists
    let clienteId = null;
    if (telefono && telefono.trim()) {
      const { data: byPhone } = await supabase.from('clientes').select('id').eq('telefono', telefono.trim()).limit(1);
      if (byPhone && byPhone.length > 0) clienteId = byPhone[0].id;
    }
    if (!clienteId && email && email.trim()) {
      const { data: byEmail } = await supabase.from('clientes').select('id').eq('email', email.trim().toLowerCase()).limit(1);
      if (byEmail && byEmail.length > 0) clienteId = byEmail[0].id;
    }

    if (!clienteId) {
      const { data: cliente, error: errCl } = await supabase
        .from('clientes')
        .insert([{ nombre, email: email||null, telefono: telefono||null, direccion: direccion||null, dni: dni||null }])
        .select().single();
      if (errCl) throw errCl;
      clienteId = cliente.id;
    }

    const fecha = new Date().toISOString().slice(0, 10);
    let tipoLabel = tipo === 'averia' ? 'Avería' : tipo === 'mantenimiento' ? 'Mantenimiento' : 'Presupuesto';

    if (tipo === 'presupuesto') {
      const { error } = await supabase.from('presupuestos').insert([{
        cliente_id: clienteId, descripcion, importe: 0, status: 'nuevo',
        notas: 'Solicitud recibida por formulario web',
      }]);
      if (error) throw error;
    } else if (tipo === 'mantenimiento') {
      const { error } = await supabase.from('mantenimientos').insert([{
        cliente_id: clienteId, direccion: direccion||null,
        equipo: 'Por determinar', descripcion,
        fecha_visita: fecha, status: 'nuevo', from_form: true,
      }]);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('averias').insert([{
        cliente_id: clienteId, direccion: direccion||null,
        equipo: 'Por determinar', descripcion,
        status: 'nueva', from_form: true,
      }]);
      if (error) throw error;
    }

    // In-app notifications (admins only)
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('activo', true);
    if (admins && admins.length > 0) {
      await supabase.from('notificaciones').insert(
        admins.map(a => ({
          usuario_id: a.id,
          tipo: tipo,
          titulo: `Nueva solicitud — ${tipoLabel}`,
          mensaje: `${nombre}: ${descripcion?.slice(0, 80)}`,
          leida: false,
        }))
      );
    }

    // Push FCM notifications
    const pushTitle = tipo === 'averia'       ? 'Nuevo aviso entrante'
                    : tipo === 'mantenimiento' ? 'Nuevo mantenimiento entrante'
                                              : 'Nuevo presupuesto entrante';
    const pushBody = `Cliente: ${nombre} - ${(descripcion||'').slice(0, 100)}`;

    const pushQ = supabase.from('profiles').select('fcm_token').eq('activo', true).not('fcm_token', 'is', null);
    const { data: pushProfiles } = tipo === 'presupuesto'
      ? await pushQ.eq('role', 'admin')
      : await pushQ;

    if (pushProfiles?.length) {
      await Promise.all(pushProfiles.map(p => sendPush(p.fcm_token, pushTitle, pushBody)));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contacto error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
