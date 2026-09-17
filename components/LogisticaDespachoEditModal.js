'use client'

import { useState } from 'react'

const LINEA_OPCIONES = [
  { value: 'panaderia', label: 'Panadería' },
  { value: 'gastronomia', label: 'Gastronomía' },
]

export default function LogisticaDespachoEditModal({ despacho, saving, onClose, onGuardar }) {
  const [nombreRuta, setNombreRuta] = useState(despacho.nombre_ruta || '')
  const [conductorNombre, setConductorNombre] = useState(despacho.conductor_nombre || '')
  const [placa, setPlaca] = useState(despacho.placa || '')
  const [linea, setLinea] = useState(despacho.linea || 'panaderia')
  const [fechaDespacho, setFechaDespacho] = useState(despacho.fecha_despacho || '')
  const [fechaConsumo, setFechaConsumo] = useState(despacho.fecha_consumo || '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombreRuta.trim()) { setError('El nombre de la ruta es obligatorio.'); return }
    if (!fechaDespacho) { setError('La fecha de despacho es obligatoria.'); return }
    setError('')
    onGuardar({
      nombre_ruta: nombreRuta.trim(),
      conductor_nombre: conductorNombre.trim() || null,
      placa: placa.trim() || null,
      linea,
      fecha_despacho: fechaDespacho,
      fecha_consumo: fechaConsumo || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">✏️ Editar despacho</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre de la ruta</label>
            <input type="text" value={nombreRuta} onChange={e => setNombreRuta(e.target.value)} />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Fecha de despacho</label>
              <input type="date" value={fechaDespacho} onChange={e => setFechaDespacho(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha de consumo</label>
              <input type="date" value={fechaConsumo} onChange={e => setFechaConsumo(e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Línea</label>
              <select value={linea} onChange={e => setLinea(e.target.value)}>
                {LINEA_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Placa</label>
              <input type="text" value={placa} onChange={e => setPlaca(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Conductor</label>
            <input type="text" value={conductorNombre} onChange={e => setConductorNombre(e.target.value)} />
          </div>

          <div className="logistica-info-box">
            Los totales (sitios, unidades, canastillas) son un registro del despacho real y no se pueden editar aquí.
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
