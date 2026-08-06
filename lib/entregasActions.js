'use server'

import { randomBytes } from 'crypto'
import { supabase } from './supabase'

const BASE_URL = 'https://alinnova-logistica.vercel.app'

// Arma la lista de links de registro de entregas para una fecha: una fila
// por repartidor (= ruta del día) que tiene asignaciones y envío ese día.
// Reutiliza el token existente en reforzados_registro_token si ya hay uno
// para esa fecha+ruta (constraint unico_token_ruta_fecha); si no, lo genera.
export async function getLinksRegistroEntregas(fecha) {
  const { data: rutaMesActiva } = await supabase
    .from('reforzados_rutas_mes')
    .select('*')
    .eq('estado', 'activo')
    .maybeSingle()

  if (!rutaMesActiva) return { rutaActiva: false, links: [] }

  const [{ data: asignaciones }, { data: baseRows }] = await Promise.all([
    supabase
      .from('reforzados_ruta_asignaciones')
      .select('id_sitio_entrega, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
      .eq('ruta_mes_id', rutaMesActiva.id),
    supabase
      .from('reforzados_base_suministro')
      .select('id_sitio_entrega')
      .eq('fecha', fecha)
      .gt('total', 0),
  ])

  const sitiosConEnvio = new Set((baseRows || []).map(b => b.id_sitio_entrega))
  const repartidoresMap = new Map()
  for (const a of asignaciones || []) {
    if (!a.repartidor || !sitiosConEnvio.has(a.id_sitio_entrega)) continue
    if (!repartidoresMap.has(a.repartidor.id)) repartidoresMap.set(a.repartidor.id, a.repartidor)
  }
  const repartidores = [...repartidoresMap.values()]
  if (repartidores.length === 0) return { rutaActiva: true, links: [] }

  const idsRepartidores = repartidores.map(r => r.id)
  const { data: tokensExistentes } = await supabase
    .from('reforzados_registro_token')
    .select('*')
    .eq('fecha', fecha)
    .in('id_ruta', idsRepartidores)

  const tokensByRuta = new Map((tokensExistentes || []).map(t => [t.id_ruta, t]))
  const faltantes = repartidores.filter(r => !tokensByRuta.has(r.id))

  if (faltantes.length > 0) {
    const nuevos = faltantes.map(r => ({
      token: randomBytes(8).toString('base64url'),
      fecha,
      id_ruta: r.id,
    }))
    await supabase.from('reforzados_registro_token').insert(nuevos)

    const { data: actualizados } = await supabase
      .from('reforzados_registro_token')
      .select('*')
      .eq('fecha', fecha)
      .in('id_ruta', idsRepartidores)
    for (const t of actualizados || []) tokensByRuta.set(t.id_ruta, t)
  }

  const links = repartidores.map(r => {
    const t = tokensByRuta.get(r.id)
    return {
      repartidorId: r.id,
      conductor: r.conductor,
      auxiliar: r.auxiliar,
      placa: r.placa,
      token: t?.token || null,
      url: t ? `${BASE_URL}/entregas/${t.token}` : null,
    }
  })

  return { rutaActiva: true, links }
}

// Guarda (upsert) el registro de entrega de un colegio para una fecha.
// id_sitio_entrega recibido es el uuid de reforzados_sitios (FK real de
// reforzados_entrega_registro), no el id_sitio_entrega entero de negocio.
export async function guardarEntregaAction(formData) {
  const fecha = formData.get('fecha')
  const idRuta = formData.get('id_ruta')
  const idSitioEntrega = formData.get('id_sitio_entrega')

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
