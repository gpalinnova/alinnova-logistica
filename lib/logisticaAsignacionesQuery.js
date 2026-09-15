import { supabase } from './supabase'

const VENTANA_DIAS = 30

function confianzaDe(totalDias) {
  if (totalDias >= 5) return 'alta'
  if (totalDias >= 3) return 'media'
  return 'baja'
}

// Devuelve, para cada punto_wms recibido, la "ruta habitual" = la ruta más
// frecuente (moda) en logistica_asignaciones_historico dentro de los últimos
// 30 días. Empates de frecuencia los gana la ruta con fecha más reciente.
// Resultado: { [punto_wms]: { ruta, frecuencia, totalDias, ultima, confianza } | null }
export async function getRutaHabitual(puntosWms) {
  const puntos = Array.from(new Set((puntosWms || []).map(p => String(p))))
  const resultado = {}
  puntos.forEach(p => { resultado[p] = null })
  if (!puntos.length) return resultado

  const desde = new Date(Date.now() - VENTANA_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('logistica_asignaciones_historico')
    .select('punto_wms, nombre_ruta, fecha')
    .in('punto_wms', puntos)
    .gte('fecha', desde)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('No se pudo consultar la ruta habitual:', error)
    return resultado
  }

  const porPunto = new Map()
  ;(data || []).forEach(row => {
    if (!porPunto.has(row.punto_wms)) porPunto.set(row.punto_wms, [])
    porPunto.get(row.punto_wms).push(row)
  })

  porPunto.forEach((registros, punto) => {
    // registros ya vienen ordenados por fecha desc
    const ultima = registros[0].nombre_ruta
    const totalDias = registros.length

    const conteo = new Map() // nombre_ruta -> { frecuencia, maxFecha }
    registros.forEach(r => {
      const actual = conteo.get(r.nombre_ruta) || { frecuencia: 0, maxFecha: r.fecha }
      actual.frecuencia += 1
      if (r.fecha > actual.maxFecha) actual.maxFecha = r.fecha
      conteo.set(r.nombre_ruta, actual)
    })

    let mejor = null
    conteo.forEach((c, ruta) => {
      if (!mejor || c.frecuencia > mejor.frecuencia || (c.frecuencia === mejor.frecuencia && c.maxFecha > mejor.maxFecha)) {
        mejor = { ruta, frecuencia: c.frecuencia, maxFecha: c.maxFecha }
      }
    })

    resultado[punto] = {
      ruta: mejor.ruta,
      frecuencia: mejor.frecuencia,
      totalDias,
      ultima,
      confianza: confianzaDe(totalDias),
    }
  })

  return resultado
}
