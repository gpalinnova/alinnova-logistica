'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import LogisticaRutaModal from '../../../../components/LogisticaRutaModal'
import { supabase } from '../../../../lib/supabase'

export default function RutasLogisticaPage() {
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [mostrarInactivas, setMostrarInactivas] = useState(false)
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchRutas() }, [])

  async function fetchRutas() {
    setLoading(true)
    const { data, error } = await supabase.from('logistica_rutas').select('*').order('localidad_principal').order('nombre')
    if (error) {
      setErrorMsg('No se pudieron cargar las rutas.')
    } else {
      setRutas(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rutas.filter(r => {
      if (!mostrarInactivas && !r.activo) return false
      if (term) {
        const matches = [r.nombre, r.localidad_principal, r.placa_vehiculo, r.conductor, r.auxiliar]
          .some(v => v != null && String(v).toLowerCase().includes(term))
        if (!matches) return false
      }
      return true
    })
  }, [rutas, search, mostrarInactivas])

  const conteo = useMemo(() => {
    const activas = rutas.filter(r => r.activo)
    return {
      activas: activas.length,
    }
  }, [rutas])

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(ruta) {
    setModalState({ mode: 'edit', ruta })
  }

  function closeModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        const { error } = await supabase.from('logistica_rutas').insert([formData])
        if (error) throw error
        setToast({ message: 'Ruta creada correctamente.', type: 'success' })
      } else {
        const { error } = await supabase.from('logistica_rutas')
          .update(formData)
          .eq('id', modalState.ruta.id)
        if (error) throw error
        setToast({ message: 'Ruta actualizada correctamente.', type: 'success' })
      }
      await fetchRutas()
      setModalState(null)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg('No se pudo guardar la ruta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(ruta) {
    const { error } = await supabase.from('logistica_rutas')
      .update({ activo: !ruta.activo })
      .eq('id', ruta.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado de la ruta.')
    } else {
      await fetchRutas()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="🛣️ Rutas — Logística"
          subtitle={`${conteo.activas} rutas activas`}
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por nombre, localidad, placa, conductor..."
              />
            </div>
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={mostrarInactivas} onChange={e => setMostrarInactivas(e.target.checked)} />
              Mostrar inactivas
            </label>
            <button className="btn-primary" onClick={openAddModal}>➕ Nueva ruta</button>
          </div>

          <div className="logistica-info-box">
            💡 La asignación de sitios a cada ruta se hace desde el módulo de Rutero del Día una vez importadas las OCs.
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando rutas...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{rutas.length === 0 ? 'No hay rutas cargadas todavía.' : 'No hay rutas que coincidan con el filtro.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Localidad principal</th>
                    <th>Placa</th>
                    <th>Conductor</th>
                    <th>Auxiliar</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ruta => {
                    return (
                      <tr key={ruta.id}>
                        <td>{ruta.nombre}</td>
                        <td>{ruta.localidad_principal || <span className="logistica-muted">—</span>}</td>
                        <td className="logistica-mono">{ruta.placa_vehiculo || <span className="logistica-muted">—</span>}</td>
                        <td>{ruta.conductor || <span className="logistica-muted">—</span>}</td>
                        <td>{ruta.auxiliar || <span className="logistica-muted">—</span>}</td>
                        <td>
                          <span className={`badge ${ruta.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                            {ruta.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="product-row-actions">
                            <button className="btn-secondary" onClick={() => openEditModal(ruta)}>✏️ Editar</button>
                            <button className="btn-secondary" onClick={() => handleToggleActivo(ruta)}>
                              {ruta.activo ? '⏸ Desactivar' : '▶️ Activar'}
                            </button>
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

      {modalState && (
        <LogisticaRutaModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? modalState.ruta : null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
