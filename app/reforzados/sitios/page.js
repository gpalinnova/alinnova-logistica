'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import SitioModal from '../../../components/SitioModal'
import { supabase } from '../../../lib/supabase'

export default function SitiosPage() {
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSitios() }, [])

  async function fetchSitios() {
    setLoading(true)
    const { data, error } = await supabase.from('reforzados_sitios').select('*').order('id_sitio_entrega')
    if (error) {
      setErrorMsg('No se pudieron cargar los sitios.')
    } else {
      setSitios(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sitios
    return sitios.filter(s => [
      s.id_sitio_entrega,
      s.nombre_institucion,
      s.localidad,
      s.barrio,
      s.direccion,
      s.nombre_descripcion,
    ].some(v => v != null && String(v).toLowerCase().includes(term)))
  }, [sitios, search])

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(sitio) {
    setModalState({ mode: 'edit', sitio })
  }

  function closeModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        const { error } = await supabase.from('reforzados_sitios').insert([formData])
        if (error) throw error
      } else {
        const { error } = await supabase.from('reforzados_sitios')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', modalState.sitio.id)
        if (error) throw error
      }
      await fetchSitios()
      setModalState(null)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.code === '23505' ? 'Ya existe un sitio con ese ID de entrega.' : 'No se pudo guardar el sitio.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(sitio) {
    const { error } = await supabase.from('reforzados_sitios')
      .update({ activo: !sitio.activo, updated_at: new Date().toISOString() })
      .eq('id', sitio.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado del sitio.')
    } else {
      await fetchSitios()
    }
  }

  async function handleDelete(sitio) {
    if (!window.confirm(`¿Eliminar el sitio ${sitio.id_sitio_entrega} (${sitio.nombre_institucion})? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('reforzados_sitios').delete().eq('id', sitio.id)
    if (error) {
      setErrorMsg('No se pudo eliminar el sitio.')
    } else {
      await fetchSitios()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Sitios Maestro" subtitle="Sitios de entrega (IDs de la base de suministro)" />
        <div className="page-content">
          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por ID, institución, localidad, barrio..."
              />
            </div>
            <button className="btn-primary" onClick={openAddModal}>➕ Agregar Sitio</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando sitios...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{sitios.length === 0 ? 'No hay sitios cargados todavía.' : 'No hay sitios que coincidan con la búsqueda.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Institución</th>
                    <th>Localidad / Barrio</th>
                    <th>Jornada / Horario</th>
                    <th>Dirección</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sitio => (
                    <tr key={sitio.id}>
                      <td>{sitio.id_sitio_entrega}</td>
                      <td>
                        <div className="product-row-nombre">{sitio.nombre_institucion}</div>
                        <div className="product-row-empaque">
                          {[sitio.sede_educativa && `Sede ${sitio.sede_educativa}`, sitio.nombre_descripcion].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td>
                        {sitio.localidad || '—'}
                        <div className="product-row-empaque">{sitio.barrio || ''}</div>
                      </td>
                      <td>
                        {sitio.jornada || '—'}
                        <div className="product-row-empaque">{sitio.horario_sugerido || ''}</div>
                      </td>
                      <td>{sitio.direccion || '—'}</td>
                      <td>
                        <label className="switch" title={sitio.activo ? 'Activo' : 'Inactivo'}>
                          <input type="checkbox" checked={sitio.activo} onChange={() => handleToggleActivo(sitio)} />
                          <span className="switch-slider"></span>
                        </label>
                      </td>
                      <td>
                        <div className="product-row-actions">
                          <button className="icon-btn" title="Editar" onClick={() => openEditModal(sitio)}>✏️</button>
                          <button className="icon-btn danger" title="Eliminar" onClick={() => handleDelete(sitio)}>🗑️</button>
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
        <SitioModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? modalState.sitio : null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </div>
  )
}
