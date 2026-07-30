'use client'

import { useState } from 'react'
import { MESES } from '../lib/parseRutasExcel'

export default function MesAnioModal({ onCancel, onContinuar }) {
  const [mes, setMes] = useState('')
  const [año, setAño] = useState(String(new Date().getFullYear()))

  const puedeContinuar = Boolean(mes) && Boolean(año)

  function handleContinuar() {
    if (!puedeContinuar) return
    onContinuar({ mes: Number(mes), año: Number(año) })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📅 ¿A qué mes pertenece esta ruta?</div>
        <div className="form-grid-2">
          <div className="form-group">
            <label>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}>
              <option value="">Selecciona...</option>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Año</label>
            <input type="number" value={año} onChange={e => setAño(e.target.value)} placeholder="Ej: 2026" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={handleContinuar} disabled={!puedeContinuar}>Continuar</button>
        </div>
      </div>
    </div>
  )
}
