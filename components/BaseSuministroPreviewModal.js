'use client'

import { useMemo, useState } from 'react'
import { formatFechaLarga } from '../lib/tablaWhatsappUtils'

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function BaseSuministroPreviewModal({ data, archivoNombre, fechaDetectada, basesExistentes, sitiosById, onCancel, onConfirm, saving }) {
  const [fecha, setFecha] = useState(fechaDetectada || '')

  const necesitaSeleccion = !fechaDetectada
  const existingBase = fecha ? basesExistentes.get(fecha) : null

  const stats = useMemo(() => {
    let total = 0, tipo1 = 0, tipo2 = 0, muestras = 0
    for (const f of data.filas) {
      const t = f.tipo_a + f.tipo_b + f.tipo_c + f.tipo_d + f.muestra_tipo_1 + f.muestra_tipo_2
      total += t
      tipo1 += f.tipo_a + f.tipo_b + f.muestra_tipo_1
      tipo2 += f.tipo_c + f.tipo_d + f.muestra_tipo_2
      muestras += f.muestra_tipo_1 + f.muestra_tipo_2
    }
    return { sitios: data.filas.length, total, tipo1, tipo2, muestras }
  }, [data.filas])

  const idsNuevos = useMemo(() => {
    const set = new Set()
    for (const f of data.filas) {
      if (!sitiosById.has(f.id_sitio_entrega)) set.add(f.id_sitio_entrega)
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [data.filas, sitiosById])

  const puedeConfirmar = Boolean(fecha) && !saving

  function handleConfirm() {
    if (!puedeConfirmar) return
    onConfirm({ fecha })
  }

  const fechaTitulo = fecha ? capitalize(formatFechaLarga(fecha)) : 'selecciona la fecha'

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Vista previa: {fechaTitulo}</div>

        {necesitaSeleccion && (
          <div className="form-group">
            <label>Fecha de la base de suministro</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        )}

        <div className="bs-stats-grid">
          <div className="bs-stat">
            <div className="bs-stat-value">{stats.sitios}</div>
            <div className="bs-stat-label">Sitios</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-value">{stats.total.toLocaleString('es-CO')}</div>
            <div className="bs-stat-label">Unidades totales</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-value">{stats.tipo1.toLocaleString('es-CO')}</div>
            <div className="bs-stat-label">Tipo 1</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-value">{stats.tipo2.toLocaleString('es-CO')}</div>
            <div className="bs-stat-label">Tipo 2</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-value">{stats.muestras.toLocaleString('es-CO')}</div>
            <div className="bs-stat-label">Muestras</div>
          </div>
        </div>

        {idsNuevos.length > 0 && (
          <p className="modal-hint">
            📍 Sitios nuevos detectados: {idsNuevos.join(', ')}. Se agregarán automáticamente a Sitios Maestro.
          </p>
        )}

        {existingBase && (
          <p className="modal-hint modal-hint-warning">
            Ya existe base de suministro para esta fecha. ¿Deseas reemplazarla?
          </p>
        )}

        <div className="section-label">Sitios detectados</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Institución</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>D</th>
                <th>Muestras</th>
                <th>Total</th>
                <th>Novedad</th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map(f => (
                <tr key={f.id_sitio_entrega} className={f.observacion ? 'row-novedad' : ''}>
                  <td>{f.id_sitio_entrega}</td>
                  <td>{f.nombre_institucion || '-'}</td>
                  <td>{f.tipo_a}</td>
                  <td>{f.tipo_b}</td>
                  <td>{f.tipo_c}</td>
                  <td>{f.tipo_d}</td>
                  <td>{f.muestra_tipo_1 + f.muestra_tipo_2}</td>
                  <td>{f.tipo_a + f.tipo_b + f.tipo_c + f.tipo_d + f.muestra_tipo_1 + f.muestra_tipo_2}</td>
                  <td>{f.observacion || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="modal-table-footer">
          Total: {stats.sitios} sitios — {stats.total.toLocaleString('es-CO')} unidades · Archivo: {archivoNombre}
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={!puedeConfirmar}>
            {saving ? 'Guardando...' : existingBase ? 'Reemplazar y Guardar' : 'Confirmar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
