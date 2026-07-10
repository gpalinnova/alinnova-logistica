import * as XLSX from 'xlsx'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const MAX_HEADER_SCAN_ROWS = 25

// Etiquetas legibles para el reporte de mapeo del modal de vista previa.
const FIELD_LABELS = {
  id_sitio_entrega: 'ID Sitio Entrega',
  localidad: 'Localidad',
  proyecto_inversion: 'Proyecto Inversión',
  nombre_institucion: 'Nombre Institución Educativa',
  sede_educativa: 'Sede Educativa',
  sitio_entrega: 'Sitio de Entrega',
  nombre_descripcion: 'Nombre y/o Descripción Sitio de Entrega',
  jornada: 'Jornada Entrega',
  horario_sugerido: 'Horario de Entrega',
  direccion: 'Dirección de Entrega',
  barrio: 'Barrio Entrega',
  tipo_a: 'Tipo A',
  tipo_b: 'Tipo B',
  tipo_c: 'Tipo C',
  tipo_d: 'Tipo D',
  tipo_n: 'Tipo N',
  muestra_tipo_1: 'Muestra Tipo 1',
  muestra_tipo_2: 'Muestra Tipo 2',
  fecha: 'Fecha',
  dia_semana: 'Día',
  crs: 'CRS / CNA',
  observacion: 'Observación',
  proveedor: 'Proveedor',
}

// Orden de prioridad: campos más específicos primero para evitar que un
// sinónimo ambiguo (ej. "sitio entrega") le robe la columna a otro campo.
const FIELD_SYNONYMS = {
  id_sitio_entrega: ['id sitio entrega', 'id_sitio', 'sitio entrega', 'id sitio'],
  localidad: ['localidad'],
  proyecto_inversion: ['proyecto inversion', 'proyecto'],
  nombre_institucion: ['nombre institucion educativa', 'institucion educativa', 'institucion', 'colegio', 'nombre institucion'],
  sede_educativa: ['sede educativa', 'sede'],
  sitio_entrega: ['sitio de entrega', 'sitio entrega'],
  nombre_descripcion: ['nombre y/o descripcion sitio de entrega', 'descripcion sitio', 'nombre descripcion'],
  jornada: ['jornada entrega', 'jornada'],
  horario_sugerido: ['horario de entrega', 'horario', 'horario sugerido'],
  direccion: ['direccion de entrega', 'direccion', 'dirección'],
  barrio: ['barrio entrega', 'barrio'],
  tipo_a: ['tipo a'],
  tipo_b: ['tipo b'],
  tipo_c: ['tipo c'],
  tipo_d: ['tipo d'],
  tipo_n: ['tipo n'],
  muestra_tipo_1: ['muestra tipo 1', 'muestra 1'],
  muestra_tipo_2: ['muestra tipo 2', 'muestra 2'],
  fecha: ['fecha'],
  dia_semana: ['dia', 'día', 'dia semana'],
  crs: ['crs', 'cna'],
  observacion: ['observacion', 'observación', 'novedades', 'novedad', 'observaciones'],
  proveedor: ['proveedor'],
}

const REQUIRED_TIPO_FIELDS = ['tipo_a', 'tipo_b', 'tipo_c', 'tipo_d']
const NUMERIC_FIELDS = ['tipo_a', 'tipo_b', 'tipo_c', 'tipo_d', 'tipo_n', 'muestra_tipo_1', 'muestra_tipo_2']

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

function isFormulaValue(value) {
  return typeof value === 'string' && value.trim().startsWith('=')
}

function cellInt(value) {
  if (value == null || value === '' || isFormulaValue(value)) return 0
  const n = typeof value === 'number' ? value : parseInt(cellText(value).replace(/\./g, ''), 10)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function formatFechaISO(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getText(row, colIndex, field) {
  const idx = colIndex[field]
  if (idx === undefined) return null
  return cellText(row[idx]) || null
}

function getInt(row, colIndex, field) {
  const idx = colIndex[field]
  if (idx === undefined) return 0
  return cellInt(row[idx])
}

function parseFechaCell(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !isNaN(value.getTime())) return formatFechaISO(value)
  const text = cellText(value)
  if (isFormulaValue(text)) return null
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return formatFechaISO(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])))
  m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) return formatFechaISO(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])))
  return null
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export function detectFechaFromFilename(text) {
  if (!text) return null
  const clean = text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^0-9A-Z]+/g, ' ')
    .trim()
  const currentYear = new Date().getFullYear()
  for (let i = 0; i < MESES.length; i++) {
    const mes = MESES[i]
    const regexConAnio = new RegExp(`(\\d{1,2})\\s*(?:DE\\s*)?${mes}\\s*(?:DE\\s*)?(\\d{4})`)
    const matchConAnio = clean.match(regexConAnio)
    if (matchConAnio) {
      const dia = parseInt(matchConAnio[1], 10)
      const anio = parseInt(matchConAnio[2], 10)
      if (dia >= 1 && dia <= 31) return formatFechaISO(new Date(Date.UTC(anio, i, dia)))
    }
    const regexSinAnio = new RegExp(`(\\d{1,2})\\s*(?:DE\\s*)?${mes}`)
    const matchSinAnio = clean.match(regexSinAnio)
    if (matchSinAnio) {
      const dia = parseInt(matchSinAnio[1], 10)
      if (dia >= 1 && dia <= 31) return formatFechaISO(new Date(Date.UTC(currentYear, i, dia)))
    }
  }
  return null
}

function findSheetAndHeaderRow(workbook) {
  const target = normalizeHeader('Id Sitio Entrega')
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    const maxScan = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)
    for (let r = 0; r < maxScan; r++) {
      const row = rows[r] || []
      if (row.some(cell => normalizeHeader(cell).includes(target))) {
        return { sheetName, headerRowIndex: r, rows }
      }
    }
  }
  return null
}

function mapColumns(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader)
  const usedIndices = new Set()
  const colIndex = {}
  const mappedLabel = {}

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
      mappedLabel[field] = cellText(headerRow[found])
    }
  }

  const columnasIgnoradas = normalizedHeaders
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h && !usedIndices.has(i))
    .map(({ i }) => cellText(headerRow[i]))

  return { colIndex, mappedLabel, columnasIgnoradas }
}

export function parseBaseSuministroExcel(arrayBuffer, filename) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas legibles.')
  }

  const found = findSheetAndHeaderRow(workbook)
  if (!found) {
    throw new Error('No se encontró hoja con datos de sitios (falta la columna "Id Sitio Entrega").')
  }
  const { sheetName, headerRowIndex, rows } = found
  const headerRow = rows[headerRowIndex] || []
  const { colIndex, mappedLabel, columnasIgnoradas } = mapColumns(headerRow)

  if (colIndex.id_sitio_entrega === undefined) {
    throw new Error('No se encontró la columna obligatoria "Id Sitio Entrega".')
  }
  if (!REQUIRED_TIPO_FIELDS.some(f => colIndex[f] !== undefined)) {
    throw new Error('No se encontró ninguna columna de tipo obligatoria (Tipo A, B, C o D).')
  }

  const filas = []
  let primeraFechaDatos = null

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || []
    if (row.every(c => cellText(c) === '')) continue

    const idCellRaw = row[colIndex.id_sitio_entrega]
    if (isFormulaValue(idCellRaw)) continue
    const idRaw = cellText(idCellRaw)
    if (!idRaw) continue

    let idSitio = Number(idRaw)
    if (!Number.isInteger(idSitio)) {
      idSitio = Number(idRaw.replace(/\./g, '').replace(',', '.'))
    }
    if (!Number.isInteger(idSitio) || idSitio <= 0) continue

    if (colIndex.fecha !== undefined && !primeraFechaDatos) {
      const fVal = parseFechaCell(row[colIndex.fecha])
      if (fVal) primeraFechaDatos = fVal
    }

    filas.push({
      id_sitio_entrega: idSitio,
      localidad: getText(row, colIndex, 'localidad'),
      proyecto_inversion: getText(row, colIndex, 'proyecto_inversion'),
      nombre_institucion: getText(row, colIndex, 'nombre_institucion'),
      sede_educativa: getText(row, colIndex, 'sede_educativa'),
      sitio_entrega: getText(row, colIndex, 'sitio_entrega'),
      nombre_descripcion: getText(row, colIndex, 'nombre_descripcion'),
      jornada: getText(row, colIndex, 'jornada'),
      horario_sugerido: getText(row, colIndex, 'horario_sugerido'),
      direccion: getText(row, colIndex, 'direccion'),
      barrio: getText(row, colIndex, 'barrio'),
      tipo_a: getInt(row, colIndex, 'tipo_a'),
      tipo_b: getInt(row, colIndex, 'tipo_b'),
      tipo_c: getInt(row, colIndex, 'tipo_c'),
      tipo_d: getInt(row, colIndex, 'tipo_d'),
      tipo_n: getInt(row, colIndex, 'tipo_n'),
      muestra_tipo_1: getInt(row, colIndex, 'muestra_tipo_1'),
      muestra_tipo_2: getInt(row, colIndex, 'muestra_tipo_2'),
      dia_semana: getText(row, colIndex, 'dia_semana'),
      crs: getText(row, colIndex, 'crs'),
      observacion: getText(row, colIndex, 'observacion'),
      proveedor: getText(row, colIndex, 'proveedor') || 'ALINNOVA',
    })
  }

  if (filas.length === 0) {
    throw new Error('No se detectaron sitios válidos en el archivo.')
  }

  const camposFaltantes = Object.keys(FIELD_SYNONYMS).filter(f => colIndex[f] === undefined)
  const tieneMuestras = colIndex.muestra_tipo_1 !== undefined || colIndex.muestra_tipo_2 !== undefined
  const tieneTipoN = colIndex.tipo_n !== undefined

  const fechaFilename = detectFechaFromFilename(filename)
  const fechaHoja = detectFechaFromFilename(sheetName)
  const fechaSugerida = fechaFilename || primeraFechaDatos || fechaHoja || null

  const meta = {
    sheetName,
    headerRowIndex,
    headerRowNumero: headerRowIndex + 1,
    columnasEsperadas: Object.keys(FIELD_SYNONYMS).length,
    columnasEncontradas: Object.keys(colIndex).length,
    camposMapeados: mappedLabel,
    columnasIgnoradas,
    camposFaltantes,
    tieneMuestras,
    tieneTipoN,
  }

  return { filas, sheetName, meta, fechaSugerida }
}

export { MESES, FIELD_LABELS }
