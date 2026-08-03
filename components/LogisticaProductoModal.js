'use client'

import { useState } from 'react'

const MODALIDAD_OPTIONS = [
  { value: 'panaderia', label: '🥐 Panadería' },
  { value: 'am_pm', label: '☀️ AM-PM' },
  { value: 'gastronomia', label: '🍽️ Gastronomía' },
]

export default function LogisticaProductoModal({ mode, initialData, onClose, onSubmit, saving, familiasExistentes = [] }) {
  const [codigoArticulo, setCodigoArticulo] = useState(initialData?.codigo_articulo ?? '')
  const [nombre, setNombre] = useState(initialData?.nombre || '')
  const [nombreCorto, setNombreCorto] = useState(initialData?.nombre_corto || '')
  const [modalidad, setModalidad] = useState(initialData?.modalidad || MODALIDAD_OPTIONS[0].value)
  const [familiaProducto, setFamiliaProducto] = useState(initialData?.familia_producto || '')
  const [gramajeGr, setGramajeGr] = useState(initialData?.gramaje_gr ?? '')
  const [capacidadCanastilla, setCapacidadCanastilla] = useState(initialData?.capacidad_canastilla ?? 0)
  const [valorUnitario, setValorUnitario] = useState(initialData?.valor_unitario ?? 0)
  const [activo, setActivo] = useState(initialData?.activo ?? true)
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const codigoNum = Number(codigoArticulo)
    if (!codigoArticulo || !Number.isInteger(codigoNum) || codigoNum <= 0) {
      setError('El código de artículo debe ser un número entero mayor a 0')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre completo es obligatorio')
      return
    }
    if (!nombreCorto.trim()) {
      setError('El nombre corto es obligatorio')
      return
    }
    if (!MODALIDAD_OPTIONS.some(m => m.value === modalidad)) {
      setError('Selecciona una modalidad válida')
      return
    }
    if (!familiaProducto.trim()) {
      setError('La familia de producto es obligatoria')
      return
    }
    setError('')
    onSubmit({
      codigo_articulo: codigoNum,
      nombre: nombre.trim(),
      nombre_corto: nombreCorto.trim(),
      modalidad,
      familia_producto: familiaProducto.trim().toUpperCase(),
      gramaje_gr: gramajeGr === '' ? null : Number(gramajeGr),
      capacidad_canastilla: capacidadCanastilla === '' ? 0 : Number(capacidadCanastilla),
      valor_unitario: valorUnitario === '' ? 0 : Number(valorUnitario),
      activo,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'edit' ? 'Editar Producto' : 'Nuevo Producto'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Código artículo</label>
              <input
                type="number"
                min="1"
                value={codigoArticulo}
                onChange={e => setCodigoArticulo(e.target.value)}
                disabled={mode === 'edit'}
                placeholder="Ej: 29639020006"
              />
            </div>
            <div className="form-group">
              <label>Modalidad</label>
              <select value={modalidad} onChange={e => setModalidad(e.target.value)}>
                {MODALIDAD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nombre completo</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: PAN DE MAIZ 50G-UN" />
          </div>

          <div className="form-group">
            <label>Nombre corto</label>
            <input type="text" value={nombreCorto} onChange={e => setNombreCorto(e.target.value)} placeholder="Ej: Pan Maíz 50g" />
          </div>

          <div className="form-group">
            <label>Familia de producto</label>
            <input
              type="text"
              list="familias-producto-list"
              value={familiaProducto}
              onChange={e => setFamiliaProducto(e.target.value)}
              placeholder="Ej: PAN DE MAIZ"
            />
            <datalist id="familias-producto-list">
              {familiasExistentes.map(f => <option key={f} value={f} />)}
            </datalist>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Gramaje (g)</label>
              <input type="number" min="0" value={gramajeGr} onChange={e => setGramajeGr(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="form-group">
              <label>Capacidad canastilla</label>
              <input type="number" min="0" value={capacidadCanastilla} onChange={e => setCapacidadCanastilla(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Valor unitario ($)</label>
            <input type="number" min="0" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Activo
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
