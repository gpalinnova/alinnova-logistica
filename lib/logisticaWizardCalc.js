// Cálculo de canastillas del wizard de Operaciones (Panadería/Gastronomía):
// floor(cantidad/embalaje) canastillas completas + 1 canastilla extra si esa
// cantidad deja unidades sueltas. Se aplica siempre sobre la cantidad total
// del nivel de agregación que se esté mostrando (producto, localidad, ruta).
export function canastillasDe(cantidad, capacidad) {
  const cant = cantidad || 0
  const cap = capacidad || 0
  const base = cap > 0 ? Math.floor(cant / cap) : 0
  const sueltas = cap > 0 ? cant % cap : cant
  return { base, sueltas, total: base + (sueltas > 0 ? 1 : 0) }
}

// Suma canastillas totales para un objeto { sap: cantidad } dado un mapa
// sap -> producto (con .embalaje = capacidad_canastilla).
export function sumarCanastillasPorGrupo(cantidadesPorSap, productosPorSap) {
  let total = 0
  for (const [sap, cant] of Object.entries(cantidadesPorSap)) {
    const producto = productosPorSap.get(sap)
    total += canastillasDe(cant, producto?.embalaje).total
  }
  return total
}

export function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(Math.round(n || 0))
}

export function fmtP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
}

// Nombre del contenido de un rutero a partir de los nombres de sus columnas
// de producto, sin gramaje/presentación y sin repetidos. En la maestra la
// presentación siempre arranca en el primer token (separado por espacio o
// guion) con número ("15G", "1000g"), X+número ("X20G", "x10"), empaque +
// número ("BOLX1000G", "PQX10UN") o una unidad suelta ("UN", "GR", "PQ"):
// se corta desde ahí, lo que también descarta la marca que viene detrás
// ("-SANTINO", "-ALINNOVA"). Los duplicados se detectan con una clave sin
// tildes ni palabras de relleno ("MUFFIN SABOR QUESO" = "MUFFIN CON SABOR A
// QUESO") y de cada grupo se muestra la variante más larga, en el orden de
// aparición de las columnas.
const RE_TOKEN_PRESENTACION = /^(\d|X\d|(BOL|BOLSA|PQ|PAQ|CJ|CAJA)X?\d|(G|GR|GRS|GRAMOS|KG|ML|L|LT|CC|OZ|UN|UND|UNID|UNIDADES|X|PQ|BOL)$)/
const PALABRAS_RELLENO = new Set(['CON', 'A', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y'])

function sinTildes(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

function limpiarPresentacion(nombre) {
  const tokens = String(nombre || '').toUpperCase().split(/[\s-]+/).filter(Boolean)
  const corte = tokens.findIndex(t => RE_TOKEN_PRESENTACION.test(sinTildes(t)))
  return (corte === -1 ? tokens : tokens.slice(0, corte)).join(' ')
}

export function nombreContenidoRutero(nombresProductos) {
  const grupos = new Map()
  ;(nombresProductos || []).forEach(nombre => {
    const limpio = limpiarPresentacion(nombre)
    const clave = sinTildes(limpio).split(' ').filter(w => w && !PALABRAS_RELLENO.has(w)).join(' ')
    if (!clave) return
    const actual = grupos.get(clave)
    if (actual === undefined || limpio.length > actual.length) grupos.set(clave, limpio)
  })
  return Array.from(grupos.values()).join(' · ')
}
