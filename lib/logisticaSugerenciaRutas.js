// Sugiere cómo partir los sitios de una localidad del wizard de Logística en
// sub-rutas, siguiendo los umbrales configurados en Data Maestra → Logística
// (logistica_grupos_ruteo / logistica_subzonas). Función pura: no importa
// supabase ni React, para poder testearla aislada del componente del wizard.

// Cuando los sitios de una misma "localidad" (texto libre del Excel de OC)
// resuelven a más de un grupo de ruteo -- caso raro, ya que la localidad del
// Excel casi siempre corresponde 1:1 a un grupo, pero puede pasar si algún
// sitio quedó con una subzona de otra zona -- se toma como "dominante" el
// grupo con más sitios de esa localidad (empate: gana el primero que
// aparece en sitiosDeLocalidad). Los sitios de los grupos minoritarios se
// anexan a la ÚLTIMA sub-ruta del grupo dominante en vez de quedar sin
// sugerencia: en la práctica casi siempre son 1-2 sitios y es mejor que
// viajen en una ruta ya armada a que el usuario tenga que armarles una ruta
// aparte para tan pocos sitios.
//
// "Sin número" en el nombre de ruta (ej. "SUMAPAZ" en vez de "SUMAPAZ 1")
// se decide por el RESULTADO del umbral (asignaciones.length <= 1), no por
// max_subzonas/carro_dedicado del grupo directamente. Para grupos de 1 sola
// subzona (o carro_dedicado) esto es siempre equivalente -- no hay nada que
// partir -- pero además garantiza que el nombre de ruta que arma este módulo
// coincida siempre con el que arma el wizard (que numera sus N rutas según
// numRutasSugerido, no según una propiedad estática del grupo).
export function sugerirParticion({ sitiosDeLocalidad, gruposRuteo, subzonas }) {
  const sitiosSinSubzona = []
  const porGrupo = new Map() // grupoCodigo -> [{ punto, ordenDentroGrupo }]

  ;(sitiosDeLocalidad || []).forEach(sitio => {
    const subzona = sitio.subzona_codigo ? subzonas.get(sitio.subzona_codigo) : null
    if (!subzona) {
      sitiosSinSubzona.push(sitio.punto)
      return
    }
    const grupoCodigo = subzona.grupo_ruteo_codigo
    if (!porGrupo.has(grupoCodigo)) porGrupo.set(grupoCodigo, [])
    porGrupo.get(grupoCodigo).push({ punto: sitio.punto, ordenDentroGrupo: subzona.orden_dentro_grupo })
  })

  const vacio = {
    grupoCodigo: null, numRutasSugerido: 1, asignacionPorPunto: {},
    destinoFijo: null, carroDedicado: false, maxSitiosTramo: null, sitiosSinSubzona,
  }
  if (porGrupo.size === 0) return vacio

  let grupoCodigo = null
  let maxCount = -1
  porGrupo.forEach((lista, codigo) => {
    if (lista.length > maxCount) { maxCount = lista.length; grupoCodigo = codigo }
  })

  const grupo = gruposRuteo.get(grupoCodigo)
  if (!grupo) return vacio

  const sitiosGrupo = porGrupo.get(grupoCodigo)
  const umbrales = Array.isArray(grupo.umbrales) ? grupo.umbrales : []
  const tramo = umbrales.find(u => sitiosGrupo.length <= u.max_sitios) || umbrales[umbrales.length - 1]
  const asignaciones = (tramo && Array.isArray(tramo.asignaciones) && tramo.asignaciones.length)
    ? tramo.asignaciones
    : [sitiosGrupo.map(s => s.ordenDentroGrupo)]

  const sinNumero = asignaciones.length <= 1
  const nombreRuta = idx => (sinNumero ? grupo.prefijo_ruta : `${grupo.prefijo_ruta} ${idx + 1}`)

  const ordenARutaIdx = new Map()
  asignaciones.forEach((ordenes, idx) => { ordenes.forEach(orden => ordenARutaIdx.set(orden, idx)) })
  const ultimoIdx = asignaciones.length - 1

  const asignacionPorPunto = {}
  sitiosGrupo.forEach(s => {
    const idx = ordenARutaIdx.has(s.ordenDentroGrupo) ? ordenARutaIdx.get(s.ordenDentroGrupo) : ultimoIdx
    asignacionPorPunto[s.punto] = nombreRuta(idx)
  })
  porGrupo.forEach((lista, codigo) => {
    if (codigo === grupoCodigo) return
    lista.forEach(s => { asignacionPorPunto[s.punto] = nombreRuta(ultimoIdx) })
  })

  return {
    grupoCodigo,
    numRutasSugerido: Math.max(1, asignaciones.length),
    asignacionPorPunto,
    destinoFijo: grupo.destino_fijo || null,
    carroDedicado: Boolean(grupo.carro_dedicado),
    maxSitiosTramo: tramo ? tramo.max_sitios : null,
    sitiosSinSubzona,
  }
}
