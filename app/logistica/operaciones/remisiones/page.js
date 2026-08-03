'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'
import { todayLocalISO } from '../../../../lib/tablaWhatsappUtils'
import { generarPdfRemisiones, fmtFechaCorta } from '../../../../lib/logisticaRemisionPdf'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

function claveRemision(sitioId, modalidad) {
  return `${sitioId}|${modalidad}`
}

function ocsDeLinea(d) {
  if (d.numero_oc_linea && d.numero_oc_linea.trim()) return [d.numero_oc_linea.trim()]
  return (d.oc?.numero_oc || '').split(',').map(s => s.trim()).filter(Boolean)
}

function construirRemisionesDelDia(detalleData) {
  const map = new Map()
  const ocsPorKey = new Map()
  for (const d of detalleData) {
    if (!d.sitio || !d.producto) continue
    const key = claveRemision(d.sitio.id, d.producto.modalidad)
    if (!map.has(key)) {
      map.set(key, {
        key,
        sitio_id: d.sitio.id,
        punto_wms: d.sitio.punto_wms,
        nombre_institucion: d.sitio.nombre_institucion,
        nombre_sitio: d.sitio.nombre_sitio,
        direccion: d.sitio.direccion,
        localidad: d.sitio.localidad,
        sede_educativa: d.sitio.sede_educativa,
        modalidad: d.producto.modalidad,
        oc_id: d.oc?.id || null,
        productos: [],
        total_unidades: 0,
        total_valorizado: 0,
      })
      ocsPorKey.set(key, new Set())
    }
    const row = map.get(key)
    const valorTotal = d.cantidad * (d.producto.valor_unitario || 0)
    row.productos.push({
      producto_id: d.producto.id,
      nombre: d.producto.nombre,
      nombre_corto: d.producto.nombre_corto,
      cantidad: d.cantidad,
      valor_unitario: d.producto.valor_unitario || 0,
      valor_total: valorTotal,
    })
    row.total_unidades += d.cantidad
    row.total_valorizado += valorTotal
    ocsDeLinea(d).forEach(oc => ocsPorKey.get(key).add(oc))
  }

  const remisiones = Array.from(map.values())
  remisiones.forEach(r => {
    r.numeros_oc = Array.from(ocsPorKey.get(r.key))
    r.numero_oc = r.numeros_oc.join(' / ')
  })
  remisiones.forEach(r => r.productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')))
  remisiones.sort((a, b) =>
    (a.localidad || '').localeCompare(b.localidad || '', 'es') ||
    (a.nombre_institucion || '').localeCompare(b.nombre_institucion || '', 'es') ||
    (a.modalidad || '').localeCompare(b.modalidad || '')
  )
  return remisiones
}

function construirProductosSinPrecio(detalleData) {
  const map = new Map()
  for (const d of detalleData) {
    if (d.producto && (d.producto.valor_unitario || 0) === 0) {
      map.set(d.producto.id, {
        id: d.producto.id,
        codigo_articulo: d.producto.codigo_articulo,
        nombre_corto: d.producto.nombre_corto,
        modalidad: d.producto.modalidad,
      })
    }
  }
  return Array.from(map.values())
}

export default function RemisionesPage() {
  const [fechasDisponibles, setFechasDisponibles] = useState([])
  const [fecha, setFecha] = useState('')
  const [loadingDatos, setLoadingDatos] = useState(false)
  const [remisionesDelDia, setRemisionesDelDia] = useState([])
  const [productosSinPrecio, setProductosSinPrecio] = useState([])
  const [existentesMap, setExistentesMap] = useState({})
  const [selectedKeys, setSelectedKeys] = useState(new Set())

  const [generando, setGenerando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [resultadoExito, setResultadoExito] = useState(null)

  useEffect(() => { fetchFechas() }, [])

  useEffect(() => {
    if (fecha) fetchDatos()
    else {
      setRemisionesDelDia([])
      setProductosSinPrecio([])
      setExistentesMap({})
      setSelectedKeys(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  async function fetchFechas() {
    const { data } = await supabase.from('logistica_oc_detalle').select('fecha_entrega_efectiva')
    const unicas = Array.from(new Set((data || []).map(d => d.fecha_entrega_efectiva).filter(Boolean))).sort()
    setFechasDisponibles(unicas)
  }

  async function fetchDatos() {
    setLoadingDatos(true)
    setErrorMsg('')
    setResultadoExito(null)
    try {
      const { data: detalleData, error: errDetalle } = await supabase
        .from('logistica_oc_detalle')
        .select(`
          id, cantidad, numero_oc_linea,
          sitio:logistica_sitios(id, punto_wms, nombre_institucion, nombre_sitio, direccion, localidad, sede_educativa),
          producto:logistica_productos(id, nombre, nombre_corto, modalidad, valor_unitario, codigo_articulo),
          oc:logistica_oc(id, numero_oc)
        `)
        .eq('fecha_entrega_efectiva', fecha)
      if (errDetalle) throw errDetalle

      const sinPrecio = construirProductosSinPrecio(detalleData || [])
      const remisiones = construirRemisionesDelDia(detalleData || [])

      const { data: existentesData, error: errExistentes } = await supabase
        .from('logistica_remisiones')
        .select('sitio_id, modalidad, numero_remision')
        .eq('fecha_entrega_efectiva', fecha)
      if (errExistentes) throw errExistentes

      const existentes = {}
      for (const e of existentesData || []) existentes[claveRemision(e.sitio_id, e.modalidad)] = e.numero_remision

      setProductosSinPrecio(sinPrecio)
      setRemisionesDelDia(remisiones)
      setExistentesMap(existentes)
      if (sinPrecio.length === 0) {
        setSelectedKeys(new Set(remisiones.map(r => r.key)))
      } else {
        setSelectedKeys(new Set())
      }
    } catch (err) {
      setErrorMsg('No se pudieron cargar los datos de remisiones.')
    } finally {
      setLoadingDatos(false)
    }
  }

  const todasSeleccionadas = remisionesDelDia.length > 0 && remisionesDelDia.every(r => selectedKeys.has(r.key))

  function toggleTodas() {
    if (todasSeleccionadas) setSelectedKeys(new Set())
    else setSelectedKeys(new Set(remisionesDelDia.map(r => r.key)))
  }

  function toggleUna(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const resumen = useMemo(() => {
    let totalUnidadesDia = 0
    let totalValorDia = 0
    for (const r of remisionesDelDia) {
      totalUnidadesDia += r.total_unidades
      totalValorDia += r.total_valorizado
    }
    let nuevas = 0
    let regeneracion = 0
    for (const r of remisionesDelDia) {
      if (!selectedKeys.has(r.key)) continue
      if (existentesMap[r.key] != null) regeneracion += 1
      else nuevas += 1
    }
    return { totalAGenerar: selectedKeys.size, totalUnidadesDia, totalValorDia, nuevas, regeneracion }
  }, [remisionesDelDia, selectedKeys, existentesMap])

  const yaGeneradasCount = useMemo(() =>
    remisionesDelDia.filter(r => existentesMap[r.key] != null).length
  , [remisionesDelDia, existentesMap])

  async function handleGenerar() {
    const seleccionadas = remisionesDelDia.filter(r => selectedKeys.has(r.key))
    if (seleccionadas.length === 0 || generando) return
    setGenerando(true)
    setErrorMsg('')

    const n = seleccionadas.length
    let rangoInicio = null
    try {
      const { data: inicioData, error: errReservar } = await supabase.rpc('logistica_reservar_numeros_remision', { cantidad: n })
      if (errReservar) throw errReservar
      rangoInicio = inicioData
      const rangoFin = rangoInicio + n - 1

      const fechaEmisionISO = todayLocalISO()
      const rowsInsert = seleccionadas.map((r, i) => ({
        numero_remision: rangoInicio + i,
        fecha_emision: fechaEmisionISO,
        fecha_entrega_efectiva: fecha,
        sitio_id: r.sitio_id,
        modalidad: r.modalidad,
        oc_id: r.oc_id,
        numero_oc: r.numero_oc,
        total_unidades: r.total_unidades,
        total_valorizado: r.total_valorizado,
      }))

      const { error: errInsert } = await supabase.from('logistica_remisiones').insert(rowsInsert)
      if (errInsert) {
        await supabase.from('logistica_config').update({ valor: rangoInicio }).eq('clave', 'proximo_numero_remision')
        throw errInsert
      }

      const pdfRemisiones = seleccionadas.map((r, i) => ({
        nro: rangoInicio + i,
        fechaEmision: fmtFechaCorta(fechaEmisionISO),
        fechaEntrega: fmtFechaCorta(fecha),
        sitio: r,
        oc: r.numero_oc,
        numeros_oc: r.numeros_oc,
        modalidad: r.modalidad,
        productos: r.productos,
        totalUnd: r.total_unidades,
        totalVal: r.total_valorizado,
      }))
      const blob = generarPdfRemisiones(pdfRemisiones)
      const url = URL.createObjectURL(blob)
      const ahora = new Date()
      const horaStr = `${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`
      const a = document.createElement('a')
      a.href = url
      a.download = `remisiones_logistica_${fecha}_${horaStr}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const totalUnidades = seleccionadas.reduce((acc, r) => acc + r.total_unidades, 0)
      const totalValor = seleccionadas.reduce((acc, r) => acc + r.total_valorizado, 0)
      setResultadoExito({ cantidad: n, rangoInicio, rangoFin, totalUnidades, totalValor })
      setToast({ message: `${n} remisiones generadas.`, type: 'success' })
      await fetchDatos()
    } catch (err) {
      setErrorMsg('No se pudieron generar las remisiones.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica/operaciones" backLabel="Volver" title="📄 Remisiones — Logística" subtitle="Generación de remisiones PDF por sitio y modalidad" />
        <div className="page-content">
          <div className="page-toolbar spread">
            <select value={fecha} onChange={e => setFecha(e.target.value)}>
              <option value="">Selecciona fecha de entrega efectiva</option>
              {fechasDisponibles.map(f => <option key={f} value={f}>{fmtFechaCorta(f)}</option>)}
            </select>
          </div>

          {!fecha ? (
            <div className="empty-state"><p>Selecciona una fecha para ver los sitios con entrega</p></div>
          ) : loadingDatos ? (
            <div className="empty-state"><p>Cargando datos de remisiones...</p></div>
          ) : (
            <>
              {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

              {productosSinPrecio.length > 0 ? (
                <div className="logistica-warning-box">
                  <div><strong>⚠️ No se pueden generar remisiones — faltan valores unitarios</strong></div>
                  <div className="logistica-section-pad" style={{ padding: '10px 0 0' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Código</th><th>Producto</th><th>Modalidad</th></tr>
                      </thead>
                      <tbody>
                        {productosSinPrecio.map(p => {
                          const info = MODALIDAD_INFO[p.modalidad]
                          return (
                            <tr key={p.id}>
                              <td className="logistica-mono">{p.codigo_articulo}</td>
                              <td>{p.nombre_corto}</td>
                              <td><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || p.modalidad}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="logistica-warning-actions">
                    <a href="/logistica/data-maestra/productos" target="_blank" rel="noopener noreferrer" className="btn-primary">Ir a Productos</a>
                    <button className="btn-secondary" onClick={fetchDatos}>🔄 Reintentar</button>
                  </div>
                </div>
              ) : resultadoExito ? (
                <>
                  <div className="logistica-exito-box">
                    ✓ Remisiones generadas correctamente
                    <div className="logistica-exito-detalle">
                      {resultadoExito.cantidad} remisiones generadas · Números {resultadoExito.rangoInicio}-{resultadoExito.rangoFin}<br />
                      {resultadoExito.totalUnidades.toLocaleString('es-CO')} unidades · {resultadoExito.totalValor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                    <button className="btn-primary" onClick={() => setResultadoExito(null)}>📄 Generar más remisiones</button>
                  </div>
                </>
              ) : remisionesDelDia.length === 0 ? (
                <div className="empty-state"><p>No hay sitios con entrega en esta fecha.</p></div>
              ) : (
                <>
                  <div className="rem-stats-row">
                    <div className="rem-stat-card">
                      <div className="rem-stat-num">{resumen.totalAGenerar}</div>
                      <div className="rem-stat-label">Remisiones a generar</div>
                    </div>
                    <div className="rem-stat-card">
                      <div className="rem-stat-num">{resumen.totalUnidadesDia.toLocaleString('es-CO')}</div>
                      <div className="rem-stat-label">Unidades del día</div>
                    </div>
                    <div className="rem-stat-card">
                      <div className="rem-stat-num">{resumen.totalValorDia.toLocaleString('es-CO')}</div>
                      <div className="rem-stat-label">Valorizado del día (COP)</div>
                    </div>
                    <div className="rem-stat-card">
                      <div className="rem-stat-num">{resumen.nuevas} / {resumen.regeneracion}</div>
                      <div className="rem-stat-label">Nuevas / Regeneración</div>
                    </div>
                  </div>

                  {yaGeneradasCount > 0 && (
                    <div className="logistica-info-box">
                      💡 {yaGeneradasCount} remisiones ya fueron generadas antes. Al regenerar se les asignará un NUEVO número de remisión y quedará el registro antiguo también.
                    </div>
                  )}

                  <div className="page-toolbar spread">
                    <label className="logistica-checkbox-label">
                      <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
                      Seleccionar todas
                    </label>
                    <span className="logistica-muted">{selectedKeys.size} de {remisionesDelDia.length} seleccionadas</span>
                  </div>

                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th><input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} /></th>
                          <th>Sitio</th>
                          <th>Localidad</th>
                          <th>Modalidad</th>
                          <th>Productos</th>
                          <th>Total unidades</th>
                          <th>Total valorizado</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remisionesDelDia.map(r => {
                          const info = MODALIDAD_INFO[r.modalidad]
                          const numeroExistente = existentesMap[r.key]
                          return (
                            <tr key={r.key}>
                              <td><input type="checkbox" checked={selectedKeys.has(r.key)} onChange={() => toggleUna(r.key)} /></td>
                              <td>{r.nombre_institucion} <span className="logistica-muted logistica-mono">({r.punto_wms})</span></td>
                              <td><span className="badge badge-info">{r.localidad}</span></td>
                              <td><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || r.modalidad}</span></td>
                              <td>{r.productos.length} productos</td>
                              <td className="logistica-mono" style={{ textAlign: 'right' }}>{r.total_unidades.toLocaleString('es-CO')}</td>
                              <td className="logistica-mono" style={{ textAlign: 'right' }}>{r.total_valorizado.toLocaleString('es-CO')}</td>
                              <td>
                                {numeroExistente != null
                                  ? <span className="badge logistica-badge-warning">Ya generada · Nro {numeroExistente}</span>
                                  : <span className="badge badge-activo">Nueva</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="rem-actions">
                    <button className="btn-generate-pdf" onClick={handleGenerar} disabled={selectedKeys.size === 0 || generando}>
                      {generando ? 'Generando PDFs...' : '📄 Generar PDFs'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
