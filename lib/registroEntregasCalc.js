// Cálculo del reporte consolidado de entregas: cruza reforzados_entrega_registro
// del día con reforzados_sitios (nombre del colegio), reforzados_repartidores
// (conductor) y reforzados_ruta_asignaciones (orden_entrega). Agrupación igual
// que el Rutero (lib/ruteroCalc.js buildRuteroConductores): grupos por
// conductor ordenados alfabéticamente, filas dentro de cada grupo por
// orden_entrega ascendente.

import { supabase } from './supabase'
import { formatHorarioCorto, parseHoraToMinutes } from './tablaRutasUtils'

// Repartidores (= rutas) con asignaciones en la ruta_mes activa y con envío
// (reforzados_base_suministro.total > 0) para la fecha dada. Mismo cruce que
// getColegiosDelDia (app/entregas/[token]/page.js) pero para todos los
// repartidores a la vez: usado por el dropdown "¿Quién eres?" y por el
// reporte consolidado del hub. Cada repartidor trae `sitios` (sus colegios
// del día, ordenados por orden_entrega).
export async function getRepartidoresActivosFecha(fecha) {
  const { data: rutaMesActiva } = await supabase
    .from('reforzados_rutas_mes')
    .select('id')
    .eq('estado', 'activo')
    .maybeSingle()

  if (!rutaMesActiva) return []

  const [{ data: asignaciones }, { data: baseRows }, { data: sitiosData }] = await Promise.all([
    supabase
      .from('reforzados_ruta_asignaciones')
      .select('id_sitio_entrega, orden_entrega, horario_entrega_alinnova, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
      .eq('ruta_mes_id', rutaMesActiva.id),
    supabase
      .from('reforzados_base_suministro')
      .select('id_sitio_entrega')
      .eq('fecha', fecha)
      .gt('total', 0),
    supabase.from('reforzados_sitios').select('*'),
  ])

  const sitiosConEnvio = new Set((baseRows || []).map(b => b.id_sitio_entrega))
  const sitiosById = new Map((sitiosData || []).map(s => [s.id_sitio_entrega, s]))

  const repartidoresMap = new Map()
  for (const a of asignaciones || []) {
    if (!a.repartidor || !sitiosConEnvio.has(a.id_sitio_entrega)) continue
    const sitio = sitiosById.get(a.id_sitio_entrega)
    if (!sitio) continue

    let r = repartidoresMap.get(a.repartidor.id)
    if (!r) {
      r = { ...a.repartidor, sitios: [] }
      repartidoresMap.set(a.repartidor.id, r)
    }
    r.sitios.push({
      idSitioEntrega: a.id_sitio_entrega,
      sitioId: sitio.id,
      orden: a.orden_entrega,
      nombreInstitucion: sitio.nombre_institucion,
      direccion: sitio.direccion,
      localidad: sitio.localidad,
      horarioEsperado: formatHorarioCorto(a.horario_entrega_alinnova) || null,
      horarioEsperadoMinutos: parseHoraToMinutes(a.horario_entrega_alinnova),
    })
  }

  const repartidores = [...repartidoresMap.values()]
  for (const r of repartidores) {
    r.sitios.sort((x, y) => x.orden - y.orden)
    asignarTurnosPorColegio(r.sitios)
  }
  repartidores.sort((a, b) => a.conductor.localeCompare(b.conductor, 'es'))
  return repartidores
}

// Cuando un mismo colegio (mismo nombre, case-insensitive) aparece 2+ veces
// en la lista de un conductor (turnos distintos, con distintos sitios y
// horarios), se numeran por horario esperado ascendente. Si el nombre
// aparece una sola vez no recibe turno (queda en null) — el chip de turno
// solo debe verse cuando hay ambigüedad real entre tarjetas. Exportada
// porque agruparSitiosParaTarjetas la reutiliza sobre tarjetas ya unificadas.
export function asignarTurnosPorColegio(sitios) {
  const grupos = new Map()
  for (const s of sitios) {
    const key = (s.nombreInstitucion || '').trim().toLowerCase()
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(s)
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) {
      grupo[0].turno = null
      continue
    }
    const ordenado = [...grupo].sort((a, b) => (a.horarioEsperadoMinutos ?? Infinity) - (b.horarioEsperadoMinutos ?? Infinity))
    ordenado.forEach((s, idx) => { s.turno = idx + 1 })
  }
}

// Unifica en una sola tarjeta los sitios de un mismo conductor que comparten
// colegio (nombre) y orden_entrega — regla automática por clave
// nombre+orden, sin tabla ni lista manual: si el patrón de colegios se
// repite en próximos meses, la unificación aplica sola. orden_entrega se usa
// en vez de horario porque es responsabilidad de planeación y refleja la
// parada física del camión; el horario puede quedar inconsistente entre IDs
// de una misma visita (caso Compartir Recuerdo). Se usa solo para armar las
// tarjetas del formulario del conductor (getDatosDelDia en
// app/entregas/[token]/page.js); no toca getRepartidoresActivosFecha ni el
// reporte/PDF consolidado del hub, que siguen viendo cada sitio por su ID.
export function agruparSitiosParaTarjetas(sitios) {
  const grupos = new Map()
  for (const s of sitios) {
    const clave = `${(s.nombreInstitucion || '').trim().replace(/\s+/g, ' ').toUpperCase()}|${s.orden ?? s.horarioEsperadoMinutos ?? ''}`
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(s)
  }

  const tarjetas = [...grupos.values()].map(grupo => {
    const primero = grupo[0]
    return {
      nombreInstitucion: primero.nombreInstitucion,
      direccion: primero.direccion,
      localidad: primero.localidad,
      horarioEsperado: primero.horarioEsperado,
      horarioEsperadoMinutos: primero.horarioEsperadoMinutos,
      orden: Math.min(...grupo.map(s => s.orden)),
      sitioIds: grupo.map(s => s.sitioId),
      idsSitioEntrega: grupo.map(s => s.idSitioEntrega),
    }
  })

  tarjetas.sort((a, b) => a.orden - b.orden)
  asignarTurnosPorColegio(tarjetas)
  return tarjetas
}

// Reporte consolidado para el Bloque 3 del modal: por cada conductor activo
// ese día (aunque no haya registrado nada aún), cuántas entregas lleva de
// cuántas le corresponden. reforzados_entrega_registro.id_ruta guarda el id
// del repartidor directamente (ver guardarEntregaAction).
export async function fetchReporteConductoresDia(fecha) {
  const activos = await getRepartidoresActivosFecha(fecha)
  if (activos.length === 0) return { conductores: [], totalEntregas: 0, totalConductoresActivos: 0 }

  const { data: registros } = await supabase
    .from('reforzados_entrega_registro')
    .select('id_ruta')
    .eq('fecha', fecha)
    .in('id_ruta', activos.map(a => a.id))

  const countByRuta = new Map()
  for (const r of registros || []) {
    countByRuta.set(r.id_ruta, (countByRuta.get(r.id_ruta) || 0) + 1)
  }

  const conductores = activos.map(a => {
    const total = a.sitios.length
    const entregados = Math.min(countByRuta.get(a.id) || 0, total)
    return {
      repartidorId: a.id,
      conductor: a.conductor,
      entregados,
      total,
      pct: total > 0 ? Math.round((entregados / total) * 100) : 0,
    }
  })

  const totalEntregas = conductores.reduce((s, c) => s + c.entregados, 0)
  return { conductores, totalEntregas, totalConductoresActivos: conductores.length }
}

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
