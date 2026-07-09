'use client'

import { useState } from 'react'

const COMPONENTE_OPTIONS = ['BEBIDA UHT', 'AGUA', 'PROTEICO', 'POSTRE', 'FRUTA']

export default function ProductoModal({ mode, initialData, onClose, onSubmit, saving }) {
  const [componente, setComponente] = useState(initialData?.componente || COMPONENTE_OPTIONS[0])
  const [nombre, setNombre] = useState(initialData?.nombre || '')
  const [empaqueTexto, setEmpaqueTexto] = useState(initialData?.empaque_texto || '')
  const [unidades, setUnidades] = useState(initialData?.unidades_por_canastilla ?? '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim() || !empaqueTexto.trim() || !unidades) {
      setError('Completa todos los campos')
      return
    }
    const unidadesNum = Number(unidades)
    if (!Number.isInteger(unidadesNum) || unidadesNum <= 0) {
      setError('Unidades por canastilla debe ser un número entero mayor a 0')
      return
    }
    setError('')
    onSubmit({
      componente,
      nombre: nombre.trim(),
      empaque_texto: empaqueTexto.trim(),
      unidades_por_canastilla: unidadesNum,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'edit' ? 'Editar Producto' : 'Agregar Producto'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Componente</label>
            <select value={componente} onChange={e => setComponente(e.target.value)} disabled={mode === 'edit'}>
              {COMPONENTE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Nombre</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Néctar de durazno" />
          </div>
          <div className="form-group">
            <label>Empaque</label>
            <input type="text" value={empaqueTexto} onChange={e => setEmpaqueTexto(e.target.value)} placeholder="Ej: CANASTILLA X 100 UNIDADES" />
          </div>
          <div className="form-group">
            <label>Unidades por canastilla</label>
            <input type="number" min="1" value={unidades} onChange={e => setUnidades(e.target.value)} />
          </div>
          {componente === 'PROTEICO' && mode === 'add' && (
            <p className="modal-hint">Se crearán automáticamente dos registros: TIPO 1 y TIPO 2.</p>
          )}
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
