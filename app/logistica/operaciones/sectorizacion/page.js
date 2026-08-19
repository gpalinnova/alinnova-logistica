'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'

function formatFechaCorta(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmt(n) {
  return (n || 0).toLocaleString('es-CO')
}

function calcCanastillas(cantidad, capacidad) {
  if (!capacidad || capacidad <= 0) return null
  const base = Math.floor(cantidad / capacidad)
  const sueltas = cantidad % capacidad
  return base + (sueltas > 0 ? 1 : 0)
}

export default function SectorizacionPage() {
  const [fechasDisponibles, setFechasDisponibles] = useState([])
  const [fecha, setFecha] = useState('')

  const [detalle, setDetalle] = useState([])
  const [rutas, setRutas] = useState([])
  const [asignaciones, setAsignaciones] = useState({})

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)

  const [productosOpen, setProductosOpen] = useState(false)
  const [ceroOpen, setCeroOpen] = useState(false)

  const [rutaSeleccionada, setRutaSeleccionada] = useState({})
  const [aplicando, setAplicando] = useState(new Set())
  const [aplicado, setAplicado] = useState({})

  useEffect(() => { fetchFechas() }, [])

  useEffect(() => {
    if (fecha) {
      fetchDatos(fecha)
      setRutaSeleccionada({})
      setAplicado({})
    } else {
      setDetalle([])
      setRutas([])
      setAsignaciones({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  async function fetchFechas() {
    const { data, error } = await supabase.from('logistica_oc_detalle').select('fecha_entrega_efectiva')
    if (!error) {
      const unicas = Array.from(new Set((data || []).map(d => d.fecha_entrega_efectiva).filter(Boolean)))
        .sort()
        .reverse()
      setFechasDisponibles(unicas)
      if (unicas.length > 0) setFecha(prev => prev || unicas[0])
    }
  }

  async function fetchDatos(fechaSel) {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data: detalleData, error: errDetalle } = await supabase
        .from('logistica_oc_detalle')
        .select(`
          id, cantidad, sitio_id, producto_id,
          sitio:logistica_sitios(id, punto_wms, nombre_institucion, localidad),
          producto:logistica_productos(id, nombre, familia_producto, capacidad_canastilla),
          oc:logistica_oc(numero_oc)
        `)
        .eq('fecha_entrega_efectiva', fechaSel)
      if (errDetalle) throw errDetalle

      const { data: rutasData, error: errRutas } = await supabase
        .from('logistica_rutas')
        .select('id, nombre, localidad_principal')
        .eq('activo', true)
        .order('nombre')
      if (errRutas) throw errRutas

      const sitioIds = Array.from(new Set((detalleData || []).map(d => d.sitio_id)))
      let asigMap = {}
      if (sitioIds.length > 0) {
        const { data: asigData, error: errAsig } = await supabase
          .from('logistica_sitio_ruta')
          .select('sitio_id, ruta_id')
          .in('sitio_id', sitioIds)
        if (errAsig) throw errAsig
        for (const a of asigData || []) asigMap[a.sitio_id] = a.ruta_id
      }

      setDetalle(detalleData || [])
      setRutas(rutasData || [])
      setAsignaciones(asigMap)
    } catch (err) {
      setErrorMsg('No se pudieron cargar los datos de sectorización.')
    } finally {
      setLoading(false)
    }
  }

  const sitiosMap = useMemo(() => {
    const map = new Map()
    for (const d of detalle) {
      if (!d.sitio || !d.producto) continue
      const key = d.sitio_id
      if (!map.has(key)) {
        map.set(key, {
          id: d.sitio_id,
          punto_wms: d.sitio.punto_wms,
          nombre_institucion: d.sitio.nombre_institucion,
          localidad: d.sitio.localidad || 'SIN LOCALIDAD',
          unidades_totales: 0,
          ocs: new Set(),
          lineas: [],
        })
      }
      const s = map.get(key)
      s.unidades_totales += d.cantidad
      if (d.oc?.numero_oc) s.ocs.add(d.oc.numero_oc)
      s.lineas.push({
        producto_id: d.producto_id,
        nombre: d.producto.nombre,
        familia: d.producto.familia_producto || 'SIN CLASIFICAR',
        capacidad: d.producto.capacidad_canastilla,
        cantidad: d.cantidad,
      })
    }
    return map
  }, [detalle])

  const sitiosActivos = useMemo(
    () => Array.from(sitiosMap.values()).filter(s => s.unidades_totales > 0),
    [sitiosMap]
  )
  const sitiosCero = useMemo(
    () => Array.from(sitiosMap.values()).filter(s => s.unidades_totales <= 0),
    [sitiosMap]
  )

  const combos = useMemo(() => {
    const arr = []
    for (const s of sitiosActivos) {
      const porProducto = new Map()
      for (const l of s.lineas) {
        if (l.cantidad <= 0) continue
        if (!porProducto.has(l.producto_id)) {
          porProducto.set(l.producto_id, {
            producto_id: l.producto_id, nombre: l.nombre, familia: l.familia, capacidad: l.capacidad, cantidad: 0,
          })
        }
        porProducto.get(l.producto_id).cantidad += l.cantidad
      }
      for (const p of porProducto.values()) {
        arr.push({
          sitio_id: s.id,
          localidad: s.localidad,
          ...p,
          canastillas: calcCanastillas(p.cantidad, p.capacidad),
        })
      }
    }
    return arr
  }, [sitiosActivos])

  const resumenLocalidades = useMemo(() => {
    const map = new Map()
    for (const s of sitiosActivos) {
      if (!map.has(s.localidad)) {
        map.set(s.localidad, { localidad: s.localidad, colegios: 0, unidades: 0, canastillas: 0, sitiosIds: [] })
      }
      const e = map.get(s.localidad)
      e.colegios += 1
      e.unidades += s.unidades_totales
      e.sitiosIds.push(s.id)
    }
    for (const c of combos) {
      const e = map.get(c.localidad)
      if (e && c.canastillas != null) e.canastillas += c.canastillas
    }
    return Array.from(map.values()).sort((a, b) => b.canastillas - a.canastillas)
  }, [sitiosActivos, combos])

  const resumenProductos = useMemo(() => {
    const map = new Map()
    for (const c of combos) {
      if (!map.has(c.producto_id)) {
        map.set(c.producto_id, {
          producto_id: c.producto_id, nombre: c.nombre, familia: c.familia, capacidad: c.capacidad,
          unidades: 0, canastillas: 0, colegiosSet: new Set(), sinCapacidad: !c.capacidad || c.capacidad <= 0,
        })
      }
      const e = map.get(c.producto_id)
      e.unidades += c.cantidad
      if (c.canastillas != null) e.canastillas += c.canastillas
      e.colegiosSet.add(c.sitio_id)
    }
    const arr = Array.from(map.values()).map(e => ({ ...e, colegios: e.colegiosSet.size }))
    arr.sort((a, b) => (a.familia || '').localeCompare(b.familia || '', 'es') || b.unidades - a.unidades)
    return arr
  }, [combos])

  const productosSinCapacidad = useMemo(() => resumenProductos.filter(p => p.sinCapacidad).length, [resumenProductos])

  const kpis = useMemo(() => {
    const colegios = sitiosActivos.length
    const unidades = sitiosActivos.reduce((a, s) => a + s.unidades_totales, 0)
    const canastillas = combos.reduce((a, c) => a + (c.canastillas || 0), 0)
    const ocsSet = new Set()
    for (const d of detalle) if (d.oc?.numero_oc) ocsSet.add(d.oc.numero_oc)
    return { colegios, unidades, canastillas, ocs: ocsSet.size }
  }, [sitiosActivos, combos, detalle])

  function rutasOrdenadas(localidad) {
    const norm = (localidad || '').trim().toLowerCase()
    const coinciden = rutas
      .filter(r => (r.localidad_principal || '').trim().toLowerCase() === norm)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const resto = rutas
      .filter(r => (r.localidad_principal || '').trim().toLowerCase() !== norm)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return { coinciden, resto }
  }

  function asignacionInfo(loc) {
    const asignados = loc.sitiosIds.filter(id => asignaciones[id]).length
    return { asignados, sinRuta: loc.sitiosIds.length - asignados }
  }

  async function handleAplicar(loc) {
    const rutaId = rutaSeleccionada[loc.localidad]
    if (!rutaId) return
    const ruta = rutas.find(r => r.id === rutaId)

    setAplicando(prev => new Set(prev).add(loc.localidad))
    setErrorMsg('')
    try {
      const sitioIds = loc.sitiosIds
      const conRuta = sitioIds.filter(id => asignaciones[id])
      const sinRuta = sitioIds.filter(id => !asignaciones[id])

      if (conRuta.length > 0) {
        const { error } = await supabase
          .from('logistica_sitio_ruta')
          .update({ ruta_id: rutaId })
          .in('sitio_id', conRuta)
        if (error) throw error
      }
      if (sinRuta.length > 0) {
        const { error } = await supabase
          .from('logistica_sitio_ruta')
          .insert(sinRuta.map(id => ({ sitio_id: id, ruta_id: rutaId })))
        if (error) throw error
      }

      setAsignaciones(prev => {
        const next = { ...prev }
        for (const id of sitioIds) next[id] = rutaId
        return next
      })
      setAplicado(prev => ({ ...prev, [loc.localidad]: { rutaNombre: ruta?.nombre || '—', count: sitioIds.length } }))
      setToast({ message: `Aplicado a ${ruta?.nombre || 'la ruta'} (${sitioIds.length} sitios).`, type: 'success' })
    } catch (err) {
      setErrorMsg(`No se pudo aplicar la asignación en ${loc.localidad}.`)
    } finally {
      setAplicando(prev => {
        const next = new Set(prev)
        next.delete(loc.localidad)
        return next
      })
    }
  }

  const subtitle = fecha
    ? `Fecha ${formatFechaCorta(fecha)} · ${fmt(kpis.colegios)} colegios · ${fmt(kpis.unidades)} unidades · ${fmt(kpis.canastillas)} canastillas`
    : 'Selecciona una fecha de entrega para ver la sectorización'

  const sinOc = fecha && !loading && sitiosMap.size === 0

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/operaciones"
          backLabel="Volver"
          title="📍 Sectorización — Logística"
          subtitle={subtitle}
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <select value={fecha} onChange={e => setFecha(e.target.value)}>
              <option value="">Selecciona fecha de entrega</option>
              {fechasDisponibles.map(f => <option key={f} value={f}>{formatFechaCorta(f)}</option>)}
            </select>
            {fecha && !loading && (
              <span className="logistica-muted">{kpis.ocs} OC{kpis.ocs === 1 ? '' : 's'} para esta fecha</span>
            )}
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {!fecha ? (
            <div className="empty-state"><p>Selecciona una fecha de entrega para ver la sectorización.</p></div>
          ) : loading ? (
            <div className="empty-state"><p>Cargando datos...</p></div>
          ) : sinOc ? (
            <div className="empty-state">
              <p>No hay OCs cargadas para esta fecha. Ve al <Link href="/logistica/operaciones/importar-oc">Importador de OC</Link> para cargar una.</p>
            </div>
          ) : (
            <>
              {/* Panel 1 — Resumen agregado */}
              <div className="rem-stats-row">
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{fmt(kpis.colegios)}</div>
                  <div className="rem-stat-label">Colegios</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{fmt(kpis.unidades)}</div>
                  <div className="rem-stat-label">Unidades totales</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{fmt(kpis.canastillas)}</div>
                  <div className="rem-stat-label">Canastillas totales</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{fmt(kpis.ocs)}</div>
                  <div className="rem-stat-label">OCs incluidas</div>
                </div>
              </div>

              {/* Panel 2 — Por producto (colapsable) */}
              <div className={`section-collapsible ${productosOpen ? '' : 'collapsed'}`}>
                <div className="section-collapsible-header" onClick={() => setProductosOpen(o => !o)}>
                  <div>
                    <span className="section-collapsible-title">Por producto</span>
                    <span className="section-collapsible-count"> ({resumenProductos.length} productos)</span>
                  </div>
                  <span className="section-collapsible-chevron">▼</span>
                </div>
                {productosOpen && (
                  <div className="section-collapsible-body logistica-section-pad">
                    {productosSinCapacidad > 0 && (
                      <div className="logistica-warning-box">
                        ⚠ {productosSinCapacidad} producto{productosSinCapacidad === 1 ? '' : 's'} sin capacidad configurada. Cárgalos en Data Maestra → Productos para cálculo preciso.
                      </div>
                    )}
                    <div className="data-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Familia</th>
                            <th>Producto</th>
                            <th>Unidades</th>
                            <th>Capacidad canastilla</th>
                            <th>Canastillas</th>
                            <th># colegios</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumenProductos.map(p => (
                            <tr key={p.producto_id}>
                              <td>{p.familia}</td>
                              <td>{p.nombre}</td>
                              <td className="logistica-mono">{fmt(p.unidades)}</td>
                              <td className="logistica-mono">{p.capacidad || '—'}</td>
                              <td className="logistica-mono">{p.sinCapacidad ? '—' : fmt(p.canastillas)}</td>
                              <td className="logistica-mono">{p.colegios}</td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={2}><strong>TOTAL</strong></td>
                            <td className="logistica-mono"><strong>{fmt(kpis.unidades)}</strong></td>
                            <td>—</td>
                            <td className="logistica-mono"><strong>{fmt(kpis.canastillas)}</strong></td>
                            <td>—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel 3 — Por localidad */}
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Localidad</th>
                      <th>Colegios</th>
                      <th>Unidades</th>
                      <th>Canastillas</th>
                      <th>Asignación actual</th>
                      <th>Asignar a ruta</th>
                      <th></th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenLocalidades.map(loc => {
                      const info = asignacionInfo(loc)
                      const { coinciden, resto } = rutasOrdenadas(loc.localidad)
                      const rutaSel = rutaSeleccionada[loc.localidad] || ''
                      const saving = aplicando.has(loc.localidad)
                      const est = aplicado[loc.localidad]
                      return (
                        <tr key={loc.localidad}>
                          <td><strong>{(loc.localidad || '').toUpperCase()}</strong></td>
                          <td className="logistica-mono">{loc.colegios}</td>
                          <td className="logistica-mono">{fmt(loc.unidades)}</td>
                          <td className="logistica-mono">{fmt(loc.canastillas)}</td>
                          <td>
                            <span className="badge badge-info">{info.asignados} asignados · {info.sinRuta} sin ruta</span>
                          </td>
                          <td>
                            <select
                              value={rutaSel}
                              disabled={saving}
                              onChange={e => setRutaSeleccionada(prev => ({ ...prev, [loc.localidad]: e.target.value }))}
                            >
                              <option value="">— Seleccionar —</option>
                              {coinciden.length > 0 && (
                                <optgroup label="🟢 Coincide con localidad">
                                  {coinciden.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </optgroup>
                              )}
                              {resto.length > 0 && (
                                <optgroup label="Otras rutas activas">
                                  {resto.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </optgroup>
                              )}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={!rutaSel || saving}
                              onClick={() => handleAplicar(loc)}
                            >
                              {saving ? 'Aplicando...' : 'Aplicar'}
                            </button>
                          </td>
                          <td>
                            {est && <span className="badge badge-activo">✓ Aplicado a {est.rutaNombre} ({est.count} sitios)</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Panel 4 — Colegios con cantidad 0 (colapsable) */}
              <div className={`section-collapsible ${ceroOpen ? '' : 'collapsed'}`}>
                <div className="section-collapsible-header" onClick={() => setCeroOpen(o => !o)}>
                  <div>
                    <span className="section-collapsible-title">⚠ Colegios sin unidades para esta fecha</span>
                    <span className="section-collapsible-count"> ({sitiosCero.length})</span>
                  </div>
                  <span className="section-collapsible-chevron">▼</span>
                </div>
                {ceroOpen && (
                  <div className="section-collapsible-body logistica-section-pad">
                    {sitiosCero.length === 0 ? (
                      <p className="logistica-muted">No hay colegios con cantidad 0 para esta fecha.</p>
                    ) : (
                      <div className="data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Punto WMS</th>
                              <th>Institución</th>
                              <th>Localidad</th>
                              <th>OC número</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sitiosCero.map(s => (
                              <tr key={s.id}>
                                <td className="logistica-mono">{s.punto_wms}</td>
                                <td>{s.nombre_institucion}</td>
                                <td>{s.localidad}</td>
                                <td>{Array.from(s.ocs).join(', ') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Panel de acciones finales */}
              <div className="page-toolbar spread">
                <Link href={`/logistica/operaciones/rutero?fecha=${fecha}`} className="btn-primary">
                  → Ir al Rutero del Día
                </Link>
                <button type="button" className="btn-secondary" onClick={() => fetchDatos(fecha)}>
                  🔄 Refrescar datos
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
