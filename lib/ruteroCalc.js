// Cálculo del Rutero: cruza rutas activas + base de suministro + menú del día
// (reforzados_ciclo_dias) + empaques (reforzados_productos) para armar, por
// conductor, las cantidades y canastillas de cada componente del menú.

function normalizeMatch(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[()]/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Empareja el texto libre del ciclo (ej. "NECTAR DE FRUTA\n(Néctar de mango)")
// contra el catálogo de productos del mismo componente. Prioriza igualdad
// exacta, luego el nombre de producto más largo contenido en el texto del
// ciclo (para casos como "SANDUCHE DE CARNE DE CERDO" vs "... Y QUESO"), y
// por último el caso inverso. Si el componente tiene un solo producto activo
// (ej. AGUA) se usa ese aunque el texto no calce.
function matchProducto(cicloText, productos) {
  const norm = normalizeMatch(cicloText)
  if (!norm) return productos.length === 1 ? productos[0] : null

  for (const p of productos) {
    if (normalizeMatch(p.nombre) === norm) return p
  }

  let best = null
  let bestLen = 0
  for (const p of productos) {
    const pn = normalizeMatch(p.nombre)
    if (pn && norm.includes(pn) && pn.length > bestLen) {
      best = p
      bestLen = pn.length
    }
  }
  if (best) return best

  for (const p of productos) {
    const pn = normalizeMatch(p.nombre)
    if (pn && pn.includes(norm)) return p
  }

  return productos.length === 1 ? productos[0] : null
}

// Aplica el ajuste puntual del día (si existe) a las unidades por canastilla
// de un producto, sin modificar la data maestra en memoria.
function applyOverride(producto, overridesByProductoId) {
  if (!producto) return producto
  const override = overridesByProductoId?.get(producto.id)
  if (override == null) return producto
  return {
    ...producto,
    unidades_por_canastilla: override,
    empaque_texto: `CANASTILLA X ${override} UNIDADES`,
  }
}

// overridesByProductoId: Map<productoId, unidadesPorCanastilla> con los ajustes
// puntuales del día (reforzados_override_embalaje_dia) para la fecha de cicloDia.
export function buildMenuDelDia(cicloDia, productos, overridesByProductoId) {
  if (!cicloDia || cicloDia.festivo) return null

  const activos = (productos || []).filter(p => p.activo)
  const porComponente = key => activos.filter(p => p.componente === key)

  const bebida = matchProducto(cicloDia.bebida_uht, porComponente('BEBIDA UHT'))
  const fruta = matchProducto(cicloDia.fruta, porComponente('FRUTA'))
  const postre = matchProducto(cicloDia.postre, porComponente('POSTRE'))
  const agua = matchProducto(cicloDia.agua, porComponente('AGUA'))

  const proteicos = porComponente('PROTEICO')
  const cereal1 = matchProducto(cicloDia.proteico, proteicos.filter(p => p.tipo === 'TIPO 1'))
  const cereal2 = cereal1
    ? proteicos.find(p => p.tipo === 'TIPO 2' && p.nombre === cereal1.nombre) || null
    : matchProducto(cicloDia.proteico, proteicos.filter(p => p.tipo === 'TIPO 2'))

  return {
    fecha: cicloDia.fecha,
    menuNumero: cicloDia.menu_numero,
    bebida: applyOverride(bebida, overridesByProductoId),
    cereal1: applyOverride(cereal1, overridesByProductoId),
    cereal2: applyOverride(cereal2, overridesByProductoId),
    fruta: applyOverride(fruta, overridesByProductoId),
    postre: applyOverride(postre, overridesByProductoId),
    agua: applyOverride(agua, overridesByProductoId),
  }
}

export function calcularCanastillas(cantidad, unidadesPorCanastilla) {
  const cant = cantidad || 0
  if (!unidadesPorCanastilla || unidadesPorCanastilla <= 0 || !cant) {
    return { canastillas: 0, unidades: 0 }
  }
  return { canastillas: Math.floor(cant / unidadesPorCanastilla), unidades: cant % unidadesPorCanastilla }
}

// Junta asignaciones de ruta activa + sitios + base de suministro del día en
// bloques por conductor, calculando canastillas/unidades por componente del
// menú. Sitios sin entrada en la base (o con total 0) se omiten. Conductores
// sin ningún sitio con entrega ese día no aparecen en el resultado.
export function buildRuteroConductores(asignaciones, sitiosById, baseByIdSitio, menuDelDia) {
  const grupos = new Map()

  for (const a of asignaciones) {
    const base = baseByIdSitio.get(a.id_sitio_entrega)
    if (!base || !base.total) continue

    const repartidorId = a.repartidor_id
    let g = grupos.get(repartidorId)
    if (!g) {
      g = {
        repartidorId,
        conductor: a.repartidor?.conductor || '-',
        auxiliar: a.repartidor?.auxiliar || '-',
        placa: a.repartidor?.placa || '-',
        filas: [],
      }
      grupos.set(repartidorId, g)
    }

    const sitio = sitiosById.get(a.id_sitio_entrega) || {}
    const tipo1Total = base.tipo_1_total || 0
    const tipo2Total = (base.tipo_2_total || 0) + (base.tipo_n || 0)
    const total = base.total || 0

    g.filas.push({
      asignacionId: a.id,
      idSitio: a.id_sitio_entrega,
      orden: a.orden_entrega,
      nombreInstitucion: sitio.nombre_institucion || `Sitio ${a.id_sitio_entrega} (sin datos maestro)`,
      nombreDescripcion: sitio.nombre_descripcion || sitio.nombre_institucion || '-',
      sedeEducativa: sitio.sede_educativa || '-',
      sitioEntrega: sitio.sitio_entrega || '-',
      direccion: sitio.direccion || '-',
      tipoA: base.tipo_a || 0,
      tipoB: base.tipo_b || 0,
      tipoC: base.tipo_c || 0,
      tipoD: base.tipo_d || 0,
      muestra1: base.muestra_tipo_1 || 0,
      muestra2: base.muestra_tipo_2 || 0,
      total,
      componentes: {
        bebida: calcularCanastillas(total, menuDelDia?.bebida?.unidades_por_canastilla),
        cereal1: calcularCanastillas(tipo1Total, menuDelDia?.cereal1?.unidades_por_canastilla),
        cereal2: calcularCanastillas(tipo2Total, menuDelDia?.cereal2?.unidades_por_canastilla),
        fruta: calcularCanastillas(total, menuDelDia?.fruta?.unidades_por_canastilla),
        postre: calcularCanastillas(total, menuDelDia?.postre?.unidades_por_canastilla),
        agua: calcularCanastillas(total, menuDelDia?.agua?.unidades_por_canastilla),
      },
    })
  }

  const COMPONENTE_KEYS = ['bebida', 'cereal1', 'cereal2', 'fruta', 'postre', 'agua']

  const conductores = Array.from(grupos.values()).map(g => {
    const filas = [...g.filas].sort((a, b) => a.orden - b.orden)
    const totales = { tipoA: 0, tipoB: 0, tipoC: 0, tipoD: 0, muestra1: 0, muestra2: 0, total: 0, canastillas: {} }
    for (const key of COMPONENTE_KEYS) totales.canastillas[key] = 0

    filas.forEach(f => {
      totales.tipoA += f.tipoA
      totales.tipoB += f.tipoB
      totales.tipoC += f.tipoC
      totales.tipoD += f.tipoD
      totales.muestra1 += f.muestra1
      totales.muestra2 += f.muestra2
      totales.total += f.total
      for (const key of COMPONENTE_KEYS) totales.canastillas[key] += f.componentes[key].canastillas
    })

    totales.totalCanastas = COMPONENTE_KEYS.reduce((s, key) => s + totales.canastillas[key], 0)

    return { ...g, filas, totales }
  })

  conductores.sort((a, b) => a.conductor.localeCompare(b.conductor, 'es'))
  return conductores
}

// Sitios que tienen entrega en la base de suministro del día pero no tienen
// ruta/conductor asignado en Data Maestra → Rutas (ruta activa). Deben
// mostrarse como alerta y sumar en los totales del rutero para que cuadren
// con el remisionador.
export function buildSitiosSinAsignar(baseRows, asignaciones, sitiosById) {
  const asignadosIds = new Set(asignaciones.map(a => a.id_sitio_entrega))

  return (baseRows || [])
    .filter(b => (b.total || 0) > 0 && !asignadosIds.has(b.id_sitio_entrega))
    .map(b => {
      const sitio = sitiosById.get(b.id_sitio_entrega) || {}
      return {
        idSitio: b.id_sitio_entrega,
        nombreInstitucion: sitio.nombre_institucion || `Sitio ${b.id_sitio_entrega} (sin datos maestro)`,
        total: b.total || 0,
      }
    })
    .sort((a, b) => a.idSitio - b.idSitio)
}
