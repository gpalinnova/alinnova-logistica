'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'
import { todayLocalISO } from '../../../../lib/tablaWhatsappUtils'
import { fmtFechaCorta } from '../../../../lib/logisticaRemisionPdf'
import { generarPdfRuteros, calcularTotalCanastillas } from '../../../../lib/logisticaRuteroPdf'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'SN'
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function validarSitiosSinRuta(fecha, modalidad) {
  const { data: detalle, error: errDetalle } = await supabase
    .from('logistica_oc_detalle')
    .select('sitio:logistica_sitios(id, punto_wms, nombre_institucion, localidad), producto:logistica_productos!inner(modalidad)')
    .eq('fecha_entrega_efectiva', fecha)
    .eq('producto.modalidad', modalidad)
  if (errDetalle) throw errDetalle

  const sitiosDelDia = new Map()
  for (const d of detalle || []) {
    if (d.sitio) sitiosDelDia.set(d.sitio.id, d.sitio)
  }
  if (sitiosDelDia.size === 0) return []

  const { data: asignaciones, error: errAsig } = await supabase
    .from('logistica_sitio_ruta')
    .select('sitio_id, ruta:logistica_rutas!inner(activo)')
    .eq('ruta.activo', true)
    .in('sitio_id', Array.from(sitiosDelDia.keys()))
  if (errAsig) throw errAsig

  const asignados = new Set((asignaciones || []).map(a => a.sitio_id))
  return Array.from(sitiosDelDia.values()).filter(s => !asignados.has(s.id))
}

async function validarProductosSinCapacidad(fecha, modalidad) {
  const { data, error } = await supabase
    .from('logistica_oc_detalle')
    .select('producto:logistica_productos!inner(id, nombre, nombre_corto, capacidad_canastilla, modalidad)')
    .eq('fecha_entrega_efectiva', fecha)
    .eq('producto.modalidad', modalidad)
  if (error) throw error
  const map = new Map()
  for (const d of data || []) {
    if (d.producto && (d.producto.capacidad_canastilla || 0) <= 0) map.set(d.producto.id, d.producto)
  }
  return Array.from(map.values())
}

async function cargarProductosDelDia(fecha, modalidad) {
  const { data, error } = await supabase
    .from('logistica_oc_detalle')
    .select('producto:logistica_productos!inner(id, nombre, nombre_corto, capacidad_canastilla, modalidad)')
    .eq('fecha_entrega_efectiva', fecha)
    .eq('producto.modalidad', modalidad)
  if (error) throw error
  const map = new Map()
  for (const d of data || []) if (d.producto) map.set(d.producto.id, d.producto)
  return Array.from(map.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
}

async function cargarLotesExistentes(fecha, modalidad) {
  const { data, error } = await supabase
    .from('logistica_lote_producto_dia')
    .select('producto_id, lote, fecha_vencimiento')
    .eq('fecha_entrega_efectiva', fecha)
    .eq('modalidad', modalidad)
  if (error) throw error
  const map = new Map()
  for (const l of data || []) map.set(l.producto_id, { lote: l.lote || '', fecha_vencimiento: l.fecha_vencimiento || '' })
  return map
}

async function cargarConfirmacion(fecha, modalidad) {
  const [{ data: detalle, error: errDetalle }, { data: asignaciones, error: errAsig }] = await Promise.all([
    supabase
      .from('logistica_oc_detalle')
      .select('sitio_id, cantidad, producto:logistica_productos!inner(id, nombre, nombre_corto, capacidad_canastilla, modalidad)')
      .eq('fecha_entrega_efectiva', fecha)
      .eq('producto.modalidad', modalidad),
    supabase
      .from('logistica_sitio_ruta')
      .select('sitio_id, ruta:logistica_rutas!inner(id, nombre, conductor, auxiliar, placa_vehiculo, activo)')
      .eq('ruta.activo', true),
  ])
  if (errDetalle) throw errDetalle
  if (errAsig) throw errAsig

  const rutaPorSitio = new Map()
  for (const a of asignaciones || []) if (a.ruta) rutaPorSitio.set(a.sitio_id, a.ruta)

  const map = new Map()
  for (const d of detalle || []) {
    if (!d.producto) continue
    const ruta = rutaPorSitio.get(d.sitio_id)
    if (!ruta) continue
    const key = `${ruta.id}|${d.producto.id}`
    if (!map.has(key)) {
      map.set(key, { key, ruta, producto: d.producto, sitiosSet: new Set(), total_unidades: 0 })
    }
    const row = map.get(key)
    row.sitiosSet.add(d.sitio_id)
    row.total_unidades += d.cantidad
  }

  return Array.from(map.values())
    .map(r => ({ key: r.key, ruta: r.ruta, producto: r.producto, total_sitios: r.sitiosSet.size, total_unidades: r.total_unidades }))
    .sort((a, b) =>
      (a.ruta.nombre || '').localeCompare(b.ruta.nombre || '', 'es') ||
      (a.producto.nombre || '').localeCompare(b.producto.nombre || '', 'es')
    )
}

async function cargarSitiosRutero(fecha, rutaId, productoId) {
  const [{ data: detalle, error: errDetalle }, { data: asignaciones, error: errAsig }] = await Promise.all([
    supabase.from('logistica_oc_detalle').select('sitio_id, cantidad').eq('fecha_entrega_efectiva', fecha).eq('producto_id', productoId),
    supabase.from('logistica_sitio_ruta').select('sitio_id, orden_entrega').eq('ruta_id', rutaId),
  ])
  if (errDetalle) throw errDetalle
  if (errAsig) throw errAsig

  const ordenPorSitio = new Map((asignaciones || []).map(a => [a.sitio_id, a.orden_entrega]))
  const sumaPorSitio = new Map()
  for (const d of detalle || []) {
    if (!ordenPorSitio.has(d.sitio_id)) continue
    sumaPorSitio.set(d.sitio_id, (sumaPorSitio.get(d.sitio_id) || 0) + d.cantidad)
  }
  const sitioIds = Array.from(sumaPorSitio.keys())
  if (sitioIds.length === 0) return []

  const { data: sitiosData, error: errSitios } = await supabase
    .from('logistica_sitios')
    .select('id, punto_wms, nombre_institucion, direccion')
    .in('id', sitioIds)
  if (errSitios) throw errSitios
  const sitiosById = new Map((sitiosData || []).map(s => [s.id, s]))

  return sitioIds
    .map(id => ({ ...sitiosById.get(id), unidades: sumaPorSitio.get(id), orden: ordenPorSitio.get(id) }))
    .sort((a, b) => {
      if (a.orden != null && b.orden != null) return a.orden - b.orden
      if (a.orden != null) return -1
      if (b.orden != null) return 1
      return (a.punto_wms || 0) - (b.punto_wms || 0)
    })
}

export default function RuterosPage() {
  const [estado, setEstado] = useState('SELECCION')
  const [fechasDisponibles, setFechasDisponibles] = useState([])
  const [fecha, setFecha] = useState('')
  const [modalidad, setModalidad] = useState('')

  const [validando, setValidando] = useState(false)
  const [sitiosSinRuta, setSitiosSinRuta] = useState([])
  const [productosSinCapacidad, setProductosSinCapacidad] = useState([])

  const [productos, setProductos] = useState([])
  const [lotesPorProducto, setLotesPorProducto] = useState(new Map())
  const debounceRefs = useRef(new Map())

  const [confirmacionRows, setConfirmacionRows] = useState([])
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [modo, setModo] = useState('agrupado_por_ruta')

  const [errorMsg, setErrorMsg] = useState('')
  const [resumenExito, setResumenExito] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { fetchFechas() }, [])

  useEffect(() => {
    if (!fecha || !modalidad) {
      setSitiosSinRuta([])
      setProductosSinCapacidad([])
      return
    }
    let activo = true
    async function validar() {
      setValidando(true)
      setErrorMsg('')
      try {
        const [sinRuta, sinCapacidad] = await Promise.all([
          validarSitiosSinRuta(fecha, modalidad),
          validarProductosSinCapacidad(fecha, modalidad),
        ])
        if (!activo) return
        setSitiosSinRuta(sinRuta)
        setProductosSinCapacidad(sinCapacidad)
      } catch (err) {
        if (!activo) return
        setErrorMsg('No se pudo validar la información de sitios/productos.')
      } finally {
        if (activo) setValidando(false)
      }
    }
    validar()
    return () => { activo = false }
  }, [fecha, modalidad])

  async function fetchFechas() {
    const { data } = await supabase.from('logistica_oc_detalle').select('fecha_entrega_efectiva')
    const unicas = Array.from(new Set((data || []).map(d => d.fecha_entrega_efectiva).filter(Boolean))).sort()
    setFechasDisponibles(unicas)
  }

  const puedeContinuar = fecha && modalidad && !validando && sitiosSinRuta.length === 0 && productosSinCapacidad.length === 0

  async function irALoteVencimiento() {
    setErrorMsg('')
    try {
      const [prods, lotes] = await Promise.all([
        cargarProductosDelDia(fecha, modalidad),
        cargarLotesExistentes(fecha, modalidad),
      ])
      if (prods.length === 0) {
        setErrorMsg('No hay productos para esta fecha y modalidad.')
        return
      }
      setProductos(prods)
      setLotesPorProducto(lotes)
      setEstado('LOTE_VENCIMIENTO')
    } catch (err) {
      setErrorMsg('No se pudieron cargar los productos del día.')
    }
  }

  function actualizarLoteLocal(productoId, campo, valor) {
    setLotesPorProducto(prev => {
      const next = new Map(prev)
      const actual = next.get(productoId) || { lote: '', fecha_vencimiento: '' }
      next.set(productoId, { ...actual, [campo]: valor })
      return next
    })

    const debounceKey = productoId
    const timers = debounceRefs.current
    if (timers.has(debounceKey)) clearTimeout(timers.get(debounceKey))
    timers.set(debounceKey, setTimeout(async () => {
      const valores = lotesPorProducto.get(productoId) || { lote: '', fecha_vencimiento: '' }
      const merged = { ...valores, [campo]: valor }
      await supabase.from('logistica_lote_producto_dia').upsert({
        fecha_entrega_efectiva: fecha,
        modalidad,
        producto_id: productoId,
        lote: merged.lote || null,
        fecha_vencimiento: merged.fecha_vencimiento || null,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'fecha_entrega_efectiva,modalidad,producto_id' })
    }, 500))
  }

  async function irAConfirmacion() {
    const incompletos = productos.filter(p => {
      const l = lotesPorProducto.get(p.id)
      return !l || !l.lote || !l.fecha_vencimiento
    })
    if (incompletos.length > 0) {
      const ok = window.confirm(`${incompletos.length} producto(s) sin lote y/o fecha de vencimiento definidos. ¿Continuar de todas formas?`)
      if (!ok) return
    }
    setErrorMsg('')
    try {
      const rows = await cargarConfirmacion(fecha, modalidad)
      setConfirmacionRows(rows)
      setSelectedKeys(new Set(rows.map(r => r.key)))
      setEstado('CONFIRMACION')
    } catch (err) {
      setErrorMsg('No se pudo cargar el resumen de ruteros a generar.')
    }
  }

  const todasSeleccionadas = confirmacionRows.length > 0 && confirmacionRows.every(r => selectedKeys.has(r.key))
  function toggleTodas() {
    if (todasSeleccionadas) setSelectedKeys(new Set())
    else setSelectedKeys(new Set(confirmacionRows.map(r => r.key)))
  }
  function toggleUna(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const resumenConfirmacion = useMemo(() => {
    const seleccionadas = confirmacionRows.filter(r => selectedKeys.has(r.key))
    const rutas = new Set(seleccionadas.map(r => r.ruta.id))
    const prods = new Set(seleccionadas.map(r => r.producto.id))
    const unidades = seleccionadas.reduce((s, r) => s + r.total_unidades, 0)
    return { totalRuteros: seleccionadas.length, rutasCount: rutas.size, productosCount: prods.size, totalUnidades: unidades }
  }, [confirmacionRows, selectedKeys])

  async function handleGenerar() {
    const seleccionadas = confirmacionRows.filter(r => selectedKeys.has(r.key))
    if (seleccionadas.length === 0) return
    setEstado('GENERANDO')
    setErrorMsg('')
    try {
      const ruteros = []
      for (const combo of seleccionadas) {
        const sitios = await cargarSitiosRutero(fecha, combo.ruta.id, combo.producto.id)
        const capacidad = combo.producto.capacidad_canastilla
        const totales = calcularTotalCanastillas(sitios.map(s => ({ unidades: s.unidades, capacidad })))
        const loteInfo = lotesPorProducto.get(combo.producto.id) || {}
        ruteros.push({
          ruta: combo.ruta,
          producto: combo.producto,
          fechaEntrega: fmtFechaCorta(fecha),
          fechaGeneracion: fmtFechaCorta(todayLocalISO()),
          sitios,
          capacidad,
          lote: loteInfo.lote || '',
          fecha_vencimiento: loteInfo.fecha_vencimiento || null,
          _totales: totales,
        })
      }

      const rowsInsert = ruteros.map(r => ({
        fecha_entrega_efectiva: fecha,
        ruta_id: r.ruta.id,
        producto_id: r.producto.id,
        modalidad,
        total_unidades: r._totales.total_unidades,
        total_canastillas: r._totales.total_canastillas,
        total_sitios: r.sitios.length,
        lote: r.lote || null,
        fecha_vencimiento: r.fecha_vencimiento || null,
      }))
      const { error: errInsert } = await supabase.from('logistica_ruteros').insert(rowsInsert)
      if (errInsert) throw errInsert

      const resultados = generarPdfRuteros(ruteros, modo)
      await descargarResultados(resultados, modo)

      setResumenExito({
        cantidad: ruteros.length,
        rutas: new Set(ruteros.map(r => r.ruta.id)).size,
        totalUnidades: ruteros.reduce((s, r) => s + r._totales.total_unidades, 0),
        totalCanastillas: ruteros.reduce((s, r) => s + r._totales.total_canastillas, 0),
      })
      setToast({ message: `${ruteros.length} ruteros generados.`, type: 'success' })
      setEstado('EXITO')
    } catch (err) {
      setErrorMsg('No se pudieron generar los ruteros.')
      setEstado('ERROR')
    }
  }

  async function descargarResultados(resultados, modoActual) {
    if (modoActual === 'agrupado_por_ruta') {
      resultados.forEach(r => descargarBlob(r.blob, `ruteros_${slug(r.ruta.nombre)}_${fecha}.pdf`))
      return
    }
    if (resultados.length >= 5) {
      const zip = new JSZip()
      resultados.forEach(r => {
        zip.file(`rutero_${slug(r.ruta.nombre)}_${slug(r.producto.nombre_corto || r.producto.nombre)}_${fecha}.pdf`, r.blob)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      descargarBlob(zipBlob, `ruteros_${fecha}.zip`)
    } else {
      resultados.forEach(r => {
        descargarBlob(r.blob, `rutero_${slug(r.ruta.nombre)}_${slug(r.producto.nombre_corto || r.producto.nombre)}_${fecha}.pdf`)
      })
    }
  }

  function reiniciar() {
    setEstado('SELECCION')
    setFecha('')
    setModalidad('')
    setSitiosSinRuta([])
    setProductosSinCapacidad([])
    setProductos([])
    setLotesPorProducto(new Map())
    setConfirmacionRows([])
    setSelectedKeys(new Set())
    setResumenExito(null)
    setErrorMsg('')
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica/operaciones" backLabel="Volver" title="📋 Ruteros — Logística" subtitle="Generación de ruteros PDF por ruta y producto" />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {estado === 'SELECCION' && (
            <>
              <div className="page-toolbar spread">
                <select value={fecha} onChange={e => setFecha(e.target.value)}>
                  <option value="">Selecciona fecha de entrega efectiva</option>
                  {fechasDisponibles.map(f => <option key={f} value={f}>{fmtFechaCorta(f)}</option>)}
                </select>
                <select value={modalidad} onChange={e => setModalidad(e.target.value)}>
                  <option value="">Selecciona modalidad</option>
                  {Object.entries(MODALIDAD_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {validando && <div className="empty-state"><p>Validando sitios y productos...</p></div>}

              {!validando && sitiosSinRuta.length > 0 && (
                <div className="logistica-warning-box">
                  <div><strong>⚠️ No se pueden generar ruteros. Hay {sitiosSinRuta.length} sitios SIN RUTA con entrega ese día en esa modalidad.</strong></div>
                  <div>Debes asignarlos primero en Rutero del Día.</div>
                  <div className="logistica-section-pad" style={{ padding: '10px 0 0' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Punto WMS</th><th>Nombre</th><th>Localidad</th></tr>
                      </thead>
                      <tbody>
                        {sitiosSinRuta.map(s => (
                          <tr key={s.id}>
                            <td className="logistica-mono">{s.punto_wms}</td>
                            <td>{s.nombre_institucion}</td>
                            <td>{s.localidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="logistica-warning-actions">
                    <a href="/logistica/operaciones/rutero" className="btn-primary">Ir al Rutero del Día</a>
                    <button className="btn-secondary" onClick={() => { const f = fecha; const m = modalidad; setFecha(''); setModalidad(''); setTimeout(() => { setFecha(f); setModalidad(m) }, 0) }}>🔄 Reintentar</button>
                  </div>
                </div>
              )}

              {!validando && productosSinCapacidad.length > 0 && (
                <div className="logistica-warning-box">
                  <div><strong>⚠️ Estos productos no tienen capacidad_canastilla definida.</strong></div>
                  <div>Complétalo en Data Maestra → Productos antes de continuar.</div>
                  <div className="logistica-section-pad" style={{ padding: '10px 0 0' }}>
                    <table className="data-table">
                      <thead><tr><th>Producto</th></tr></thead>
                      <tbody>
                        {productosSinCapacidad.map(p => <tr key={p.id}><td>{p.nombre_corto || p.nombre}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  <div className="logistica-warning-actions">
                    <a href="/logistica/data-maestra/productos" target="_blank" rel="noopener noreferrer" className="btn-primary">Ir a Productos</a>
                  </div>
                </div>
              )}

              {puedeContinuar && (
                <div className="rem-actions">
                  <button className="btn-generate-pdf" onClick={irALoteVencimiento}>Continuar → Lote y Vencimiento</button>
                </div>
              )}
            </>
          )}

          {estado === 'LOTE_VENCIMIENTO' && (
            <>
              <div className="page-toolbar spread">
                <span className="logistica-muted">{fmtFechaCorta(fecha)} · <span className={`logistica-pill ${MODALIDAD_INFO[modalidad]?.className || ''}`}>{MODALIDAD_INFO[modalidad]?.label}</span></span>
                <button className="btn-secondary" onClick={() => setEstado('SELECCION')}>← Cambiar fecha/modalidad</button>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Producto</th><th>Capacidad canastilla</th><th>Lote</th><th>Fecha vencimiento</th></tr>
                  </thead>
                  <tbody>
                    {productos.map(p => {
                      const l = lotesPorProducto.get(p.id) || { lote: '', fecha_vencimiento: '' }
                      return (
                        <tr key={p.id}>
                          <td>{p.nombre_corto || p.nombre}</td>
                          <td className="logistica-mono" style={{ textAlign: 'center' }}>{p.capacidad_canastilla}</td>
                          <td>
                            <input
                              type="text"
                              value={l.lote}
                              placeholder="Sin definir"
                              onChange={e => actualizarLoteLocal(p.id, 'lote', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={l.fecha_vencimiento || ''}
                              onChange={e => actualizarLoteLocal(p.id, 'fecha_vencimiento', e.target.value)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="rem-actions">
                <button className="btn-generate-pdf" onClick={irAConfirmacion}>Continuar → Ver ruteros a generar</button>
              </div>
            </>
          )}

          {estado === 'CONFIRMACION' && (
            <>
              <div className="page-toolbar spread">
                <span className="logistica-muted">{fmtFechaCorta(fecha)} · <span className={`logistica-pill ${MODALIDAD_INFO[modalidad]?.className || ''}`}>{MODALIDAD_INFO[modalidad]?.label}</span></span>
                <button className="btn-secondary" onClick={() => setEstado('LOTE_VENCIMIENTO')}>← Volver a Lote y Vencimiento</button>
              </div>

              <div className="rem-stats-row">
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumenConfirmacion.totalRuteros}</div>
                  <div className="rem-stat-label">Ruteros a generar</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumenConfirmacion.rutasCount}</div>
                  <div className="rem-stat-label">Rutas involucradas</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumenConfirmacion.productosCount}</div>
                  <div className="rem-stat-label">Productos únicos</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumenConfirmacion.totalUnidades.toLocaleString('es-CO')}</div>
                  <div className="rem-stat-label">Unidades totales</div>
                </div>
              </div>

              <div className="logistica-radio-group">
                <label className="logistica-radio-option">
                  <input type="radio" name="modo" checked={modo === 'individual'} onChange={() => setModo('individual')} />
                  Un PDF por (ruta × producto)
                </label>
                <label className="logistica-radio-option">
                  <input type="radio" name="modo" checked={modo === 'agrupado_por_ruta'} onChange={() => setModo('agrupado_por_ruta')} />
                  Agrupar por ruta (default)
                </label>
              </div>

              <div className="page-toolbar spread">
                <label className="logistica-checkbox-label">
                  <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
                  Seleccionar todas
                </label>
                <span className="logistica-muted">{selectedKeys.size} de {confirmacionRows.length} seleccionadas</span>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} /></th>
                      <th>Ruta</th>
                      <th>Producto</th>
                      <th>Sitios</th>
                      <th>Unidades</th>
                      <th>Canastillas estimadas</th>
                      <th>Lote asignado</th>
                      <th>Vencimiento asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmacionRows.map(r => {
                      const loteInfo = lotesPorProducto.get(r.producto.id) || {}
                      const cap = r.producto.capacidad_canastilla || 0
                      const canastillasEstimadas = cap > 0 ? Math.ceil(r.total_unidades / cap) : 0
                      return (
                        <tr key={r.key}>
                          <td><input type="checkbox" checked={selectedKeys.has(r.key)} onChange={() => toggleUna(r.key)} /></td>
                          <td>{r.ruta.nombre}</td>
                          <td>{r.producto.nombre_corto || r.producto.nombre}</td>
                          <td style={{ textAlign: 'center' }}>{r.total_sitios}</td>
                          <td className="logistica-mono" style={{ textAlign: 'right' }}>{r.total_unidades.toLocaleString('es-CO')}</td>
                          <td className="logistica-mono" style={{ textAlign: 'right' }}>{canastillasEstimadas.toLocaleString('es-CO')}</td>
                          <td>{loteInfo.lote || <span className="logistica-muted">Sin definir</span>}</td>
                          <td>{loteInfo.fecha_vencimiento ? fmtFechaCorta(loteInfo.fecha_vencimiento) : <span className="logistica-muted">Sin definir</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rem-actions">
                <button className="btn-generate-pdf" onClick={handleGenerar} disabled={selectedKeys.size === 0}>📄 Generar PDFs</button>
              </div>
            </>
          )}

          {estado === 'GENERANDO' && (
            <div className="empty-state"><p>Generando ruteros...</p></div>
          )}

          {estado === 'EXITO' && resumenExito && (
            <>
              <div className="logistica-exito-box">
                ✓ Ruteros generados correctamente
                <div className="logistica-exito-detalle">
                  {resumenExito.cantidad} ruteros generados · {resumenExito.rutas} rutas<br />
                  {resumenExito.totalUnidades.toLocaleString('es-CO')} unidades · {resumenExito.totalCanastillas.toLocaleString('es-CO')} canastillas totales
                </div>
              </div>
              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <button className="btn-primary" onClick={reiniciar}>📋 Generar más ruteros</button>
              </div>
            </>
          )}

          {estado === 'ERROR' && (
            <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
              <button className="btn-primary" onClick={() => setEstado('CONFIRMACION')}>🔄 Reintentar</button>
              <button className="btn-secondary" onClick={reiniciar}>Volver al inicio</button>
            </div>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
