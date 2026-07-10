import * as XLSX from 'xlsx'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

// Mapeo flexible: cada campo acepta varios sinónimos de encabezado (mismo
// patrón que lib/parseBaseSuministro.js) para tolerar variaciones de texto
// entre el Excel subido y lo que el usuario pega desde el portapapeles.
const FIELD_SYNONYMS = {
  conductor: ['conductor'],
  auxiliar: ['auxiliar'],
  placa: ['placa'],
  cargue_alinnova: ['cargue alinnova', 'cargue'],
  id_sitio_entrega: ['id sitio entrega', 'id sitio', 'id_sitio_entrega', 'id_sitio'],
  orden_entrega: ['orden entrega', 'orden'],
  horario_entrega_alinnova: ['horario entrega alinnova', 'horario entrega', 'horario alinnova'],
}

const FIELD_LABELS = {
  conductor: 'CONDUCTOR',
  auxiliar: 'AUXILIAR',
  placa: 'PLACA',
  cargue_alinnova: 'CARGUE ALINNOVA',
  id_sitio_entrega: 'ID SITIO ENTREGA',
  orden_entrega: 'ORDEN ENTREGA',
  horario_entrega_alinnova: 'HORARIO ENTREGA ALINNOVA',
}

const REQUIRED_FIELDS = Object.keys(FIELD_SYNONYMS)

function cellText(value) {
  return value == null ? '' : String(value).trim()
}

function normalizeHeader(text) {
  return cellText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Excel serial day 0 = 1899-12-30.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)

export function normalizeHorario(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const totalMs = Math.round(value * 86400000)
    const date = new Date(EXCEL_EPOCH_UTC_MS + totalMs)
    let hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const suffix = hours >= 12 ? 'p.m.' : 'a.m.'
    hours = hours % 12
    if (hours === 0) hours = 12
    return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`
  }
  const text = cellText(value)
  if (!text) return null
  // Hora "pura" sin a.m./p.m. (ej. "5:30" o "5:30:00" pegada como texto).
  const pureMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (pureMatch) {
    let hours = parseInt(pureMatch[1], 10)
    const minutes = pureMatch[2]
    const suffix = hours >= 12 ? 'p.m.' : 'a.m.'
    let h12 = hours % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${minutes} ${suffix}`
  }
  // Ya tiene formato final (ej. "5:30 a.m."): solo se le quitan segundos si trae.
  return text.replace(/(\d{1,2}):(\d{2}):\d{2}/g, '$1:$2')
}

// Limpia ruido de celdas Conductor que en el Excel origen venían mergeadas
// con etiquetas ("CONDUCTOR: NOMBRE   AUXILIAR : NOMBRE AUXILIAR"). Extrae el
// auxiliar embebido y lo usa solo si la columna Auxiliar de la fila está vacía.
function cleanConductorField(rawConductor, rawAuxiliar) {
  let conductorText = cellText(rawConductor)
  let auxiliarFromConductor = null

  const auxiliarSplit = conductorText.match(/^(.*?)AUXILIAR\s*:?\s*(.*)$/is)
  if (auxiliarSplit) {
    conductorText = auxiliarSplit[1]
    auxiliarFromConductor = auxiliarSplit[2].replace(/\s+/g, ' ').trim()
  }

  conductorText = conductorText
    .replace(/CONDUCTOR\s*:?/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const auxiliarPropio = cellText(rawAuxiliar)
  const auxiliar = auxiliarPropio || auxiliarFromConductor || ''

  return { conductor: conductorText, auxiliar }
}

function mapColumns(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader)
  const usedIndices = new Set()
  const colIndex = {}

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let found = -1
    for (const syn of synonyms) {
      const target = normalizeHeader(syn)
      const idx = normalizedHeaders.findIndex((h, i) => h && h === target && !usedIndices.has(i))
      if (idx !== -1) { found = idx; break }
    }
    if (found !== -1) {
      colIndex[field] = found
      usedIndices.add(found)
    }
  }

  return colIndex
}

// Parser común: recibe una matriz de filas (fila 0 = encabezados) y produce
// repartidores + asignaciones. Lo usan tanto el Excel subido como el texto
// pegado desde el portapapeles.
function parseRutasRows(rows) {
  if (!rows || rows.length === 0) throw new Error('No se detectó contenido para procesar.')

  const headerRow = rows[0] || []
  const colIndex = mapColumns(headerRow)

  const faltantes = REQUIRED_FIELDS.filter(f => colIndex[f] === undefined)
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan columnas requeridas: ${faltantes.map(f => FIELD_LABELS[f]).join(', ')}. ` +
      `Encabezados esperados: ${Object.values(FIELD_LABELS).join(' | ')}`
    )
  }

  const asignaciones = []
  const repartidoresMap = new Map()

  // Recuerda el último bloque de repartidor visto (conductor+auxiliar+placa+
  // cargue+horario entrega) para heredarlo en filas hijas de celdas
  // mergeadas, que llegan con esos campos vacíos. Solo cambia de bloque
  // cuando aparece una fila con CONDUCTOR nuevamente lleno.
  let lastBlock = null

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || []
    if (row.every(c => cellText(c) === '')) continue

    const conductorCellRaw = cellText(row[colIndex.conductor])
    let conductor, auxiliar, placa, cargueValue, horarioEntregaValue

    if (conductorCellRaw) {
      const cleaned = cleanConductorField(row[colIndex.conductor], row[colIndex.auxiliar])
      conductor = cleaned.conductor.toUpperCase()
      auxiliar = cleaned.auxiliar.toUpperCase() || null
      placa = cellText(row[colIndex.placa]).toUpperCase()
      cargueValue = row[colIndex.cargue_alinnova]
      horarioEntregaValue = row[colIndex.horario_entrega_alinnova]
      lastBlock = { conductor, auxiliar, placa, cargueValue, horarioEntregaValue }
    } else if (lastBlock) {
      conductor = lastBlock.conductor
      auxiliar = cellText(row[colIndex.auxiliar]).toUpperCase() || lastBlock.auxiliar
      placa = cellText(row[colIndex.placa]).toUpperCase() || lastBlock.placa
      cargueValue = cellText(row[colIndex.cargue_alinnova]) !== '' ? row[colIndex.cargue_alinnova] : lastBlock.cargueValue
      horarioEntregaValue = cellText(row[colIndex.horario_entrega_alinnova]) !== '' ? row[colIndex.horario_entrega_alinnova] : lastBlock.horarioEntregaValue
    } else {
      conductor = ''
      auxiliar = cellText(row[colIndex.auxiliar]).toUpperCase() || null
      placa = cellText(row[colIndex.placa]).toUpperCase()
      cargueValue = row[colIndex.cargue_alinnova]
      horarioEntregaValue = row[colIndex.horario_entrega_alinnova]
    }

    if (!conductor && !placa) continue

    const cargue = normalizeHorario(cargueValue)
    const idSitioRaw = cellText(row[colIndex.id_sitio_entrega])
    const idSitio = idSitioRaw ? parseInt(idSitioRaw, 10) : null
    const ordenRaw = cellText(row[colIndex.orden_entrega])
    const orden = ordenRaw ? parseInt(ordenRaw, 10) : 1
    const horarioEntrega = normalizeHorario(horarioEntregaValue)

    if (!conductor || !placa) {
      throw new Error(`Fila ${r + 1}: CONDUCTOR y PLACA son obligatorios.`)
    }
    if (!idSitio || Number.isNaN(idSitio)) {
      throw new Error(`Fila ${r + 1}: ID SITIO ENTREGA inválido.`)
    }

    const key = `${conductor}||${placa}`
    if (!repartidoresMap.has(key)) {
      repartidoresMap.set(key, { conductor, auxiliar, placa })
    }

    asignaciones.push({
      conductor,
      placa,
      auxiliar,
      id_sitio_entrega: idSitio,
      orden_entrega: Number.isNaN(orden) ? 1 : orden,
      cargue_alinnova: cargue,
      horario_entrega_alinnova: horarioEntrega,
    })
  }

  if (asignaciones.length === 0) {
    throw new Error('No se detectaron asignaciones válidas.')
  }

  return {
    repartidores: Array.from(repartidoresMap.values()),
    asignaciones,
  }
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export function detectMesAnioFromFilename(filename) {
  const upper = filename.toUpperCase()
  for (let i = 0; i < MESES.length; i++) {
    const regex = new RegExp(`${MESES[i]}[^0-9]{0,10}(\\d{4})`)
    const match = upper.match(regex)
    if (match) {
      return { mes: i + 1, año: parseInt(match[1], 10) }
    }
  }
  return null
}

export function parseRutasExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return parseRutasRows(rows)
}

// Pega texto TSV (tal como lo copia Excel al portapapeles: columnas separadas
// por tab, filas por salto de línea) y lo procesa con el mismo parser.
export function parseRutasPaste(text) {
  if (!text || !text.trim()) throw new Error('No hay contenido pegado para analizar.')

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  const rows = lines.map(line => line.split('\t'))
  return parseRutasRows(rows)
}

export function nombreMes(mes, año) {
  return `${MESES[mes - 1]} ${año}`
}

export { MESES }
