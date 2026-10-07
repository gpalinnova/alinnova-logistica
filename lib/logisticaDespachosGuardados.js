import { supabase } from './supabase'
import { agruparRemisiones } from '../components/LogisticaWizardPrint'

// Despachos guardados del wizard de Operaciones (Panadería / Gastronomía):
// snapshot completo del wizard en logistica_despachos_guardados.estado para
// reabrirlo, reimprimir y aplicar novedades sin rehacer los 7 pasos.
// No confundir con logistica_despachos (historial de ruteros impresos).
const TABLA = 'logistica_despachos_guardados'

export const ESTADO_VERSION = 1

export const LINEA_DESPACHO_LABEL = { panaderia: 'Panadería', gastronomia: 'Gastronomía' }

// Igual que el historial de ruteros: AM-PM cuenta como panadería; si el
// despacho lleva algún producto de gastronomía, es de gastronomía.
export function lineaDeProductos(productos) {
  return (productos || []).some(p => p.selected && p.linea === 'gastronomia') ? 'gastronomia' : 'panaderia'
}

function pad2(n) { return String(n).padStart(2, '0') }

export function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function nombrePorDefecto(linea, ocsNumeros, fechaISO = new Date().toISOString()) {
  const label = LINEA_DESPACHO_LABEL[linea] || 'Panadería'
  return `${label} – OC ${(ocsNumeros || []).join(', ')} – creado ${fmtFechaHora(fechaISO)}`
}

// JSON con las claves ordenadas: jsonb no conserva el orden de las claves,
// así que para saber si el estado cambió respecto a lo guardado se compara
// en esta forma canónica.
export function firmaEstable(valor) {
  return JSON.stringify(valor, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o }, {})
    : v))
}

// ============================== NUMERACIÓN DE REMISIONES ==============================
// Una remisión = sitio + OC. La clave identifica la remisión dentro del
// despacho aunque el colegio cambie de ruta.
export function claveRemision(punto, oc) {
  return `${punto}|${oc || ''}`
}

// Numeración del wizard (la misma de siempre): cada ruta tiene un bloque de
// 100 números a partir del número inicial, en el orden de las rutas, y
// dentro de la ruta las remisiones van en el orden de agruparRemisiones.
// rutasConFilas: [{ ruta, filas }] en el orden de la lista de rutas.
export function numerarRemisiones(rutasConFilas, nroInicio) {
  const inicio = parseInt(nroInicio, 10) || 1
  const numeros = {}
  rutasConFilas.forEach(({ filas }, rutaIdx) => {
    agruparRemisiones(filas).forEach((rem, idx) => {
      numeros[claveRemision(rem.punto, rem.oc)] = inicio + idx + rutaIdx * 100
    })
  })
  return numeros
}

// Con la numeración ya fija: conserva todos los números asignados y a cada
// remisión que no tenga número le da el siguiente después del mayor.
export function completarNumeros(numerosFijos, rutasConFilas) {
  const numeros = { ...(numerosFijos || {}) }
  let max = Object.values(numeros).reduce((m, n) => Math.max(m, n), 0)
  rutasConFilas.forEach(({ filas }) => {
    agruparRemisiones(filas).forEach(rem => {
      const k = claveRemision(rem.punto, rem.oc)
      if (numeros[k] == null) numeros[k] = ++max
    })
  })
  return numeros
}

// ============================== SUPABASE ==============================
export async function listarDespachosGuardados() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, linea, nombre, created_at, updated_at, resumen:estado->resumen')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function cargarDespachoGuardado(id) {
  const { data, error } = await supabase.from(TABLA).select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// Inserta (sin id) o actualiza (con id). Devuelve { id, updated_at }.
export async function guardarDespachoGuardado({ id, linea, nombre, estado, novedades }) {
  const fila = { linea, nombre, estado, novedades: novedades || [], updated_at: new Date().toISOString() }
  const query = id
    ? supabase.from(TABLA).update(fila).eq('id', id)
    : supabase.from(TABLA).insert(fila)
  const { data, error } = await query.select('id, updated_at').single()
  if (error) throw error
  return data
}

export async function eliminarDespachoGuardado(id) {
  const { error } = await supabase.from(TABLA).delete().eq('id', id)
  if (error) throw error
}
