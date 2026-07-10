import * as XLSX from 'xlsx'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const HEADER_ROW_INDEX = 9 // fila 10 (0-based)
const DATA_START_INDEX = 10 // fila 11 (0-based)

const HEADERS = {
  ID_SITIO: 'Id Sitio Entrega',
  LOCALIDAD: 'Localidad',
  PROYECTO_INVERSION: 'Proyecto Inversión',
  NOMBRE_INSTITUCION: 'Nombre Institución Educativa',
  SEDE_EDUCATIVA: 'Sede Educativa',
  SITIO_ENTREGA: 'Sitio de Entrega',
  NOMBRE_DESCRIPCION: 'Nombre y/o Descripcion Sitio de Entrega',
  JORNADA: 'Jornada Entrega',
  HORARIO: 'Horario de Entrega',
  DIRECCION: 'Direccion de Entrega',
  BARRIO: 'Barrio Entrega',
  TIPO_A: 'TIPO A',
  TIPO_B: 'TIPO B',
  TIPO_C: 'TIPO C',
  TIPO_D: 'TIPO D',
  MUESTRA_1: 'MUESTRA TIPO 1',
  MUESTRA_2: 'MUESTRA TIPO 2',
  TOTAL: 'TOTAL',
  FECHA: 'FECHA',
  DIA: 'DIA',
  CRS: 'CRS',
  OBSERVACION: 'OBSERVACIÓN',
  PROVEEDOR: 'PROVEEDOR',
}

function cellText(value) {
  return value == null ? '' : String(value).trim()
}

function normalizeHeader(text) {
  return cellText(text)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cellInt(value) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseInt(cellText(value).replace(/\./g, ''), 10)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function formatFechaISO(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export function detectFechaFromFilename(filename) {
  const upper = filename.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const currentYear = new Date().getFullYear()
  for (let i = 0; i < MESES.length; i++) {
    const mesSinAcento = MESES[i].normalize('NFD').replace(/[̀-ͯ]/g, '')
    const regexConAnio = new RegExp(`(\\d{1,2})[^0-9A-Z]{0,3}${mesSinAcento}[^0-9]{0,10}(\\d{4})`)
    const matchConAnio = upper.match(regexConAnio)
    if (matchConAnio) {
      const dia = parseInt(matchConAnio[1], 10)
      const año = parseInt(matchConAnio[2], 10)
      if (dia >= 1 && dia <= 31) {
        const date = new Date(Date.UTC(año, i, dia))
        return formatFechaISO(date)
      }
    }
    const regexSinAnio = new RegExp(`(\\d{1,2})[^0-9A-Z]{0,3}${mesSinAcento}`)
    const matchSinAnio = upper.match(regexSinAnio)
    if (matchSinAnio) {
      const dia = parseInt(matchSinAnio[1], 10)
      if (dia >= 1 && dia <= 31) {
        const date = new Date(Date.UTC(currentYear, i, dia))
        return formatFechaISO(date)
      }
    }
  }
  return null
}

function findHojaConDatos(workbook) {
  const nombreNumero = workbook.SheetNames.find(n => /^\d{1,2}$/.test(n.trim()))
  if (nombreNumero) return nombreNumero
  return workbook.SheetNames.find(n => {
    const sheet = workbook.Sheets[n]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    return rows.length > DATA_START_INDEX
  }) || workbook.SheetNames[0]
}

export function parseBaseSuministroExcel(arrayBuffer, filename) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = findHojaConDatos(workbook)
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  if (rows.length <= DATA_START_INDEX) {
    throw new Error('El archivo no tiene datos a partir de la fila 11 esperada.')
  }

  const headerRow = rows[HEADER_ROW_INDEX] || []
  const normalizedHeaderRow = headerRow.map(normalizeHeader)
  const colIndex = {}
  for (const [key, label] of Object.entries(HEADERS)) {
    const idx = normalizedHeaderRow.indexOf(normalizeHeader(label))
    if (idx === -1) {
      throw new Error(`Falta la columna requerida "${label}" en la fila 10 del archivo.`)
    }
    colIndex[key] = idx
  }

  const filas = []
  for (let r = DATA_START_INDEX; r < rows.length; r++) {
    const row = rows[r] || []
    const idRaw = cellText(row[colIndex.ID_SITIO])
    if (!idRaw) continue
    const idSitio = Number(idRaw)
    if (!Number.isInteger(idSitio)) continue

    filas.push({
      id_sitio_entrega: idSitio,
      localidad: cellText(row[colIndex.LOCALIDAD]) || null,
      proyecto_inversion: cellText(row[colIndex.PROYECTO_INVERSION]) || null,
      nombre_institucion: cellText(row[colIndex.NOMBRE_INSTITUCION]) || null,
      sede_educativa: cellText(row[colIndex.SEDE_EDUCATIVA]) || null,
      sitio_entrega: cellText(row[colIndex.SITIO_ENTREGA]) || null,
      nombre_descripcion: cellText(row[colIndex.NOMBRE_DESCRIPCION]) || null,
      jornada: cellText(row[colIndex.JORNADA]) || null,
      horario_sugerido: cellText(row[colIndex.HORARIO]) || null,
      direccion: cellText(row[colIndex.DIRECCION]) || null,
      barrio: cellText(row[colIndex.BARRIO]) || null,
      tipo_a: cellInt(row[colIndex.TIPO_A]),
      tipo_b: cellInt(row[colIndex.TIPO_B]),
      tipo_c: cellInt(row[colIndex.TIPO_C]),
      tipo_d: cellInt(row[colIndex.TIPO_D]),
      muestra_tipo_1: cellInt(row[colIndex.MUESTRA_1]),
      muestra_tipo_2: cellInt(row[colIndex.MUESTRA_2]),
      dia_semana: cellText(row[colIndex.DIA]) || null,
      crs: cellText(row[colIndex.CRS]) || null,
      observacion: cellText(row[colIndex.OBSERVACION]) || null,
      proveedor: cellText(row[colIndex.PROVEEDOR]) || 'ALINNOVA',
    })
  }

  if (filas.length === 0) {
    throw new Error('No se detectaron sitios válidos en el archivo.')
  }

  return { filas, sheetName }
}

export { MESES }
