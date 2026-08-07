'use server'

import { randomBytes } from 'crypto'
import { supabase } from './supabase'
import { todayLocalISO } from './tablaWhatsappUtils'

const BASE_URL = 'https://alinnova-logistica.vercel.app'

// Link universal de registro de entregas: el token "activo" es el registro
// con revoked_at IS NULL más reciente en reforzados_registro_config. La
// tabla reforzados_registro_token (modelo anterior, un token por
// conductor+fecha) ya no se usa desde aquí; se deja intacta.
export async function getRegistroUniversal() {
  const { data } = await supabase
    .from('reforzados_registro_config')
    .select('*')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { token: data.token, url: `${BASE_URL}/entregas/${data.token}` }
}

// Revoca el token universal activo y crea uno nuevo. Nunca se borra nada.
export async function regenerarRegistroUniversalAction() {
  const { data: activo } = await supabase
    .from('reforzados_registro_config')
    .select('id')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activo) {
    await supabase
      .from('reforzados_registro_config')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', activo.id)
  }

  const nuevoToken = randomBytes(8).toString('base64url')
  await supabase.from('reforzados_registro_config').insert({ token: nuevoToken })

  return { token: nuevoToken, url: `${BASE_URL}/entregas/${nuevoToken}` }
}

// Guarda (upsert) el registro de entrega de un colegio para una fecha.
// id_sitio_entrega recibido es el uuid de reforzados_sitios (FK real de
// reforzados_entrega_registro), no el id_sitio_entrega entero de negocio.
export async function guardarEntregaAction(formData) {
  const fecha = formData.get('fecha')
  const idRuta = formData.get('id_ruta')
  const idSitioEntrega = formData.get('id_sitio_entrega')

  // Defensa en profundidad: aunque el UI del link universal no permite
  // navegar a días pasados, el server rechaza cualquier intento de guardar
  // fuera del día actual (según reloj del servidor).
  if (fecha !== todayLocalISO()) {
    throw new Error('Solo se pueden registrar entregas del día actual.')
  }

  const num = value => (value === null || value === '' ? null : Number(value))

  const payload = {
    fecha,
    id_ruta: idRuta,
    id_sitio_entrega: idSitioEntrega,
    hora_llegada: formData.get('hora_llegada') || null,
    hora_recibido: formData.get('hora_recibido') || null,
    hora_salida: formData.get('hora_salida') || null,
    temperatura_transporte: formData.get('temperatura_transporte') || null,
    temperatura_producto: formData.get('temperatura_producto') || null,
    quien_recibe: formData.get('quien_recibe') || null,
    cargo_recibe: formData.get('cargo_recibe') || null,
    firma_planillas: formData.get('firma_planillas') === 'true',
    interventoria: formData.get('interventoria') === 'true',
    metodo_conteo: formData.get('metodo_conteo') || 'aleatorio',
    canastillas_presentan: num(formData.get('canastillas_presentan')),
    canastillas_retiran: num(formData.get('canastillas_retiran')),
    observacion: formData.get('observacion') || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('reforzados_entrega_registro')
    .upsert(payload, { onConflict: 'fecha,id_sitio_entrega' })

  if (error) throw new Error('No se pudo guardar el registro de entrega.')

  return payload
}
