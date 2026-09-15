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
