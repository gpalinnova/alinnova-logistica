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
  // Excel formatea las celdas de fecha sin formato numérico propio como
  // m/d/yy (año de 2 dígitos, mes primero) — el mismo formato que trae
  // Fecha_Entrega cuando la celda no tiene un formato de fecha explícito.
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (m) {
    const yy = parseInt(m[3], 10)
    const year = yy <= 68 ? 2000 + yy : 1900 + yy
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

// Normaliza cualquier fecha del Excel del cliente (fecha_entrega o
// fecha_consumo, en cualquiera de sus formatos crudos) a un string canónico
// "YYYY-MM-DD", o null si no se puede interpretar — en ese caso el llamador
// debe conservar el texto original para mostrarlo, sin romper la tabla.
// A diferencia de toISODate(), acá el texto SIEMPRE se interpreta como
// día-mes-año (nunca mes-día), incluyendo dd/mm/yy — es la convención de
// fecha del cliente (Colombia), y esta función se usa solo para agrupar y
// mostrar el resumen de productos despachados, no para el resto del Excel.
export function normalizarFecha(valor) {
  if (valor == null || valor === '') return null

  // Los objetos Date de una celda de fecha se leen con los getters locales
  // (nunca toISOString) por la misma razón que la fecha "mañana" sugerida:
  // evitar que un corrimiento de zona horaria cambie el día calendario.
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null
    const yyyy = valor.getFullYear()
    const mm = String(valor.getMonth() + 1).padStart(2, '0')
    const dd = String(valor.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  if (typeof valor === 'number') {
    if (!isFinite(valor)) return null
    const dt = new Date(Math.round((valor - 25569) * 86400 * 1000))
    return dt.toISOString().split('T')[0]
  }

  const text = String(valor).trim()
  if (!text) return null

  // yyyy-mm-dd / yyyy/mm/dd: se detecta porque empieza con 4 dígitos.
  let m = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy, dd-mm-yy, dd.mm.yy —
  // siempre día-mes-año, con o sin ceros a la izquierda.
  m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm2 = m[2].padStart(2, '0')
    const yyyy = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)
    return `${yyyy}-${mm2}-${dd}`
  }

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
    fecha_ent: keyMap['fechaentrega']
      || Object.keys(rows[0]).find(k => normKey(k).includes('fechaentrega')),
    fecha_cons: keyMap['fechasconsumo'] || keyMap['fechaconsumo']
      || Object.keys(rows[0]).find(k => normKey(k).includes('fechaconsumo') || normKey(k).includes('fechasconsumo')),
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

  // fecha_consumo puede venir como fecha real o como texto libre con rango
  // ("21 Y 22 SEPTIEMBRE 2026"): fecha_consumo guarda la versión ISO cuando
  // es interpretable (se usa para el histórico de despachos), y
  // fecha_consumo_texto guarda el valor crudo de la celda, sin parsear ni
  // formatear, para mostrarlo tal cual en el resumen de la OC.
  const rawRows = rows.map(r => ({
    punto: String(r[K.punto]).trim(),
    fecha_entrega: toISODate(r[K.fecha_ent]),
    fecha_consumo: K.fecha_cons ? toISODate(r[K.fecha_cons]) : null,
    fecha_consumo_texto: K.fecha_cons ? String(r[K.fecha_cons] ?? '').trim() : '',
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
