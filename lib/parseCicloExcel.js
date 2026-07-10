import * as XLSX from 'xlsx'

const SHEET_NAME = 'COMPLEMENTOS REFORZADOS'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const DIA_NOMBRE = {
  0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIÉRCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SÁBADO',
}

function cellText(value) {
  return value == null ? '' : String(value).trim()
}

// Excel serial day 0 = 1899-12-30. Post-1900 only, so the fake Feb-29-1900
// leap day in Excel's serial system doesn't need special-casing here.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)

function toDate(value) {
  if (typeof value === 'number') {
    return new Date(EXCEL_EPOCH_UTC_MS + Math.round(value) * 86400000)
  }
  if (value instanceof Date && !isNaN(value)) {
    // XLSX's serial->Date conversion can land a few ms before midnight due to
    // float precision, so round to the nearest whole day instead of flooring.
    const days = Math.round(value.getTime() / 86400000)
    return new Date(days * 86400000)
  }
  return null
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

export function parseCicloExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find(n => n.trim().toUpperCase() === SHEET_NAME) || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

  let mes = null
  let año = null
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const rowText = (rows[r] || []).map(cellText).join(' ')
    const match = rowText.match(/ROTACI[ÓO]N\s+([A-ZÁÉÍÓÚÑ]+)\s+(\d{4})/i)
    if (match) {
      const nombreMes = match[1].toUpperCase()
      const idx = MESES.indexOf(nombreMes)
      if (idx >= 0) {
        mes = idx + 1
        año = parseInt(match[2], 10)
      }
      break
    }
  }

  if (!mes || !año) {
    throw new Error('No se pudo detectar el mes y año del ciclo. Verifica que el archivo tenga la fila "ROTACIÓN [MES] [AÑO]".')
  }

  const dias = []
  let semanas = 0

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || []
    const cell0 = cellText(row[0]).toUpperCase()
    if (!/^SEMANA\s+\d+/.test(cell0)) continue

    semanas += 1
    const fechaRow = rows[r + 1] || []
    const menuRow = rows[r + 2] || []
    const bebidaRow = rows[r + 3] || []
    const aguaRow = rows[r + 4] || []
    const proteicoRow = rows[r + 5] || []
    const postreRow = rows[r + 7] || []
    const frutaRow = rows[r + 8] || []

    const dayCols = []
    for (let c = 1; c < fechaRow.length; c++) {
      const date = toDate(fechaRow[c])
      if (date) dayCols.push({ col: c, date })
    }

    for (const { col, date } of dayCols) {
      const menuText = cellText(menuRow[col])
      const bebida = cellText(bebidaRow[col])
      const agua = cellText(aguaRow[col])
      const proteico = cellText(proteicoRow[col])
      const postre = cellText(postreRow[col])
      const fruta = cellText(frutaRow[col])

      const combined = [menuText, bebida, agua, proteico, postre, fruta].join(' ').toUpperCase()
      const festivo = combined.includes('FESTIVO')
      const menuMatch = menuText.match(/(\d+)/)

      dias.push({
        fecha: formatFechaISO(date),
        dia_semana: DIA_NOMBRE[date.getUTCDay()],
        menu_numero: festivo ? null : (menuMatch ? parseInt(menuMatch[1], 10) : null),
        bebida_uht: festivo ? null : (bebida || null),
        agua: festivo ? null : (agua || null),
        proteico: festivo ? null : (proteico || null),
        postre: festivo ? null : (postre || null),
        fruta: festivo ? null : (fruta || null),
        festivo,
      })
    }

    r += 8
  }

  if (dias.length === 0) {
    throw new Error('No se detectaron días en el archivo. Verifica el formato de las semanas.')
  }

  dias.sort((a, b) => a.fecha.localeCompare(b.fecha))

  return {
    mes,
    año,
    nombreMes: `${MESES[mes - 1]} ${año}`,
    dias,
    semanas,
  }
}
