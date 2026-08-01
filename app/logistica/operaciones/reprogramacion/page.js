'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function EditarFechaModal({ linea, onClose, onGuardar }) {
  const [nuevaFecha, setNuevaFecha] = useState(linea.fecha_entrega_efectiva || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nuevaFecha) {
      setError('La nueva fecha es obligatoria')
      return
    }
    setError('')
    setSaving(true)
    await onGuardar(nuevaFecha)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Reprogramar entrega — {linea.nombre_corto} · {linea.nombre_institucion}</div>
        <div className="modal-hint">
          Punto WMS: {linea.punto_wms}<br />
          Cantidad: {linea.cantidad}<br />
          Fecha original: {formatFechaCorta(linea.fecha_entrega_original)}<br />
          Fecha consumo: {formatFechaCorta(linea.fecha_consumo)}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nueva fecha de entrega efectiva</label>
            <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BulkModal({ lineasSeleccionadas, onClose, onAplicar }) {
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const totalUnidades = lineasSeleccionadas.reduce((acc, l) => acc + l.cantidad, 0)
  const modalidades = Array.from(new Set(lineasSeleccionadas.map(l => l.modalidad)))
  const sitios = new Set(lineasSeleccionadas.map(l => l.punto_wms)).size

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nuevaFecha) {
      setError('La nueva fecha es obligatoria')
      return
    }
    setError('')
    setSaving(true)
    await onAplicar(nuevaFecha)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Reprogramar {lineasSeleccionadas.length} líneas seleccionadas</div>
        <div className="modal-hint">
          Total unidades afectadas: {totalUnidades.toLocaleString('es-CO')}<br />
          Modalidades: {modalidades.map(m => MODALIDAD_INFO[m]?.label || m).join(', ')}<br />
          Sitios involucrados: {sitios}
        </div>
        <div className="logistica-info-box">💡 Todas las líneas seleccionadas quedarán con la misma fecha de entrega efectiva.</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nueva fecha de entrega efectiva</label>
            <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Aplicando...' : 'Aplicar a todas'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReprogramacionPage() {
  const [lineas, setLineas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState('todas')
  const [filtroModalidad, setFiltroModalidad] = useState('todas')
  const [filtroLocalidad, setFiltroLocalidad] = useState('todas')
  const [search, setSearch] = useState('')
  const [soloReprogramadas, setSoloReprogramadas] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [editandoLinea, setEditandoLinea] = useState(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)

  useEffect(() => { fetchLineas() }, [])

  async function fetchLineas() {
    setLoading(true)
    const { data, error } = await supabase
      .from('logistica_oc_detalle')
      .select(`
        id, cantidad, fecha_entrega_original, fecha_entrega_efectiva, fecha_consumo, observacion,
        sitio:logistica_sitios(id, punto_wms, nombre_institucion, localidad),
        producto:logistica_productos(id, codigo_articulo, nombre_corto, modalidad),
        oc:logistica_oc(numero_oc, fecha_recepcion)
      `)
      .order('fecha_entrega_efectiva')
    if (error) {
      setErrorMsg('No se pudieron cargar las líneas de OC.')
    } else {
      const flat = (data || []).map(d => ({
        id: d.id,
        cantidad: d.cantidad,
        fecha_entrega_original: d.fecha_entrega_original,
        fecha_entrega_efectiva: d.fecha_entrega_efectiva,
        fecha_consumo: d.fecha_consumo,
        observacion: d.observacion,
        sitio_id: d.sitio?.id,
        punto_wms: d.sitio?.punto_wms,
        nombre_institucion: d.sitio?.nombre_institucion,
        localidad: d.sitio?.localidad,
        producto_id: d.producto?.id,
        codigo_articulo: d.producto?.codigo_articulo,
        nombre_corto: d.producto?.nombre_corto,
        modalidad: d.producto?.modalidad,
        numero_oc: d.oc?.numero_oc,
        fecha_recepcion: d.oc?.fecha_recepcion,
      }))
      flat.sort((a, b) =>
        (a.fecha_entrega_efectiva || '').localeCompare(b.fecha_entrega_efectiva || '') ||
        (a.localidad || '').localeCompare(b.localidad || '', 'es') ||
        (a.nombre_institucion || '').localeCompare(b.nombre_institucion || '', 'es') ||
        (a.modalidad || '').localeCompare(b.modalidad || '') ||
        (a.nombre_corto || '').localeCompare(b.nombre_corto || '', 'es')
      )
      setLineas(flat)
      setErrorMsg('')
    }
    setLoading(false)
  }

  const fechasDisponibles = useMemo(() =>
    Array.from(new Set(lineas.map(l => l.fecha_entrega_efectiva).filter(Boolean))).sort()
  , [lineas])

  const localidadesDisponibles = useMemo(() =>
    Array.from(new Set(lineas.map(l => l.localidad).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  , [lineas])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return lineas.filter(l => {
      if (filtroFecha !== 'todas' && l.fecha_entrega_efectiva !== filtroFecha) return false
      if (filtroModalidad !== 'todas' && l.modalidad !== filtroModalidad) return false
      if (filtroLocalidad !== 'todas' && l.localidad !== filtroLocalidad) return false
      if (soloReprogramadas && l.fecha_entrega_efectiva === l.fecha_entrega_original) return false
      if (term) {
        const matches = [l.nombre_institucion, String(l.punto_wms), l.nombre_corto]
          .some(v => v != null && String(v).toLowerCase().includes(term))
        if (!matches) return false
      }
      return true
    })
  }, [lineas, filtroFecha, filtroModalidad, filtroLocalidad, soloReprogramadas, search])

  const resumenGlobal = useMemo(() => {
    const totalReprogramadas = lineas.filter(l => l.fecha_entrega_efectiva !== l.fecha_entrega_original).length
    const fechasDistintas = new Set(lineas.map(l => l.fecha_entrega_efectiva)).size
    return { totalLineas: lineas.length, totalReprogramadas, fechasDistintas }
  }, [lineas])

  const resumenFiltrado = useMemo(() => {
    const totalUnidades = filtered.reduce((acc, l) => acc + l.cantidad, 0)
    const reprogramadas = filtered.filter(l => l.fecha_entrega_efectiva !== l.fecha_entrega_original).length
    const fechasSet = new Set(filtered.map(l => l.fecha_entrega_efectiva).filter(Boolean))
    const fechasOrdenadas = Array.from(fechasSet).sort()
    const rango = fechasOrdenadas.length === 0 ? '—'
      : fechasOrdenadas.length === 1 ? formatFechaCorta(fechasOrdenadas[0])
      : `${formatFechaCorta(fechasOrdenadas[0])} → ${formatFechaCorta(fechasOrdenadas[fechasOrdenadas.length - 1])}`
    return { totalLineas: filtered.length, totalUnidades, reprogramadas, fechasDistintas: fechasSet.size, rango }
  }, [filtered])

  const todosVisiblesSeleccionados = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))
  const lineasSeleccionadas = useMemo(() => lineas.filter(l => selectedIds.has(l.id)), [lineas, selectedIds])
  const haySeleccionReprogramable = lineasSeleccionadas.some(l => l.fecha_entrega_efectiva !== l.fecha_entrega_original)

  function toggleSeleccionTodosVisibles() {
    if (todosVisiblesSeleccionados) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)))
    }
  }

  function toggleSeleccionUno(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleGuardarFechaLinea(nuevaFecha) {
    const { error } = await supabase.from('logistica_oc_detalle')
      .update({ fecha_entrega_efectiva: nuevaFecha })
      .eq('id', editandoLinea.id)
    if (error) {
      setErrorMsg('No se pudo actualizar la fecha.')
    } else {
      await fetchLineas()
      setToast({ message: 'Fecha actualizada.', type: 'success' })
      setEditandoLinea(null)
    }
  }

  async function handleResetearUno(linea) {
    const { error } = await supabase.from('logistica_oc_detalle')
      .update({ fecha_entrega_efectiva: linea.fecha_entrega_original })
      .eq('id', linea.id)
    if (error) {
      setErrorMsg('No se pudo resetear la fecha.')
    } else {
      await fetchLineas()
      setToast({ message: 'Fecha reseteada a la original.', type: 'success' })
    }
  }

  async function handleResetearSeleccionadas() {
    const filas = lineasSeleccionadas.filter(l => l.fecha_entrega_efectiva !== l.fecha_entrega_original)
    if (filas.length === 0) return
    const resultados = await Promise.all(
      filas.map(l => supabase.from('logistica_oc_detalle').update({ fecha_entrega_efectiva: l.fecha_entrega_original }).eq('id', l.id))
    )
    if (resultados.some(r => r.error)) {
      setErrorMsg('No se pudieron resetear todas las líneas seleccionadas.')
    } else {
      await fetchLineas()
      setToast({ message: `${filas.length} líneas reseteadas a su fecha original.`, type: 'success' })
      setSelectedIds(new Set())
    }
  }

  async function handleAplicarBloque(nuevaFecha) {
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('logistica_oc_detalle')
      .update({ fecha_entrega_efectiva: nuevaFecha })
      .in('id', ids)
    if (error) {
      setErrorMsg('No se pudieron actualizar las líneas seleccionadas.')
    } else {
      await fetchLineas()
      setToast({ message: `${ids.length} líneas actualizadas.`, type: 'success' })
      setSelectedIds(new Set())
      setBulkModalOpen(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/operaciones"
          backLabel="Volver"
          title="📆 Reprogramación de Fechas — Logística"
          subtitle={`${resumenGlobal.totalLineas} líneas totales · ${resumenGlobal.totalReprogramadas} reprogramadas · ${resumenGlobal.fechasDistintas} fechas de entrega distintas`}
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por institución, punto WMS, producto..."
              />
            </div>
            <select value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}>
              <option value="todas">Todas las fechas</option>
              {fechasDisponibles.map(f => <option key={f} value={f}>{formatFechaCorta(f)}</option>)}
            </select>
            <select value={filtroModalidad} onChange={e => setFiltroModalidad(e.target.value)}>
              <option value="todas">Todas las modalidades</option>
              <option value="panaderia">🥐 Panadería</option>
              <option value="am_pm">☀️ AM-PM</option>
              <option value="gastronomia">🍽️ Gastronomía</option>
            </select>
            <select value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)}>
              <option value="todas">Todas las localidades</option>
              {localidadesDisponibles.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={soloReprogramadas} onChange={e => setSoloReprogramadas(e.target.checked)} />
              Solo reprogramadas
            </label>
          </div>

          <div className="rem-stats-row">
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumenFiltrado.totalLineas}</div>
              <div className="rem-stat-label">Líneas visibles</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumenFiltrado.totalUnidades.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Unidades visibles</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumenFiltrado.reprogramadas}</div>
              <div className="rem-stat-label">Ya reprogramadas</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumenFiltrado.fechasDistintas}</div>
              <div className="rem-stat-label">Fechas ({resumenFiltrado.rango})</div>
            </div>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="page-toolbar spread">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={todosVisiblesSeleccionados} onChange={toggleSeleccionTodosVisibles} />
              Seleccionar todos los visibles
            </label>
            <span className="logistica-muted">{selectedIds.size} líneas seleccionadas</span>
            <button className="btn-primary" onClick={() => setBulkModalOpen(true)} disabled={selectedIds.size === 0}>
              📆 Reprogramar seleccionadas...
            </button>
            <button className="btn-secondary" onClick={handleResetearSeleccionadas} disabled={selectedIds.size === 0 || !haySeleccionReprogramable}>
              ↩️ Resetear seleccionadas
            </button>
          </div>

          {loading ? (
            <div className="empty-state"><p>Cargando líneas...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{lineas.length === 0 ? 'No hay líneas de OC importadas todavía.' : 'No hay líneas que coincidan con el filtro.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={todosVisiblesSeleccionados} onChange={toggleSeleccionTodosVisibles} /></th>
                    <th>Punto WMS</th>
                    <th>Institución</th>
                    <th>Localidad</th>
                    <th>Producto</th>
                    <th>Modalidad</th>
                    <th>Cantidad</th>
                    <th>Fecha original</th>
                    <th>Fecha efectiva</th>
                    <th>Fecha consumo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const modInfo = MODALIDAD_INFO[l.modalidad]
                    const reprogramada = l.fecha_entrega_efectiva !== l.fecha_entrega_original
                    return (
                      <tr key={l.id}>
                        <td><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSeleccionUno(l.id)} /></td>
                        <td className="logistica-mono">{l.punto_wms}</td>
                        <td>{l.nombre_institucion}</td>
                        <td><span className="badge badge-info">{l.localidad}</span></td>
                        <td>{l.nombre_corto}</td>
                        <td><span className={`logistica-pill ${modInfo?.className || ''}`}>{modInfo?.label || l.modalidad}</span></td>
                        <td className="logistica-mono" style={{ textAlign: 'right' }}>{l.cantidad.toLocaleString('es-CO')}</td>
                        <td className="logistica-mono logistica-muted">{formatFechaCorta(l.fecha_entrega_original)}</td>
                        <td className={`logistica-mono ${reprogramada ? 'logistica-warning-text' : ''}`}>{formatFechaCorta(l.fecha_entrega_efectiva)}</td>
                        <td className="logistica-mono logistica-muted">{formatFechaCorta(l.fecha_consumo)}</td>
                        <td>
                          <div className="product-row-actions">
                            <button className="btn-secondary" onClick={() => setEditandoLinea(l)}>✏️ Editar fecha</button>
                            <button className="btn-secondary" onClick={() => handleResetearUno(l)} disabled={!reprogramada}>↩️ Resetear</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editandoLinea && (
        <EditarFechaModal
          linea={editandoLinea}
          onClose={() => setEditandoLinea(null)}
          onGuardar={handleGuardarFechaLinea}
        />
      )}

      {bulkModalOpen && (
        <BulkModal
          lineasSeleccionadas={lineasSeleccionadas}
          onClose={() => setBulkModalOpen(false)}
          onAplicar={handleAplicarBloque}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
