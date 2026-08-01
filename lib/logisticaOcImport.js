import * as XLSX from 'xlsx'

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)

function normalizarTexto(value) {
  return (value == null ? '' : String(value))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

function normalizarHeaderCell(value) {
  return normalizarTexto(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

export function detectarModalidad(nombreProducto) {
  const nombre = normalizarTexto(nombreProducto)
  if (nombre.endsWith('-CC') || nombre.includes('-CC-') || nombre.includes(' CC ')) return 'am_pm'
  if (nombre.includes('PATACON') || nombre.includes('FRIJOL') || nombre.includes('GARBANZO')) return 'gastronomia'
  return 'panaderia'
}

export function esRefrigerioReforzado(nombreProducto) {
  return normalizarTexto(nombreProducto).includes('REFRIGERIO REFORZADO')
}

function excelSerialADate(serial) {
  return new Date(EXCEL_EPOCH_UTC_MS + Math.round(serial) * 86400000)
}

function formatFechaISO(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parsearFecha(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return formatFechaISO(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }
  if (typeof value === 'number') {
    const date = excelSerialADate(value)
    return formatFechaISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const text = String(value).trim()
  if (!text) return null

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) return formatFechaISO(match[1], match[2], match[3])

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) return formatFechaISO(match[3], match[2], match[1])

  const asNumber = Number(text)
  if (!Number.isNaN(asNumber) && asNumber > 0) {
    const date = excelSerialADate(asNumber)
    return formatFechaISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }

  return null
}

function normalizarLocalidad(value) {
  const text = normalizarTexto(value)
  if (!text || text === '#N/A' || text === 'N/A') return 'SIN LOCALIDAD'
  return text
}

const HEADER_KEYWORDS = {
  punto_wms: 'PUNTO',
  fecha_entrega: 'FECHA ENTREGA',
  numero_oc: 'NUMERO OC',
  nombre_bodega: 'NOMBRE BODEGA',
  codigo_articulo: 'ARTICULO',
  nombre_producto: 'NOMBRE',
  cantidad: 'CANTIDAD',
  fecha_consumo: 'FECHAS CONSUMO',
  localidad: 'LOCALIDAD',
}

function encontrarFilaHeaders(rows) {
  const keywords = Object.values(HEADER_KEYWORDS)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    const normalizedCells = row.map(normalizarHeaderCell)
    const todasPresentes = keywords.every(keyword => normalizedCells.includes(keyword))
    if (todasPresentes) {
      const colIndex = {}
      for (const [field, keyword] of Object.entries(HEADER_KEYWORDS)) {
        colIndex[field] = normalizedCells.indexOf(keyword)
      }
      return { headerRowIndex: i, colIndex }
    }
  }
  return null
}

function elegirHojaPrincipal(workbook) {
  let mejor = null
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    if (!mejor || rows.length > mejor.rows.length) {
      mejor = { sheetName, rows }
    }
  }
  return mejor
}

export function parsearExcelOc(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas legibles.')
  }

  const hoja = elegirHojaPrincipal(workbook)
  if (!hoja) throw new Error('El archivo no contiene hojas legibles.')

  const headerInfo = encontrarFilaHeaders(hoja.rows)
  if (!headerInfo) {
    throw new Error(
      `No se encontró la fila de encabezados. Se esperan las columnas: ${Object.values(HEADER_KEYWORDS).join(', ')}.`
    )
  }

  const { headerRowIndex, colIndex } = headerInfo
  const todasLasLineas = []
  let lineasReforzados = 0

  for (let r = headerRowIndex + 1; r < hoja.rows.length; r++) {
    const row = hoja.rows[r] || []
    if (row.every(c => normalizarTexto(c) === '')) continue

    const puntoRaw = row[colIndex.punto_wms]
    const puntoWms = parseInt(String(puntoRaw).trim(), 10)
    const nombreProducto = String(row[colIndex.nombre_producto] ?? '').trim()
    const codigoArticuloRaw = row[colIndex.codigo_articulo]
    const codigoArticulo = parseInt(String(codigoArticuloRaw).trim(), 10)
    const cantidad = parseInt(String(row[colIndex.cantidad]).trim(), 10)

    if (!puntoWms || Number.isNaN(puntoWms)) continue
    if (!nombreProducto) continue
    if (!codigoArticulo || Number.isNaN(codigoArticulo)) continue
    if (!cantidad || Number.isNaN(cantidad)) continue

    if (esRefrigerioReforzado(nombreProducto)) {
      lineasReforzados += 1
      continue
    }

    todasLasLineas.push({
      punto_wms: puntoWms,
      fecha_entrega: parsearFecha(row[colIndex.fecha_entrega]),
      numero_oc: String(row[colIndex.numero_oc] ?? '').trim(),
      nombre_bodega: String(row[colIndex.nombre_bodega] ?? '').trim(),
      codigo_articulo: codigoArticulo,
      nombre_producto: nombreProducto,
      cantidad,
      fecha_consumo: parsearFecha(row[colIndex.fecha_consumo]),
      localidad: normalizarLocalidad(row[colIndex.localidad]),
      modalidad_detectada: detectarModalidad(nombreProducto),
    })
  }

  const numerosOc = Array.from(new Set(todasLasLineas.map(l => l.numero_oc).filter(Boolean)))

  const fechaCount = new Map()
  for (const l of todasLasLineas) {
    if (!l.fecha_entrega) continue
    fechaCount.set(l.fecha_entrega, (fechaCount.get(l.fecha_entrega) || 0) + 1)
  }
  let fechaRecepcion = null
  let maxCount = 0
  for (const [fecha, count] of fechaCount.entries()) {
    if (count > maxCount) { maxCount = count; fechaRecepcion = fecha }
  }

  return {
    lineasValidas: todasLasLineas,
    lineasReforzados,
    numerosOc,
    fechaRecepcion,
  }
}

export function construirPreview(lineasValidas, sitiosExistentes, productosExistentes) {
  const sitiosPorPunto = new Map(sitiosExistentes.map(s => [s.punto_wms, s]))
  const productosPorCodigo = new Map(productosExistentes.map(p => [p.codigo_articulo, p]))

  const sitiosNuevosMap = new Map()
  const sitiosConflictosMap = new Map()
  const productosNuevosMap = new Map()
  const localidadMap = new Map()
  const modalidadMap = new Map()

  for (const linea of lineasValidas) {
    const sitioExistente = sitiosPorPunto.get(linea.punto_wms)
    if (!sitioExistente) {
      if (!sitiosNuevosMap.has(linea.punto_wms)) {
        sitiosNuevosMap.set(linea.punto_wms, {
          punto_wms: linea.punto_wms,
          nombre_institucion: linea.nombre_bodega,
          localidad: linea.localidad,
        })
      }
    } else if (sitioExistente.nombre_institucion !== linea.nombre_bodega) {
      if (!sitiosConflictosMap.has(linea.punto_wms)) {
        sitiosConflictosMap.set(linea.punto_wms, {
          punto_wms: linea.punto_wms,
          nombre_actual: sitioExistente.nombre_institucion,
          nombre_nuevo: linea.nombre_bodega,
        })
      }
    }

    const productoExistente = productosPorCodigo.get(linea.codigo_articulo)
    if (!productoExistente && !productosNuevosMap.has(linea.codigo_articulo)) {
      productosNuevosMap.set(linea.codigo_articulo, {
        codigo_articulo: linea.codigo_articulo,
        nombre: linea.nombre_producto,
        modalidad_detectada: linea.modalidad_detectada,
      })
    }

    const locKey = linea.localidad
    if (!localidadMap.has(locKey)) localidadMap.set(locKey, { localidad: locKey, total_lineas: 0, total_unidades: 0 })
    const locEntry = localidadMap.get(locKey)
    locEntry.total_lineas += 1
    locEntry.total_unidades += linea.cantidad

    const modKey = linea.modalidad_detectada
    if (!modalidadMap.has(modKey)) modalidadMap.set(modKey, { modalidad: modKey, total_lineas: 0, total_unidades: 0 })
    const modEntry = modalidadMap.get(modKey)
    modEntry.total_lineas += 1
    modEntry.total_unidades += linea.cantidad
  }

  const resumenPorLocalidad = Array.from(localidadMap.values()).sort((a, b) => b.total_unidades - a.total_unidades)
  const ORDEN_MODALIDAD = ['panaderia', 'am_pm', 'gastronomia']
  const resumenPorModalidad = ORDEN_MODALIDAD
    .map(m => modalidadMap.get(m))
    .filter(Boolean)

  return {
    totalLineas: lineasValidas.length,
    sitiosNuevos: Array.from(sitiosNuevosMap.values()),
    productosNuevos: Array.from(productosNuevosMap.values()),
    sitiosConflictos: Array.from(sitiosConflictosMap.values()),
    resumenPorLocalidad,
    resumenPorModalidad,
  }
}
