// Reglas de empaque de la modalidad AM-PM: los colegios CON horno reciben
// solo parafinado, los colegios SIN horno reciben parafinado + bolsa. La
// ruta física no cambia (mismo conductor/placa/fecha) — esto solo separa
// qué colegios y qué productos van en cada página impresa / fila de
// historial dentro de una misma ruta.

export function filasAmPm(filas) {
  return filas.filter(f => f.producto?.linea === 'am_pm')
}

export function filasNoAmPm(filas) {
  return filas.filter(f => f.producto?.linea !== 'am_pm')
}

export function separarAmPmPorHorno(filas, colegios) {
  const ampm = filasAmPm(filas)
  const conHorno = ampm.filter(f => Boolean(colegios[f.punto]?.tiene_horno))
  const sinHorno = ampm.filter(f => !colegios[f.punto]?.tiene_horno)
  return { conHorno, sinHorno }
}

export function productosUnicos(filas) {
  const vistos = new Map()
  filas.forEach(f => { if (f.producto && !vistos.has(f.sap)) vistos.set(f.sap, f.producto) })
  return Array.from(vistos.values())
}

function shortName(producto) {
  return producto.nombre || producto.nombreCompleto || producto.sap
}

// "RUTERO {PRODUCTO}" (parafinado+bolsa) o "RUTERO {PRODUCTO} PARAFINADO"
// (solo parafinado). Con varios productos AM-PM en la ruta usa "RUTERO AM-PM".
export function tituloRuteroAmPm(productos, { parafinado } = {}) {
  const base = productos.length === 1 ? `RUTERO ${shortName(productos[0]).toUpperCase()}` : 'RUTERO AM-PM'
  return parafinado ? `${base} PARAFINADO` : base
}

// Las páginas AM-PM muestran el nombre de ruta sin el prefijo "H-" que
// algunas rutas llevan manualmente (conductor y placa son los mismos).
export function nombreRutaSinPrefijoH(nombre) {
  return (nombre || '').replace(/^H-\s*/i, '')
}

function sumarPorSap(filas) {
  return filas.reduce((acc, f) => {
    acc[f.sap] = (acc[f.sap] || 0) + f.cantidad
    return acc
  }, {})
}

// Subtotales de AM-PM por ruta, solo para efectos de impresión/historial —
// no cambian la asignación de colegios a rutas ni el numRutas sugerido.
export function subtotalesAmPmPorRuta(filas, colegios) {
  const { conHorno, sinHorno } = separarAmPmPorHorno(filas, colegios)
  return { subtotal_con_horno: sumarPorSap(conHorno), subtotal_sin_horno: sumarPorSap(sinHorno) }
}
