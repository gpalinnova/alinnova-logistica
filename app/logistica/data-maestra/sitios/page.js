'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import LogisticaSitioModal from '../../../../components/LogisticaSitioModal'
import { supabase } from '../../../../lib/supabase'

export default function SitiosLogisticaPage() {
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [filtroLocalidad, setFiltroLocalidad] = useState('todas')
  const [soloSinLocalidad, setSoloSinLocalidad] = useState(false)
  const [search, setSearch] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [modalState, setModalState] = useState(null)

  useEffect(() => { fetchSitios() }, [])

  async function fetchSitios() {
    setLoading(true)
    const { data, error } = await supabase.from('logistica_sitios').select('*').order('localidad').order('nombre_institucion')
    if (error) {
      setErrorMsg('No se pudieron cargar los sitios.')
    } else {
      setSitios(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const localidadesUnicas = useMemo(() => {
    const set = new Set(sitios.map(s => s.localidad).filter(Boolean))
    const tieneSinLocalidad = set.has('SIN LOCALIDAD')
    set.delete('SIN LOCALIDAD')
    const ordenadas = Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
    if (tieneSinLocalidad) ordenadas.push('SIN LOCALIDAD')
    return ordenadas
  }, [sitios])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sitios.filter(s => {
      if (!mostrarInactivos && !s.activo) return false
      if (soloSinLocalidad) {
        if (s.localidad !== 'SIN LOCALIDAD') return false
      } else if (filtroLocalidad !== 'todas' && s.localidad !== filtroLocalidad) {
        return false
      }
      if (term) {
        const matches = [s.nombre_institucion, String(s.punto_wms), s.direccion, s.nombre_sitio, s.sede_educativa]
          .some(v => v != null && String(v).toLowerCase().includes(term))
        if (!matches) return false
      }
      return true
    })
  }, [sitios, mostrarInactivos, soloSinLocalidad, filtroLocalidad, search])

  const conteo = useMemo(() => {
    const activos = sitios.filter(s => s.activo).length
    const sinLocalidad = sitios.filter(s => s.localidad === 'SIN LOCALIDAD').length
    const localidadesDistintas = new Set(sitios.map(s => s.localidad)).size
    return { activos, sinLocalidad, localidadesDistintas }
  }, [sitios])

  function openAddModal() {
    setModalState({ sitio: null })
  }

  function openEditModal(sitio) {
    setModalState({ sitio })
  }

  function closeModal() {
    setModalState(null)
  }

  async function handleSaved() {
    await fetchSitios()
    setToast({ message: modalState?.sitio ? 'Sitio actualizado correctamente.' : 'Sitio creado correctamente.', type: 'success' })
  }

  async function handleToggleActivo(sitio) {
    const { error } = await supabase.from('logistica_sitios')
      .update({ activo: !sitio.activo })
      .eq('id', sitio.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado del sitio.')
    } else {
      await fetchSitios()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="🏫 Sitios — Logística"
          subtitle={
            <>
              {conteo.activos} sitios activos ·{' '}
              <span className={conteo.sinLocalidad > 0 ? 'logistica-warning-text' : ''}>
                {conteo.sinLocalidad} SIN LOCALIDAD (pendientes)
              </span>
              {' '}· {conteo.localidadesDistintas} localidades distintas
            </>
          }
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por institución, punto WMS, dirección..."
              />
            </div>
            <select value={filtroLocalidad} onChange={e => setFiltroLocalidad(e.target.value)} disabled={soloSinLocalidad}>
              <option value="todas">Todas las localidades</option>
              {localidadesUnicas.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <button
              className={`btn-secondary ${soloSinLocalidad ? 'logistica-btn-selected' : ''}`}
              onClick={() => setSoloSinLocalidad(v => !v)}
            >
              ⚠️ Solo SIN LOCALIDAD
            </button>
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={mostrarInactivos} onChange={e => setMostrarInactivos(e.target.checked)} />
              Mostrar inactivos
            </label>
            <button className="btn-primary" onClick={openAddModal}>➕ Nuevo sitio</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando sitios...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{sitios.length === 0 ? 'No hay sitios cargados todavía.' : 'No hay sitios que coincidan con el filtro.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Punto WMS</th>
                    <th>Nombre institución</th>
                    <th>Nombre sitio</th>
                    <th>Localidad</th>
                    <th>Dirección</th>
                    <th>Sede educativa</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sitio => (
                    <tr key={sitio.id}>
                      <td className="logistica-mono">{sitio.punto_wms}</td>
                      <td>{sitio.nombre_institucion}</td>
                      <td>{sitio.nombre_sitio || <span className="logistica-muted">—</span>}</td>
                      <td>
                        {sitio.localidad === 'SIN LOCALIDAD' ? (
                          <span className="badge logistica-badge-warning">SIN LOCALIDAD</span>
                        ) : (
                          <span className="badge badge-info">{sitio.localidad}</span>
                        )}
                      </td>
                      <td>{sitio.direccion || <span className="logistica-muted">—</span>}</td>
                      <td>{sitio.sede_educativa || <span className="logistica-muted">—</span>}</td>
                      <td>
                        <span className={`badge ${sitio.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                          {sitio.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="product-row-actions">
                          <button className="btn-secondary" onClick={() => openEditModal(sitio)}>✏️ Editar</button>
                          <button className="btn-secondary" onClick={() => handleToggleActivo(sitio)}>
                            {sitio.activo ? '⏸ Desactivar' : '▶️ Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {modalState && (
        <LogisticaSitioModal
          key={modalState.sitio?.id || 'new'}
          open={Boolean(modalState)}
          sitio={modalState.sitio}
          localidadesDisponibles={localidadesUnicas}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
