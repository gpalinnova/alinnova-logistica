import * as XLSX from 'xlsx'

function normKey(k) {
  return String(k).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\s]/g, '')
}

// Convierte fecha_entrega (puede llegar como Date, serial de Excel o texto
// DD/MM/YYYY según el formato de la celda) a ISO YYYY-MM-DD, o null si no
// se puede interpretar.
export function toISODate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'number') {
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000))
    return dt.toISOString().split('T')[0]
  }
  const text = String(value).trim()
  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return null
}

export function fmtDateCorta(isoOrText) {
  if (!isoOrText) return ''
  const m = String(isoOrText).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return String(isoOrText)
}

// Parsea el Excel de OC del wizard: detecta la hoja que trae columnas
// Punto / Numero OC, toma la fila 1 de esa hoja como encabezados y arma
// una fila plana por línea de detalle. Formato esperado: Punto · Numero OC ·
// Nombre_Bodega · Articulo · Nombre · Cantidad · Localidad · Fecha Entrega.
export function parsearExcelWizard(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas legibles.')
  }

  let sheet = null
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name]
    const arr = XLSX.utils.sheet_to_json(s, { header: 1, defval: '', raw: false })
    if (!arr.length) continue
    const head = (arr[0] || []).map(c => String(c).toLowerCase())
    if (head.some(h => h.includes('numero oc')) || head.some(h => h === 'punto')) {
      sheet = s
      break
    }
  }
  if (!sheet) throw new Error('No se encontró una hoja con columnas Punto / Numero OC.')

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  if (!rows.length) throw new Error('El archivo no tiene filas de datos.')

  const keyMap = {}
  Object.keys(rows[0]).forEach(k => { keyMap[normKey(k)] = k })
  const K = {
    punto: keyMap['punto'] || Object.keys(rows[0]).find(k => k.toLowerCase().includes('punto')),
    fecha_ent: keyMap['fechaentrega'],
    oc: keyMap['numerooc'] || Object.keys(rows[0]).find(k => k.toLowerCase().includes('numero oc')),
    bodega: keyMap['nombrebodega'],
    articulo: keyMap['articulo'],
    nombre: keyMap['nombre'],
    cantidad: keyMap['cantidad'],
    localidad: keyMap['localidad'],
  }
  if (!K.punto || !K.oc || !K.articulo || !K.cantidad) {
    throw new Error(`Columnas clave no encontradas. Necesito: Punto, Numero OC, Articulo, Cantidad. Encontré: ${Object.keys(rows[0]).join(', ')}`)
  }

  const rawRows = rows.map(r => ({
    punto: String(r[K.punto]).trim(),
    fecha_entrega: toISODate(r[K.fecha_ent]),
    oc: String(r[K.oc]).trim(),
    bodega: String(r[K.bodega] || '').trim(),
    sap: String(r[K.articulo]).trim(),
    nombre: String(r[K.nombre] || '').trim(),
    cantidad: parseInt(r[K.cantidad], 10) || 0,
    localidad: String(r[K.localidad] || '').trim() || 'SIN LOCALIDAD',
  })).filter(r => r.punto && r.sap && r.cantidad > 0)

  if (!rawRows.length) throw new Error('No hay filas válidas con cantidad mayor a 0.')

  return rawRows
}
