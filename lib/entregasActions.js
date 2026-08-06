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
