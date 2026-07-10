'use client'

import { useState } from 'react'

export default function RepartidorModal({ mode, initialData, onClose, onSubmit, saving }) {
  const [conductor, setConductor] = useState(initialData?.conductor || '')
  const [auxiliar, setAuxiliar] = useState(initialData?.auxiliar || '')
  const [placa, setPlaca] = useState(initialData?.placa || '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!conductor.trim()) {
      setError('El nombre del conductor es obligatorio')
      return
    }
    if (!auxiliar.trim()) {
      setError('El nombre del auxiliar es obligatorio')
      return
    }
    if (!placa.trim()) {
      setError('La placa es obligatoria')
      return
    }
    setError('')
    onSubmit({
      conductor: conductor.trim(),
      auxiliar: auxiliar.trim(),
      placa: placa.trim().toUpperCase(),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'edit' ? 'Editar Repartidor' : 'Agregar Repartidor'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Conductor</label>
            <input type="text" value={conductor} onChange={e => setConductor(e.target.value)} placeholder="Nombre del conductor" />
          </div>

          <div className="form-group">
            <label>Auxiliar</label>
            <input type="text" value={auxiliar} onChange={e => setAuxiliar(e.target.value)} placeholder="Nombre del auxiliar" />
          </div>

          <div className="form-group">
            <label>Placa</label>
            <input type="text" value={placa} onChange={e => setPlaca(e.target.value)} placeholder="Ej: ABC123" />
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
