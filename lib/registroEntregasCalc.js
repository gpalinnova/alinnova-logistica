// Cálculo del reporte consolidado de entregas: cruza reforzados_entrega_registro
// del día con reforzados_sitios (nombre del colegio), reforzados_repartidores
// (conductor) y reforzados_ruta_asignaciones (orden_entrega). Agrupación igual
// que el Rutero (lib/ruteroCalc.js buildRuteroConductores): grupos por
// conductor ordenados alfabéticamente, filas dentro de cada grupo por
// orden_entrega ascendente.

import { supabase } from './supabase'

function formatTemperatura(transporte, producto) {
  const partes = []
  if (transporte) partes.push(`T ${transporte}`)
  if (producto) partes.push(`P ${producto}`)
  return partes.length ? partes.join(' / ') : '—'
}

function formatCanastillas(presentan, retiran) {
  if (presentan == null && retiran == null) return '—'
  return `${presentan ?? '-'} / ${retiran ?? '-'}`
}

export function buildRegistroEntregasConductores(registros, sitiosById, repartidoresById, asignaciones) {
  const asigMap = new Map(
    (asignaciones || []).map(a => [`${a.repartidor_id}__${a.id_sitio_entrega}`, a.orden_entrega])
  )

  const grupos = new Map()

  for (const r of registros || []) {
    const sitio = sitiosById.get(r.id_sitio_entrega)
    const repartidor = repartidoresById.get(r.id_ruta)

    let g = grupos.get(r.id_ruta)
    if (!g) {
      g = { repartidorId: r.id_ruta, conductor: repartidor?.conductor || '-', filas: [] }
      grupos.set(r.id_ruta, g)
    }

    const orden = sitio ? asigMap.get(`${r.id_ruta}__${sitio.id_sitio_entrega}`) : undefined

    g.filas.push({
      orden: orden ?? Infinity,
      nombreInstitucion: sitio?.nombre_institucion || 'Sitio sin datos maestro',
      horaLlegada: r.hora_llegada ? r.hora_llegada.slice(0, 5) : '',
      horaRecibido: r.hora_recibido ? r.hora_recibido.slice(0, 5) : '',
      horaSalida: r.hora_salida ? r.hora_salida.slice(0, 5) : '',
      temperaturaTexto: formatTemperatura(r.temperatura_transporte, r.temperatura_producto),
      quienRecibe: r.quien_recibe || '—',
      cargo: r.cargo_recibe || '—',
      planillasTexto: r.firma_planillas ? 'Sí' : 'No',
      interventoriaTexto: r.interventoria ? 'Sí' : 'No',
      canastillasTexto: formatCanastillas(r.canastillas_presentan, r.canastillas_retiran),
      observacion: r.observacion || '',
    })
  }

  const conductores = Array.from(grupos.values()).map(g => ({
    ...g,
    filas: [...g.filas].sort((a, b) => a.orden - b.orden),
  }))

  conductores.sort((a, b) => a.conductor.localeCompare(b.conductor, 'es'))
  return conductores
}

// Trae y arma los conductores/filas del reporte consolidado para una fecha.
// Usado tanto para el contador del modal como para el PDF (misma data).
export async function fetchRegistroEntregasConductores(fecha) {
  const { data: registros } = await supabase
    .from('reforzados_entrega_registro')
    .select('*')
    .eq('fecha', fecha)

  if (!registros || registros.length === 0) return []

  const idsRuta = [...new Set(registros.map(r => r.id_ruta))]
  const idsSitio = [...new Set(registros.map(r => r.id_sitio_entrega))]

  const [{ data: repartidoresData }, { data: sitiosData }, { data: rutaMesActiva }] = await Promise.all([
    supabase.from('reforzados_repartidores').select('id, conductor').in('id', idsRuta),
    supabase.from('reforzados_sitios').select('id, id_sitio_entrega, nombre_institucion').in('id', idsSitio),
    supabase.from('reforzados_rutas_mes').select('id').eq('estado', 'activo').maybeSingle(),
  ])

  const repartidoresById = new Map((repartidoresData || []).map(r => [r.id, r]))
  const sitiosById = new Map((sitiosData || []).map(s => [s.id, s]))

  let asignaciones = []
  if (rutaMesActiva) {
    const { data: asigData } = await supabase
      .from('reforzados_ruta_asignaciones')
      .select('repartidor_id, id_sitio_entrega, orden_entrega')
      .eq('ruta_mes_id', rutaMesActiva.id)
      .in('repartidor_id', idsRuta)
    asignaciones = asigData || []
  }

  return buildRegistroEntregasConductores(registros, sitiosById, repartidoresById, asignaciones)
}
