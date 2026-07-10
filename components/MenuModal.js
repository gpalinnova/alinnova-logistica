'use client'

import { useState } from 'react'

const COMPONENTES = [
  { key: 'bebida_uht', label: 'Bebida UHT', componente: 'BEBIDA UHT', emoji: '🥛' },
  { key: 'agua', label: 'Agua', componente: 'AGUA', emoji: '💧' },
  { key: 'proteico', label: 'Proteico', componente: 'PROTEICO', emoji: '🥪' },
  { key: 'postre', label: 'Postre', componente: 'POSTRE', emoji: '🍮' },
  { key: 'fruta', label: 'Fruta', componente: 'FRUTA', emoji: '🍎' },
]

export default function MenuModal({ menu, productosByComponente, onClose, onSubmit, saving }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(COMPONENTES.map(c => [c.key, menu[c.key] || '']))
  )

  function handleChange(key, value) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(Object.fromEntries(COMPONENTES.map(c => [c.key, values[c.key] || null])))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Editar Menú {menu.numero}</div>
        <form onSubmit={handleSubmit}>
          {COMPONENTES.map(c => {
            const options = productosByComponente[c.componente] || []
            const current = values[c.key]
            const isKnownValue = !current || options.includes(current)
            return (
              <div className="form-group" key={c.key}>
                <label>{c.emoji} {c.label.toUpperCase()}</label>
                <select value={current} onChange={e => handleChange(c.key, e.target.value)}>
                  <option value="">— Sin definir —</option>
                  {!isKnownValue && <option value={current}>{current}</option>}
                  {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )
          })}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
