import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accion, email, password, nombre, telefono, role, color, userId } = req.body;

  try {
    if (accion === 'crear') {
      // Crear usuario en Auth
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true, // confirmar automáticamente sin email
      });
      if (authErr) throw authErr;

      const uid = authData.user.id;

      // Crear perfil
      const { error: profErr } = await supabase.from('profiles').upsert([{
        id: uid,
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono || null,
        role: role || 'tecnico',
        color: color || '#1d4ed8',
        activo: true,
      }]);
      if (profErr) throw profErr;

      return res.status(200).json({ ok: true, id: uid });
    }

    if (accion === 'eliminar') {
      // Eliminar de Auth
      const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
      if (authErr) throw authErr;

      // Eliminar perfil
      await supabase.from('profiles').delete().eq('id', userId);

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });
  } catch (err) {
    console.error('Usuarios error:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
