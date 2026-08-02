'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', emoji: '🥐' },
  am_pm: { label: 'AM-PM', emoji: '☀️' },
  gastronomia: { label: 'Gastronomía', emoji: '🍽️' },
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function sumaUnidades(lista) {
  return lista.reduce((acc, s) => acc + s.unidades_totales, 0)
}

function SitioCard({ sitio, rutas, rutaActual, saving, onChange }) {
  return (
    <div className={`ruteo-card ${saving ? 'ruteo-card-saving' : ''}`}>
      <div className="ruteo-card-title">{sitio.nombre_institucion}</div>
      <div className="ruteo-card-meta">{sitio.punto_wms} · {sitio.localidad}</div>
      <div className="ruteo-card-pills">
        <span className="badge badge-info logistica-mono">{sitio.unidades_totales.toLocaleString('es-CO')} und</span>
        {sitio.num_lineas > 1 && <span className="badge badge-tipo1">{sitio.num_lineas} líneas</span>}
      </div>
      <label className="ruteo-card-select-label">
        Ruta:
        <select
          value={rutaActual || ''}
          disabled={saving}
          onChange={e => onChange(sitio, e.target.value)}
        >
          <option value="">SIN RUTA</option>
          {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </label>
    </div>
  )
}

function AutoAsignarModal({ preview, onClose, onConfirmar, saving }) {
  const asignables = useMemo(() => preview.filter(p => p.ruta), [preview])
  const sinMatch = useMemo(() => preview.filter(p => !p.ruta), [preview])

  const grupos = useMemo(() => {
    const map = new Map()
    for (const p of asignables) {
      if (!map.has(p.ruta.id)) map.set(p.ruta.id, { ruta: p.ruta, count: 0 })
      map.get(p.ruta.id).count += 1
    }
    return Array.from(map.values())
  }, [asignables])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">🎯 Auto-asignar por localidad</div>
        <div className="logistica-info-box">
          💡 Los sitios SIN RUTA se asignarán a la ruta cuya localidad principal coincida con la localidad del sitio. Si hay varias rutas con la misma localidad, se usa la primera en orden alfabético.
        </div>
        {grupos.length === 0 ? (
          <p className="modal-hint">Ningún sitio sin ruta tiene una ruta con localidad coincidente.</p>
        ) : (
          <ul className="ruteo-preview-list">
            {grupos.map(g => (
              <li key={g.ruta.id}>{g.count} sitios se asignarán a la ruta <strong>{g.ruta.nombre}</strong> ({g.ruta.localidad_principal || 'sin localidad'})</li>
            ))}
          </ul>
        )}
        {sinMatch.length > 0 && (
          <p className="modal-hint">⚠️ {sinMatch.length} sitios se quedarán sin ruta porque no hay ninguna ruta con esa localidad.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={onConfirmar} disabled={saving || asignables.length === 0}>
            {saving ? 'Aplicando...' : `✅ Asignar ${asignables.length} sitios`}
          </button>
        </div>
      </div>
    </div>
  )
}

function LimpiarModal({ totalAsignados, onClose, onConfirmar, saving }) {
  const [entendido, setEntendido] = useState(false)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">🧹 Limpiar todas las asignaciones del día</div>
        <div className="logistica-warning-box">
          ⚠️ Esta acción eliminará las {totalAsignados} asignaciones de ruta de los sitios visibles en esta pantalla (fecha y modalidad seleccionadas). No se puede deshacer.
        </div>
        <label className="logistica-checkbox-label">
          <input type="checkbox" checked={entendido} onChange={e => setEntendido(e.target.checked)} />
          Entiendo que esta acción no se puede deshacer
        </label>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={onConfirmar} disabled={saving || !entendido}>
            {saving ? 'Eliminando...' : '🗑️ Eliminar todas'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RuteroPage() {
  const [fechasDisponibles, setFechasDisponibles] = useState([])
  const [fecha, setFecha] = useState('')
  const [modalidad, setModalidad] = useState('')

  const [sitios, setSitios] = useState([])
  const [rutas, setRutas] = useState([])
  const [asignaciones, setAsignaciones] = useState({})
  const [loadingDatos, setLoadingDatos] = useState(false)
  const [savingSitios, setSavingSitios] = useState(new Set())

  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)

  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoPreview, setAutoPreview] = useState([])
  const [autoSaving, setAutoSaving] = useState(false)

  const [limpiarModalOpen, setLimpiarModalOpen] = useState(false)
  const [limpiarSaving, setLimpiarSaving] = useState(false)

  useEffect(() => { fetchFechas() }, [])

  useEffect(() => {
    if (fecha && modalidad) {
      fetchDatos()
    } else {
      setSitios([])
      setRutas([])
      setAsignaciones({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, modalidad])

  async function fetchFechas() {
    const { data, error } = await supabase.from('logistica_oc_detalle').select('fecha_entrega_efectiva')
    if (!error) {
      const unicas = Array.from(new Set((data || []).map(d => d.fecha_entrega_efectiva).filter(Boolean))).sort()
      setFechasDisponibles(unicas)
    }
  }

  async function fetchDatos() {
    setLoadingDatos(true)
    setErrorMsg('')
    try {
      const { data: detalleData, error: errDetalle } = await supabase
        .from('logistica_oc_detalle')
        .select(`
          id, cantidad, sitio_id,
          sitio:logistica_sitios(id, punto_wms, nombre_institucion, localidad),
          producto:logistica_productos!inner(id, modalidad)
        `)
        .eq('fecha_entrega_efectiva', fecha)
        .eq('producto.modalidad', modalidad)
      if (errDetalle) throw errDetalle

      const sitiosMap = new Map()
      for (const d of detalleData || []) {
        if (!d.sitio) continue
        const key = d.sitio.id
        if (!sitiosMap.has(key)) {
          sitiosMap.set(key, {
            id: d.sitio.id,
            punto_wms: d.sitio.punto_wms,
            nombre_institucion: d.sitio.nombre_institucion,
            localidad: d.sitio.localidad,
            unidades_totales: 0,
            num_lineas: 0,
          })
        }
        const s = sitiosMap.get(key)
        s.unidades_totales += d.cantidad
        s.num_lineas += 1
      }
      const sitiosArr = Array.from(sitiosMap.values()).sort((a, b) =>
        (a.localidad || '').localeCompare(b.localidad || '', 'es') ||
        (a.nombre_institucion || '').localeCompare(b.nombre_institucion || '', 'es')
      )

      const { data: rutasData, error: errRutas } = await supabase
        .from('logistica_rutas')
        .select('id, nombre, localidad_principal, placa_vehiculo, conductor')
        .eq('activo', true)
        .eq('modalidad', modalidad)
        .order('localidad_principal')
        .order('nombre')
      if (errRutas) throw errRutas

      const rutaIds = (rutasData || []).map(r => r.id)
      let asigData = []
      if (rutaIds.length > 0 && sitiosArr.length > 0) {
        const sitioIds = sitiosArr.map(s => s.id)
        const { data, error: errAsig } = await supabase
          .from('logistica_sitio_ruta')
          .select('sitio_id, ruta_id')
          .in('ruta_id', rutaIds)
          .in('sitio_id', sitioIds)
        if (errAsig) throw errAsig
        asigData = data || []
      }
      const asigMap = {}
      for (const a of asigData) asigMap[a.sitio_id] = a.ruta_id

      setSitios(sitiosArr)
      setRutas(rutasData || [])
      setAsignaciones(asigMap)
    } catch (err) {
      setErrorMsg('No se pudieron cargar los datos de ruteo.')
    } finally {
      setLoadingDatos(false)
    }
  }

  const columnaSinRuta = useMemo(() => sitios.filter(s => !asignaciones[s.id]), [sitios, asignaciones])

  function sitiosDeRuta(rutaId) {
    return sitios.filter(s => asignaciones[s.id] === rutaId)
  }

  const resumen = useMemo(() => ({
    totalSitios: sitios.length,
    sinRuta: columnaSinRuta.length,
    totalUnidades: sumaUnidades(sitios),
    totalRutas: rutas.length,
  }), [sitios, columnaSinRuta, rutas])

  const totalAsignados = resumen.totalSitios - resumen.sinRuta

  async function handleCambiarRuta(sitio, nuevoRutaId) {
    const anteriorRutaId = asignaciones[sitio.id] || null
    if (nuevoRutaId === (anteriorRutaId || '')) return

    setSavingSitios(prev => new Set(prev).add(sitio.id))
    setErrorMsg('')
    try {
      const rutaIdsModalidad = rutas.map(r => r.id)
      if (!nuevoRutaId) {
        if (anteriorRutaId) {
          const { error } = await supabase.from('logistica_sitio_ruta')
            .delete()
            .eq('sitio_id', sitio.id)
            .in('ruta_id', rutaIdsModalidad)
          if (error) throw error
        }
      } else if (anteriorRutaId) {
        const { error } = await supabase.from('logistica_sitio_ruta')
          .update({ ruta_id: nuevoRutaId })
          .eq('sitio_id', sitio.id)
          .in('ruta_id', rutaIdsModalidad)
        if (error) throw error
      } else {
        const { error } = await supabase.from('logistica_sitio_ruta')
          .insert([{ sitio_id: sitio.id, ruta_id: nuevoRutaId }])
        if (error) throw error
      }

      setAsignaciones(prev => {
        const next = { ...prev }
        if (nuevoRutaId) next[sitio.id] = nuevoRutaId
        else delete next[sitio.id]
        return next
      })
      setToast({ message: 'Asignación actualizada.', type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo actualizar la asignación de ruta.')
    } finally {
      setSavingSitios(prev => {
        const next = new Set(prev)
        next.delete(sitio.id)
        return next
      })
    }
  }

  function abrirAutoAsignar() {
    const preview = columnaSinRuta.map(s => {
      const matches = rutas
        .filter(r => (r.localidad_principal || '').trim().toLowerCase() === (s.localidad || '').trim().toLowerCase())
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      return { sitio: s, ruta: matches[0] || null }
    })
    setAutoPreview(preview)
    setAutoModalOpen(true)
  }

  async function confirmarAutoAsignar() {
    const paraInsertar = autoPreview
      .filter(p => p.ruta)
      .map(p => ({ sitio_id: p.sitio.id, ruta_id: p.ruta.id }))
    if (paraInsertar.length === 0) {
      setAutoModalOpen(false)
      return
    }
    setAutoSaving(true)
    setErrorMsg('')
    try {
      const { error } = await supabase.from('logistica_sitio_ruta').insert(paraInsertar)
      if (error) throw error
      setAsignaciones(prev => {
        const next = { ...prev }
        for (const p of paraInsertar) next[p.sitio_id] = p.ruta_id
        return next
      })
      setToast({ message: `${paraInsertar.length} sitios asignados automáticamente.`, type: 'success' })
      setAutoModalOpen(false)
    } catch (err) {
      setErrorMsg('No se pudo aplicar la auto-asignación.')
    } finally {
      setAutoSaving(false)
    }
  }

  async function confirmarLimpiar() {
    const sitioIds = sitios.map(s => s.id)
    const rutaIds = rutas.map(r => r.id)
    if (sitioIds.length === 0 || rutaIds.length === 0) {
      setLimpiarModalOpen(false)
      return
    }
    setLimpiarSaving(true)
    setErrorMsg('')
    try {
      const { error } = await supabase.from('logistica_sitio_ruta')
        .delete()
        .in('sitio_id', sitioIds)
        .in('ruta_id', rutaIds)
      if (error) throw error
      setAsignaciones({})
      setToast({ message: 'Todas las asignaciones del día fueron eliminadas.', type: 'success' })
      setLimpiarModalOpen(false)
    } catch (err) {
      setErrorMsg('No se pudieron limpiar las asignaciones.')
    } finally {
      setLimpiarSaving(false)
    }
  }

  const modInfo = MODALIDAD_INFO[modalidad]
  const subtitle = (fecha && modalidad)
    ? `Fecha ${formatFechaCorta(fecha)} · Modalidad ${modInfo?.label || modalidad} · ${resumen.totalSitios} sitios totales`
    : 'Selecciona fecha y modalidad para ver los sitios a rutear'

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/operaciones"
          backLabel="Volver"
          title="🗺️ Rutero del Día — Logística"
          subtitle={subtitle}
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <select value={fecha} onChange={e => setFecha(e.target.value)}>
              <option value="">Selecciona fecha de entrega efectiva</option>
              {fechasDisponibles.map(f => <option key={f} value={f}>{formatFechaCorta(f)}</option>)}
            </select>
            <select value={modalidad} onChange={e => setModalidad(e.target.value)}>
              <option value="">Selecciona modalidad</option>
              <option value="panaderia">🥐 Panadería</option>
              <option value="am_pm">☀️ AM-PM</option>
              <option value="gastronomia">🍽️ Gastronomía</option>
            </select>
          </div>

          {!fecha || !modalidad ? (
            <div className="empty-state"><p>Selecciona fecha y modalidad para ver los sitios a rutear</p></div>
          ) : (
            <>
              {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

              <div className="rem-stats-row">
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumen.totalSitios}</div>
                  <div className="rem-stat-label">Total sitios a rutear</div>
                </div>
                <div className={`rem-stat-card ${resumen.sinRuta > 0 ? 'ruteo-stat-warning' : ''}`}>
                  <div className="rem-stat-num">{resumen.sinRuta}</div>
                  <div className="rem-stat-label">Sitios sin ruta</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumen.totalUnidades.toLocaleString('es-CO')}</div>
                  <div className="rem-stat-label">Unidades del día</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{resumen.totalRutas}</div>
                  <div className="rem-stat-label">Rutas activas</div>
                </div>
              </div>

              <div className="page-toolbar spread">
                <span className="logistica-muted">{totalAsignados} sitios ya asignados a ruta</span>
                <div className="product-row-actions">
                  <button
                    className="btn-secondary"
                    onClick={abrirAutoAsignar}
                    disabled={rutas.length === 0 || columnaSinRuta.length === 0}
                  >
                    🎯 Auto-asignar por localidad
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => setLimpiarModalOpen(true)}
                    disabled={totalAsignados === 0}
                  >
                    🧹 Limpiar todas las asignaciones del día
                  </button>
                </div>
              </div>

              {loadingDatos ? (
                <div className="empty-state"><p>Cargando sitios...</p></div>
              ) : sitios.length === 0 ? (
                <div className="empty-state"><p>No hay sitios con entrega ese día en esa modalidad.</p></div>
              ) : (
                <div className="ruteo-board">
                  <div className="ruteo-column ruteo-column-sinruta">
                    <div className="ruteo-column-header">
                      <div className="ruteo-column-title">⚠️ SIN RUTA</div>
                    </div>
                    <div className="ruteo-column-count">
                      {columnaSinRuta.length} sitios · {sumaUnidades(columnaSinRuta).toLocaleString('es-CO')} unidades
                    </div>
                    <div className="ruteo-column-body">
                      {columnaSinRuta.length === 0 ? (
                        <div className="ruteo-empty-column">Todos los sitios tienen ruta asignada.</div>
                      ) : (
                        columnaSinRuta.map(s => (
                          <SitioCard
                            key={s.id}
                            sitio={s}
                            rutas={rutas}
                            rutaActual=""
                            saving={savingSitios.has(s.id)}
                            onChange={handleCambiarRuta}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {rutas.map(r => {
                    const sitiosRuta = sitiosDeRuta(r.id)
                    return (
                      <div key={r.id} className="ruteo-column">
                        <div className="ruteo-column-header">
                          <div className="ruteo-column-title">{r.nombre}</div>
                          <div className="ruteo-column-sub">{r.localidad_principal || '—'}</div>
                          <div className="ruteo-column-meta">{r.placa_vehiculo || '—'} · {r.conductor || '—'}</div>
                        </div>
                        <div className="ruteo-column-count">
                          {sitiosRuta.length} sitios · {sumaUnidades(sitiosRuta).toLocaleString('es-CO')} unidades
                        </div>
                        <div className="ruteo-column-body">
                          {sitiosRuta.length === 0 ? (
                            <div className="ruteo-empty-column">Sin sitios asignados.</div>
                          ) : (
                            sitiosRuta.map(s => (
                              <SitioCard
                                key={s.id}
                                sitio={s}
                                rutas={rutas}
                                rutaActual={r.id}
                                saving={savingSitios.has(s.id)}
                                onChange={handleCambiarRuta}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {autoModalOpen && (
        <AutoAsignarModal
          preview={autoPreview}
          onClose={() => setAutoModalOpen(false)}
          onConfirmar={confirmarAutoAsignar}
          saving={autoSaving}
        />
      )}

      {limpiarModalOpen && (
        <LimpiarModal
          totalAsignados={totalAsignados}
          onClose={() => setLimpiarModalOpen(false)}
          onConfirmar={confirmarLimpiar}
          saving={limpiarSaving}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
