'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import RepartidorModal from '../../../components/RepartidorModal'
import { supabase } from '../../../lib/supabase'

export default function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchRepartidores() }, [])

  async function fetchRepartidores() {
    setLoading(true)
    const { data, error } = await supabase.from('reforzados_repartidores').select('*').order('conductor')
    if (error) {
      setErrorMsg('No se pudieron cargar los repartidores.')
    } else {
      setRepartidores(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return repartidores
    return repartidores.filter(r => [
      r.conductor,
      r.auxiliar,
      r.placa,
    ].some(v => v != null && String(v).toLowerCase().includes(term)))
  }, [repartidores, search])

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(repartidor) {
    setModalState({ mode: 'edit', repartidor })
  }

  function closeModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        const { error } = await supabase.from('reforzados_repartidores').insert([formData])
        if (error) throw error
      } else {
        const { error } = await supabase.from('reforzados_repartidores')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', modalState.repartidor.id)
        if (error) throw error
      }
      await fetchRepartidores()
      setModalState(null)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.code === '23505' ? 'Ya existe un repartidor con esa placa.' : 'No se pudo guardar el repartidor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(repartidor) {
    const { error } = await supabase.from('reforzados_repartidores')
      .update({ activo: !repartidor.activo, updated_at: new Date().toISOString() })
      .eq('id', repartidor.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado del repartidor.')
    } else {
      await fetchRepartidores()
    }
  }

  async function handleDelete(repartidor) {
    if (!window.confirm(`¿Eliminar el repartidor ${repartidor.conductor} / ${repartidor.placa}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('reforzados_repartidores').delete().eq('id', repartidor.id)
    if (error) {
      setErrorMsg('No se pudo eliminar el repartidor.')
    } else {
      await fetchRepartidores()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Repartidores Maestro" subtitle="Unidades de reparto: conductor, auxiliar y placa" />
        <div className="page-content">
          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por conductor, auxiliar o placa..."
              />
            </div>
            <button className="btn-primary" onClick={openAddModal}>➕ Agregar Repartidor</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando repartidores...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{repartidores.length === 0 ? 'No hay repartidores cargados todavía.' : 'No hay repartidores que coincidan con la búsqueda.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>Auxiliar</th>
                    <th>Placa</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(repartidor => (
                    <tr key={repartidor.id}>
                      <td>{repartidor.conductor}</td>
                      <td>{repartidor.auxiliar}</td>
                      <td>{repartidor.placa}</td>
                      <td>
                        <label className="switch" title={repartidor.activo ? 'Activo' : 'Inactivo'}>
                          <input type="checkbox" checked={repartidor.activo} onChange={() => handleToggleActivo(repartidor)} />
                          <span className="switch-slider"></span>
                        </label>
                      </td>
                      <td>
                        <div className="product-row-actions">
                          <button className="icon-btn" title="Editar" onClick={() => openEditModal(repartidor)}>✏️</button>
                          <button className="icon-btn danger" title="Eliminar" onClick={() => handleDelete(repartidor)}>🗑️</button>
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
        <RepartidorModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? modalState.repartidor : null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </div>
  )
}
