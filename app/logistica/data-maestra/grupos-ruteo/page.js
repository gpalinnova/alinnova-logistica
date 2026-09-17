'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import LogisticaGrupoRuteoModal from '../../../../components/LogisticaGrupoRuteoModal'
import { supabase } from '../../../../lib/supabase'

export default function GruposRuteoPage() {
  const [grupos, setGrupos] = useState([])
  const [subzonas, setSubzonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [modalGrupo, setModalGrupo] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [gruposRes, subzonasRes] = await Promise.all([
      supabase.from('logistica_grupos_ruteo').select('*').order('orden'),
      supabase.from('logistica_subzonas').select('*').order('orden_dentro_grupo'),
    ])
    if (gruposRes.error || subzonasRes.error) {
      setErrorMsg('No se pudieron cargar los grupos de ruteo.')
    } else {
      setGrupos(gruposRes.data || [])
      setSubzonas(subzonasRes.data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const subzonasPorGrupo = useMemo(() => {
    const map = new Map()
    for (const s of subzonas) {
      if (!map.has(s.grupo_ruteo_codigo)) map.set(s.grupo_ruteo_codigo, [])
      map.get(s.grupo_ruteo_codigo).push(s)
    }
    return map
  }, [subzonas])

  function abrirEditar(grupo) {
    setModalGrupo({ grupo, subzonas: subzonasPorGrupo.get(grupo.codigo) || [] })
  }
  function cerrarModal() {
    if (saving) return
    setModalGrupo(null)
  }

  async function handleGuardar(payload) {
    setSaving(true)
    try {
      const { error } = await supabase.from('logistica_grupos_ruteo')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('codigo', modalGrupo.grupo.codigo)
      if (error) throw error
      await fetchAll()
      setModalGrupo(null)
      setToast({ message: 'Grupo de ruteo actualizado correctamente.', type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo guardar el grupo de ruteo.')
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
          title="🗺️ Grupos de Ruteo"
          subtitle="Localidades y umbrales de partición de rutas — Logística"
        />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando grupos de ruteo...</p></div>
          ) : grupos.length === 0 ? (
            <div className="empty-state"><p>No hay grupos de ruteo cargados todavía.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre visible</th>
                    <th>Prefijo de ruta</th>
                    <th>Max subzonas</th>
                    <th>Subzonas asociadas</th>
                    <th>Carro dedicado</th>
                    <th>Destino fijo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => (
                    <tr key={g.codigo}>
                      <td className="logistica-mono">{g.codigo}</td>
                      <td>{g.nombre_mostrar}</td>
                      <td>{g.prefijo_ruta}</td>
                      <td>{g.max_subzonas}</td>
                      <td>{(subzonasPorGrupo.get(g.codigo) || []).length}</td>
                      <td>
                        <span className={`badge ${g.carro_dedicado ? 'badge-activo' : 'badge-info'}`}>
                          {g.carro_dedicado ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td>{g.destino_fijo || <span className="logistica-muted">—</span>}</td>
                      <td>
                        <span className={`badge ${g.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                          {g.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-secondary" onClick={() => abrirEditar(g)}>✏️ Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {modalGrupo && (
        <LogisticaGrupoRuteoModal
          grupo={modalGrupo.grupo}
          subzonasDelGrupo={modalGrupo.subzonas}
          saving={saving}
          onClose={cerrarModal}
          onGuardar={handleGuardar}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
