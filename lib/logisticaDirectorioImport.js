import * as XLSX from 'xlsx'

const NOMBRE_HOJA_ESPERADA = 'DIRECTORIO_ADMIN'

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

const HEADER_KEYWORDS = {
  punto_wms: 'PUNTO WMS',
  bodega: 'BODEGA',
  cebe_sap: 'CEBE SAP',
  dane_12: 'DANE 12',
  dane_12_sede: 'DANE 12 + SEDE',
  nombre_institucion: 'INSTITUCION EDUCATIVA',
  nombre_sitio: 'NOMBRE SITIO DE ENTREGA',
  cod_localidad: 'COD LOCALIDAD',
  localidad: 'LOCALIDAD',
  direccion: 'DIRECCION',
}

// La fila de encabezados no siempre es la 1 — se busca dinámicamente la fila
// donde coexistan "PUNTO WMS" e "INSTITUCION EDUCATIVA" (columnas obligatorias).
const KEYWORDS_OBLIGATORIOS = ['PUNTO WMS', 'INSTITUCION EDUCATIVA']

function encontrarFilaHeaders(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    const normalizedCells = row.map(normalizarHeaderCell)
    const todasPresentes = KEYWORDS_OBLIGATORIOS.every(k => normalizedCells.includes(k))
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

function elegirHojaDirectorio(workbook) {
  const nombreExacto = workbook.SheetNames.find(n => normalizarTexto(n) === NOMBRE_HOJA_ESPERADA)
  return nombreExacto || workbook.SheetNames[0]
}

// Parsea el Excel del directorio de colegios: detecta la hoja Directorio_Admin
// (o la primera hoja si no la encuentra por nombre), ubica la fila de
// encabezados dinámicamente y devuelve un colegio por fila válida (con
// PUNTO WMS numérico e INSTITUCION EDUCATIVA no vacíos). Si el mismo
// PUNTO WMS aparece más de una vez en el archivo, se queda con la última fila.
export function parsearExcelDirectorio(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas legibles.')
  }

  const nombreHoja = elegirHojaDirectorio(workbook)
  const sheet = workbook.Sheets[nombreHoja]
  if (!sheet) throw new Error('No se pudo leer la hoja del directorio.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  const headerInfo = encontrarFilaHeaders(rows)
  if (!headerInfo) {
    throw new Error('No se encontró la fila de encabezados. Se esperan al menos las columnas PUNTO WMS e INSTITUCION EDUCATIVA.')
  }

  const { headerRowIndex, colIndex } = headerInfo

  function leerCampo(row, field) {
    const idx = colIndex[field]
    if (idx == null || idx < 0) return ''
    return String(row[idx] ?? '').trim()
  }

  const porPunto = new Map()

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || []
    if (row.every(c => normalizarTexto(c) === '')) continue

    const puntoWms = parseInt(leerCampo(row, 'punto_wms'), 10)
    const nombreInstitucion = leerCampo(row, 'nombre_institucion')

    if (!puntoWms || Number.isNaN(puntoWms)) continue
    if (!nombreInstitucion) continue

    porPunto.set(puntoWms, {
      punto_wms: puntoWms,
      bodega: leerCampo(row, 'bodega'),
      cebe_sap: leerCampo(row, 'cebe_sap'),
      dane_12: leerCampo(row, 'dane_12'),
      dane_12_sede: leerCampo(row, 'dane_12_sede'),
      nombre_institucion: nombreInstitucion,
      nombre_sitio: leerCampo(row, 'nombre_sitio'),
      cod_localidad: leerCampo(row, 'cod_localidad'),
      localidad: leerCampo(row, 'localidad'),
      direccion: leerCampo(row, 'direccion'),
    })
  }

  return { colegios: Array.from(porPunto.values()), nombreHoja }
}

// Cruza los colegios parseados del Excel contra logistica_sitios (por
// punto_wms) y arma las filas finales para el upsert. Reglas: nunca se borra
// nada, y un campo vacío en el Excel nunca pisa un valor ya existente en BD.
export function construirPreviewDirectorio(colegiosParsed, sitiosExistentes) {
  const sitiosPorPunto = new Map(sitiosExistentes.map(s => [s.punto_wms, s]))

  const filasParaGuardar = []
  const actualizaciones = []
  const inserciones = []

  for (const c of colegiosParsed) {
    const existente = sitiosPorPunto.get(c.punto_wms)

    const fila = {
      punto_wms: c.punto_wms,
      bodega: c.bodega || existente?.bodega || null,
      cebe_sap: c.cebe_sap || existente?.cebe_sap || null,
      dane_12: c.dane_12 || existente?.dane_12 || null,
      dane_12_sede: c.dane_12_sede || existente?.dane_12_sede || null,
      nombre_institucion: c.nombre_institucion || existente?.nombre_institucion,
      nombre_sitio: c.nombre_sitio || existente?.nombre_sitio || null,
      cod_localidad: c.cod_localidad || existente?.cod_localidad || null,
      localidad: c.localidad || existente?.localidad || 'SIN LOCALIDAD',
      direccion: c.direccion || existente?.direccion || null,
    }

    filasParaGuardar.push(fila)
    if (existente) {
      actualizaciones.push(fila)
    } else {
      inserciones.push(fila)
    }
  }

  return { filasParaGuardar, actualizaciones, inserciones }
}
