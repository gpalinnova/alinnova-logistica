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

const CAMPOS_OBLIGATORIOS = [
  ['hora_llegada', 'Hora de llegada'],
  ['temperatura_llegada', 'Temperatura de llegada'],
  ['hora_recibido', 'Hora de recibido'],
  ['hora_salida', 'Hora de salida'],
  ['quien_recibe', 'Nombre de quien recibe'],
  ['cargo_recibe', 'Cargo'],
  ['canastillas_presentan', 'Canastillas que se presentan'],
  ['canastillas_retiran', 'Canastillas que se retiran'],
]

// Parsea el campo único "Temperatura de llegada" (texto libre) a las dos
// columnas reales de la tabla. Con "/" el primer trozo es transporte y el
// segundo es producto; sin "/" todo el string va a transporte y producto
// queda NULL. Se guardan como string tal cual, sin convertir a número.
function parseTemperaturaLlegada(raw) {
  const texto = raw.trim()
  const idxSlash = texto.indexOf('/')
  if (idxSlash === -1) {
    return { temperatura_transporte: texto, temperatura_producto: null }
  }
  return {
    temperatura_transporte: texto.slice(0, idxSlash).trim() || null,
    temperatura_producto: texto.slice(idxSlash + 1).trim() || null,
  }
}

// Guarda (upsert) el registro de entrega de un colegio para una fecha.
// ids_sitios recibido es un array JSON de uuids de reforzados_sitios (FK real
// de reforzados_entrega_registro), no los id_sitio_entrega enteros de
// negocio. Cuando la tarjeta viene de una unificación (2+ colegios con mismo
// nombre+horario, ver agruparSitiosParaTarjetas), trae 2+ uuids y se guardan
// todos con los mismos datos en un único upsert de N filas — una sola
// sentencia SQL, atómica por definición, sin necesitar función/transacción
// aparte en la base.
export async function guardarEntregaAction(formData) {
  const fecha = formData.get('fecha')
  const idRuta = formData.get('id_ruta')
  const idsSitios = JSON.parse(formData.get('ids_sitios') || '[]')

  // Defensa en profundidad: aunque el UI del link universal no permite
  // navegar a días pasados, el server rechaza cualquier intento de guardar
  // fuera del día actual (según reloj del servidor).
  if (fecha !== todayLocalISO()) {
    throw new Error('Solo se pueden registrar entregas del día actual.')
  }

  if (!Array.isArray(idsSitios) || idsSitios.length === 0) {
    throw new Error('No se encontraron los sitios a registrar.')
  }

  // Defensa en profundidad: el formulario ya valida en cliente, pero el
  // server vuelve a exigir los campos obligatorios (todos excepto
  // Observaciones) antes de guardar.
  for (const [name, label] of CAMPOS_OBLIGATORIOS) {
    const valor = formData.get(name)
    if (valor === null || String(valor).trim() === '') {
      throw new Error(`El campo "${label}" es obligatorio.`)
    }
  }

  const num = value => (value === null || value === '' ? null : Number(value))
  const { temperatura_transporte, temperatura_producto } = parseTemperaturaLlegada(formData.get('temperatura_llegada'))
  const interventoria = formData.get('interventoria') === 'true'

  const datosComunes = {
    fecha,
    id_ruta: idRuta,
    hora_llegada: formData.get('hora_llegada') || null,
    hora_recibido: formData.get('hora_recibido') || null,
    hora_salida: formData.get('hora_salida') || null,
    temperatura_transporte,
    temperatura_producto,
    quien_recibe: formData.get('quien_recibe') || null,
    cargo_recibe: formData.get('cargo_recibe') || null,
    firma_planillas: formData.get('firma_planillas') === 'true',
    interventoria,
    nombre_interventora: interventoria ? (formData.get('nombre_interventora') || null) : null,
    metodo_conteo: formData.get('metodo_conteo') || 'aleatorio',
    canastillas_presentan: num(formData.get('canastillas_presentan')),
    canastillas_retiran: num(formData.get('canastillas_retiran')),
    observacion: formData.get('observacion') || null,
    updated_at: new Date().toISOString(),
  }

  const payloads = idsSitios.map(idSitioEntrega => ({ ...datosComunes, id_sitio_entrega: idSitioEntrega }))

  const { error } = await supabase
    .from('reforzados_entrega_registro')
    .upsert(payloads, { onConflict: 'fecha,id_sitio_entrega' })

  if (error) throw new Error('No se pudo guardar el registro de entrega.')

  return datosComunes
}
