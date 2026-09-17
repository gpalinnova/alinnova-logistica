'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import LogisticaSubzonaModal from '../../../../components/LogisticaSubzonaModal'
import { supabase } from '../../../../lib/supabase'

export default function SubzonasPage() {
  const [subzonas, setSubzonas] = useState([])
  const [grupos, setGrupos] = useState([])
  const [conteoSitios, setConteoSitios] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [subzonasRes, gruposRes, sitiosRes] = await Promise.all([
      supabase.from('logistica_subzonas').select('*').order('grupo_ruteo_codigo').order('orden_dentro_grupo'),
      supabase.from('logistica_grupos_ruteo').select('codigo, nombre_mostrar, activo').order('orden'),
      supabase.from('logistica_sitios').select('subzona_codigo').not('subzona_codigo', 'is', null),
    ])
    if (subzonasRes.error || gruposRes.error || sitiosRes.error) {
      setErrorMsg('No se pudieron cargar las subzonas.')
    } else {
      setSubzonas(subzonasRes.data || [])
      setGrupos(gruposRes.data || [])
      const conteo = {}
      for (const s of sitiosRes.data || []) {
        conteo[s.subzona_codigo] = (conteo[s.subzona_codigo] || 0) + 1
      }
      setConteoSitios(conteo)
      setErrorMsg('')
    }
    setLoading(false)
  }

  const gruposPorCodigo = useMemo(() => new Map(grupos.map(g => [g.codigo, g])), [grupos])

  function abrirNueva() { setModalState({ mode: 'add' }) }
  function abrirEditar(subzona) { setModalState({ mode: 'edit', subzona }) }
  function cerrarModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleGuardar(payload) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        const { error } = await supabase.from('logistica_subzonas').insert([payload])
        if (error) throw error
        setToast({ message: 'Subzona creada correctamente.', type: 'success' })
      } else {
        const { error } = await supabase.from('logistica_subzonas')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('codigo', modalState.subzona.codigo)
        if (error) throw error
        setToast({ message: 'Subzona actualizada correctamente.', type: 'success' })
      }
      await fetchAll()
      setModalState(null)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.code === '23505' ? 'Ya existe una subzona con ese código.' : 'No se pudo guardar la subzona.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(subzona) {
    setSaving(true)
    try {
      const { error } = await supabase.from('logistica_subzonas').delete().eq('codigo', subzona.codigo)
      if (error) throw error
      await fetchAll()
      setModalState(null)
      setToast({ message: 'Subzona eliminada.', type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo eliminar la subzona.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="📍 Subzonas"
          subtitle="Subzonas geográficas dentro de cada grupo de ruteo — Logística"
        />
        <div className="page-content">
          <div className="page-toolbar spread">
            <button className="btn-primary" onClick={abrirNueva}>➕ Nueva subzona</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando subzonas...</p></div>
          ) : subzonas.length === 0 ? (
            <div className="empty-state"><p>No hay subzonas cargadas todavía.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre visible</th>
                    <th>Grupo de ruteo</th>
                    <th>Orden</th>
                    <th>Sitios asignados</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {subzonas.map(s => (
                    <tr key={s.codigo}>
                      <td className="logistica-mono">{s.codigo}</td>
                      <td>{s.nombre_mostrar}</td>
                      <td>{gruposPorCodigo.get(s.grupo_ruteo_codigo)?.nombre_mostrar || s.grupo_ruteo_codigo}</td>
                      <td>{s.orden_dentro_grupo}</td>
                      <td>{conteoSitios[s.codigo] || 0}</td>
                      <td>
                        <span className={`badge ${s.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                          {s.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-secondary" onClick={() => abrirEditar(s)}>✏️ Editar</button>
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
        <LogisticaSubzonaModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? modalState.subzona : null}
          grupos={grupos}
          sitiosAsignados={modalState.mode === 'edit' ? (conteoSitios[modalState.subzona.codigo] || 0) : 0}
          saving={saving}
          onClose={cerrarModal}
          onSubmit={handleGuardar}
          onEliminar={handleEliminar}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
