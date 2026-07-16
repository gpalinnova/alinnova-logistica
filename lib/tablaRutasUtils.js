const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

export function formatFechaTitulo(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return `${d} DE ${MESES[m - 1]} DE ${y}`
}

export function buildTituloTabla(fechaISO) {
  return `RUTAS REFRIGERIOS ${formatFechaTitulo(fechaISO)} ALINNOVA`
}

// Convierte horarios tipo "6:00 a.m." / "6:00 AM" / "18:30" a minutos desde
// medianoche para poder ordenar los conductores por Cargue Alinnova. Si el
// texto no calza con el formato esperado devuelve null (se ordena al final).
export function parseHoraToMinutes(horaStr) {
  if (!horaStr) return null
  const s = String(horaStr).trim().toLowerCase()
  const m = s.match(/(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const minutes = parseInt(m[2], 10)
  const suffix = m[3]
  if (suffix) {
    const isPM = suffix.startsWith('p')
    if (isPM && hours !== 12) hours += 12
    if (!isPM && hours === 12) hours = 0
  }
  return hours * 60 + minutes
}

// Quita segundos y normaliza horas "puras" (ej. "5:30:00" o "17:30") a
// formato "H:MM a.m./p.m.". Los rangos ya formateados (ej. "10:30 a.m. a
// 11:00 a.m.") se dejan tal cual, solo se les recortan segundos si traen.
export function formatHorarioCorto(value) {
  if (!value) return value
  const text = String(value).trim()
  if (!text) return value
  const pureMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (pureMatch) {
    let hours = parseInt(pureMatch[1], 10)
    const minutes = pureMatch[2]
    const suffix = hours >= 12 ? 'p.m.' : 'a.m.'
    let h12 = hours % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${minutes} ${suffix}`
  }
  return text.replace(/(\d{1,2}):(\d{2}):\d{2}/g, '$1:$2')
}

// Junta asignaciones de la ruta activa + sitios + base de suministro del día
// en bloques por conductor, ordenados por Cargue Alinnova ascendente y, dentro
// de cada conductor, por Orden Entrega ascendente.
export function buildRutasData(asignaciones, sitiosById, baseByIdSitio) {
  const grupos = new Map()

  for (const a of asignaciones) {
    const base = baseByIdSitio.get(a.id_sitio_entrega)
    if (base && !base.total) continue // TOTAL=0: sin operación ese día, no aparece en Ruta del Día

    const repartidorId = a.repartidor_id
    let g = grupos.get(repartidorId)
    if (!g) {
      g = {
        repartidorId,
        conductor: a.repartidor?.conductor || '-',
        auxiliar: a.repartidor?.auxiliar || '-',
        placa: a.repartidor?.placa || '-',
        cargueAlinnova: null,
        cargueMinutos: null,
        filas: [],
      }
      grupos.set(repartidorId, g)
    }
    if (!g.cargueAlinnova && a.cargue_alinnova) {
      g.cargueAlinnova = formatHorarioCorto(a.cargue_alinnova)
      g.cargueMinutos = parseHoraToMinutes(a.cargue_alinnova)
    }

    const sitio = sitiosById.get(a.id_sitio_entrega)
    const sinBase = !base

    g.filas.push({
      asignacionId: a.id,
      idSitio: a.id_sitio_entrega,
      nombreDescripcion: sitio?.nombre_descripcion || sitio?.nombre_institucion || `ID ${a.id_sitio_entrega} no encontrado`,
      sedeEducativa: sitio?.sede_educativa || '-',
      direccion: sitio?.direccion || '-',
      horarioSugerido: formatHorarioCorto(sitio?.horario_sugerido) || '-',
      horarioEntregaAlinnova: formatHorarioCorto(a.horario_entrega_alinnova) || '-',
      orden: a.orden_entrega,
      sinBase,
    })
  }

  const conductores = Array.from(grupos.values()).map(g => {
    const filas = [...g.filas].sort((a, b) => a.orden - b.orden)
    return { ...g, filas }
  })

  conductores.sort((a, b) => {
    if (a.cargueMinutos != null && b.cargueMinutos != null) return a.cargueMinutos - b.cargueMinutos
    if (a.cargueMinutos != null) return -1
    if (b.cargueMinutos != null) return 1
    return (a.cargueAlinnova || '').localeCompare(b.cargueAlinnova || '')
  })

  return { conductores }
}

function stripAccents(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

const INTERVENTORIA_KEYWORDS = ['INTERVENTORIA', 'ORGANOLEPTICA']

export function isInterventoria(observacion) {
  const norm = stripAccents(observacion)
  return INTERVENTORIA_KEYWORDS.some(k => norm.includes(k))
}

export function extractInterventoriaTipo(observacion) {
  const m = stripAccents(observacion).match(/\(\s*TIPO\s*([12])\s*\)/i)
  return m ? m[1] : null
}

// Detecta los sitios cuya observación de Base de Suministro menciona
// INTERVENTORÍA (con o sin tilde) y arma un bloque por sitio, cruzando con
// el conductor/auxiliar/vehículo de la asignación de ruta (si existe).
export function buildInterventorias(baseRows, sitiosById, asignacionBySitio) {
  const bloques = []
  for (const row of baseRows) {
    if (!isInterventoria(row.observacion)) continue
    const sitio = sitiosById.get(row.id_sitio_entrega)
    const asignacion = asignacionBySitio.get(row.id_sitio_entrega)
    const tipo = extractInterventoriaTipo(row.observacion)
    const sinAsignar = !asignacion
    bloques.push({
      idSitio: row.id_sitio_entrega,
      tipo,
      nombreInstitucion: sitio?.nombre_institucion || `ID ${row.id_sitio_entrega} no encontrado`,
      conductor: asignacion?.repartidor?.conductor || 'Sin asignar',
      auxiliar: asignacion?.repartidor?.auxiliar || 'Sin asignar',
      placa: asignacion?.repartidor?.placa || 'Sin asignar',
      sinAsignar,
    })
  }
  return bloques
}

export function buildInterventoriaBloqueTexto(b) {
  const titulo = b.tipo
    ? `Interventoria Tipo ${b.tipo} - Conductor ${b.conductor}`
    : `Interventoría - Conductor ${b.conductor}`
  return [
    titulo,
    `COLEGIO ${b.nombreInstitucion}`,
    `CONDUCTOR: ${b.conductor}`,
    `AUXILIAR: ${b.auxiliar}`,
    `VEHICULO: ${b.placa}`,
  ].join('\n')
}

export function buildInterventoriasText(bloques) {
  return bloques.map(buildInterventoriaBloqueTexto).join('\n\n')
}
