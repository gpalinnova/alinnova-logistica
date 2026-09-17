'use client'

import { useState } from 'react'

export default function LogisticaSubzonaModal({ mode, initialData, grupos, sitiosAsignados, saving, onClose, onSubmit, onEliminar }) {
  const isEdit = mode === 'edit'
  const [codigo, setCodigo] = useState(initialData?.codigo || '')
  const [nombreMostrar, setNombreMostrar] = useState(initialData?.nombre_mostrar || '')
  const [grupoRuteoCodigo, setGrupoRuteoCodigo] = useState(initialData?.grupo_ruteo_codigo || grupos[0]?.codigo || '')
  const [ordenDentroGrupo, setOrdenDentroGrupo] = useState(initialData?.orden_dentro_grupo ?? 1)
  const [activo, setActivo] = useState(initialData?.activo ?? true)
  const [error, setError] = useState('')
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!isEdit && !codigo.trim()) {
      setError('El código de la subzona es obligatorio.')
      return
    }
    if (!nombreMostrar.trim()) {
      setError('El nombre visible es obligatorio.')
      return
    }
    if (!grupoRuteoCodigo) {
      setError('Selecciona un grupo de ruteo.')
      return
    }
    const orden = parseInt(ordenDentroGrupo, 10)
    if (!Number.isInteger(orden) || orden <= 0) {
      setError('El orden dentro del grupo debe ser un número entero mayor a 0.')
      return
    }
    setError('')
    const payload = {
      nombre_mostrar: nombreMostrar.trim(),
      grupo_ruteo_codigo: grupoRuteoCodigo,
      orden_dentro_grupo: orden,
      activo,
    }
    if (!isEdit) payload.codigo = codigo.trim().toUpperCase()
    onSubmit(payload)
  }

  function handleEliminarClick() {
    if (sitiosAsignados > 0) return
    setConfirmandoEliminar(true)
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Editar subzona' : 'Nueva subzona'}</div>

        {confirmandoEliminar ? (
          <>
            <p className="modal-confirm-text">¿Eliminar la subzona {initialData?.nombre_mostrar}? Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmandoEliminar(false)} disabled={saving}>Cancelar</button>
              <button className="btn-danger-solid" onClick={() => onEliminar(initialData)} disabled={saving}>{saving ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Código</label>
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                disabled={isEdit}
                placeholder="Ej: BOSA_NORTE"
              />
            </div>

            <div className="form-group">
              <label>Nombre visible</label>
              <input type="text" value={nombreMostrar} onChange={e => setNombreMostrar(e.target.value)} placeholder="Ej: Bosa Norte" />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Grupo de ruteo</label>
                <select value={grupoRuteoCodigo} onChange={e => setGrupoRuteoCodigo(e.target.value)}>
                  {grupos.map(g => <option key={g.codigo} value={g.codigo}>{g.nombre_mostrar}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Orden dentro del grupo</label>
                <input type="number" min="1" value={ordenDentroGrupo} onChange={e => setOrdenDentroGrupo(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="logistica-checkbox-label">
                <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
                Activa
              </label>
            </div>

            {isEdit && sitiosAsignados > 0 && (
              <div className="logistica-warning-box">
                Tiene {sitiosAsignados} sitio(s) asignado(s). Reasígnalos antes de borrar.
              </div>
            )}

            {error && <p className="modal-error">{error}</p>}

            <div className="modal-actions" style={{ justifyContent: isEdit ? 'space-between' : 'flex-end' }}>
              {isEdit && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleEliminarClick}
                  disabled={saving || sitiosAsignados > 0}
                  title={sitiosAsignados > 0 ? 'Tiene sitios asignados. Reasígnalos antes de borrar.' : 'Eliminar subzona'}
                >
                  🗑️ Eliminar subzona
                </button>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear subzona'}</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
