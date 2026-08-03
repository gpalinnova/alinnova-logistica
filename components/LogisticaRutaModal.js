'use client'

import { useState } from 'react'

export default function LogisticaRutaModal({ mode, initialData, onClose, onSubmit, saving }) {
  const [nombre, setNombre] = useState(initialData?.nombre || '')
  const [localidadPrincipal, setLocalidadPrincipal] = useState(initialData?.localidad_principal || '')
  const [placaVehiculo, setPlacaVehiculo] = useState(initialData?.placa_vehiculo || '')
  const [conductor, setConductor] = useState(initialData?.conductor || '')
  const [auxiliar, setAuxiliar] = useState(initialData?.auxiliar || '')
  const [activo, setActivo] = useState(initialData?.activo ?? true)
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) {
      setError('El nombre de la ruta es obligatorio')
      return
    }
    setError('')
    onSubmit({
      nombre: nombre.trim(),
      localidad_principal: localidadPrincipal.trim() || null,
      placa_vehiculo: placaVehiculo.trim() || null,
      conductor: conductor.trim() || null,
      auxiliar: auxiliar.trim() || null,
      activo,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'edit' ? 'Editar Ruta' : 'Nueva Ruta'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre de la ruta</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: H-BOSA - RICARDO SUAREZ" />
            <p className="modal-hint">Formato sugerido: "&lt;LOCALIDAD&gt; &lt;NUMERO&gt; - &lt;NOMBRE CONDUCTOR&gt;"</p>
          </div>

          <div className="form-group">
            <label>Localidad principal</label>
            <input type="text" value={localidadPrincipal} onChange={e => setLocalidadPrincipal(e.target.value)} placeholder="Ej: BOSA" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Placa vehículo</label>
              <input type="text" value={placaVehiculo} onChange={e => setPlacaVehiculo(e.target.value)} placeholder="Ej: WNM 832" />
            </div>
            <div className="form-group">
              <label>Conductor</label>
              <input type="text" value={conductor} onChange={e => setConductor(e.target.value)} placeholder="Ej: JUAN P NAVARRETE" />
            </div>
          </div>

          <div className="form-group">
            <label>Auxiliar</label>
            <input type="text" value={auxiliar} onChange={e => setAuxiliar(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Activa
            </label>
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
