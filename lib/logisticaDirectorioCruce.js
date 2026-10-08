// Cruce de los puntos de una OC contra el directorio de colegios
// (logistica_sitios) y reparación del texto con tildes mal decodificado.

// Bytes 0x80–0x9F de Windows-1252 → carácter Unicode. Sirve para revertir
// texto UTF-8 que se leyó como 1252 ("GARZÃ“N" → "GARZÓN").
const CP1252_ALTO = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
}

function byteCp1252(ch) {
  const c = ch.codePointAt(0)
  if (c <= 0xFF) return c
  return CP1252_ALTO[c] ?? null
}

// Una secuencia Ã/Â + carácter de continuación es UTF-8 leído como 1252.
const MOJIBAKE_RE = /[ÃÂ][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™�]/

let decoderUtf8 = null

// Repara mojibake UTF-8→1252 en nombres y direcciones. Primero intenta
// revertir la cadena completa (re-codificar a 1252 y leer como UTF-8); si
// algún byte se perdió (Ã + "�"), reemplaza por pares conocidos. Si el texto
// no tiene mojibake se devuelve igual.
export function repararMojibake(valor) {
  if (valor == null) return valor
  const s = String(valor)
  if (!MOJIBAKE_RE.test(s)) return s

  const bytes = []
  let reversible = true
  for (const ch of s) {
    const b = byteCp1252(ch)
    if (b == null) { reversible = false; break }
    bytes.push(b)
  }
  if (reversible && typeof TextDecoder !== 'undefined') {
    try {
      decoderUtf8 = decoderUtf8 || new TextDecoder('utf-8', { fatal: true })
      return decoderUtf8.decode(new Uint8Array(bytes))
    } catch { /* no era UTF-8 válido: se usa la tabla */ }
  }

  return s
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ').replace(/Ã¼/g, 'ü')
    .replace(/Ã\u0081/g, 'Á').replace(/Ã‰/g, 'É').replace(/Ã\u008D/g, 'Í').replace(/Ã“/g, 'Ó').replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ').replace(/Ãœ/g, 'Ü')
    // Í y Á caen en bytes que 1252 no define; si el lector los cambió por
    // "�" no se pueden distinguir y se asume Í (la más frecuente en nombres).
    .replace(/Ã�/g, 'Í')
    .replace(/Â([ -¿])/g, '$1')
}

// Punto WMS normalizado: texto sin espacios, sin ".0" de Excel y sin ceros a
// la izquierda. logistica_sitios.punto_wms es integer; la OC lo trae como texto.
export function normPunto(valor) {
  const s = String(valor ?? '').trim().replace(/\.0+$/, '')
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s
}

// Nombre normalizado para el cruce de respaldo: sin tildes, mayúsculas y
// espacios colapsados.
export function normNombre(valor) {
  return repararMojibake(String(valor ?? ''))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}

export function indexarDirectorio(sitios) {
  return new Map((sitios || []).map(s => [normPunto(s.punto_wms), s]))
}

// Índice por nombre (institución y sitio) con solo los nombres que
// identifican a un único sitio: un nombre repetido no sirve para cruzar.
export function indexarDirectorioPorNombre(directorio) {
  const m = new Map()
  const repetidos = new Set()
  directorio.forEach(s => {
    new Set([normNombre(s.nombre_institucion), normNombre(s.nombre_sitio)]).forEach(n => {
      if (!n) return
      if (m.has(n) && m.get(n) !== s) repetidos.add(n)
      else m.set(n, s)
    })
  })
  repetidos.forEach(n => m.delete(n))
  return m
}

// Busca el sitio del directorio para un punto de la OC: primero por punto
// WMS normalizado y, solo si no aparece, por nombre normalizado.
export function buscarSitio(directorio, porNombre, punto, nombre) {
  const porPunto = directorio.get(normPunto(punto))
  if (porPunto) return porPunto
  const n = normNombre(nombre)
  return (n && porNombre && porNombre.get(n)) || null
}

// Localidad del punto: la del directorio si el punto está ahí (la OC puede
// traerla vacía para colegios nuevos); si no, la de la OC, llevada al nombre
// canónico del directorio cuando coincide sin tildes ni espacios.
export function localidadDelPunto(sitio, localidadOc, localidadesCanonicas) {
  const delDirectorio = String(sitio?.localidad || '').trim()
  if (delDirectorio) return delDirectorio
  const oc = String(localidadOc || '').trim()
  if (!oc || oc === 'SIN LOCALIDAD') return 'SIN LOCALIDAD'
  return localidadesCanonicas?.get(normNombre(oc)) || oc
}

export function indexarLocalidades(directorio) {
  const m = new Map()
  directorio.forEach(s => {
    const loc = String(s.localidad || '').trim()
    if (loc && loc !== 'SIN LOCALIDAD') m.set(normNombre(loc), loc)
  })
  return m
}
