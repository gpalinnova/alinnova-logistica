'use client'

import { useMemo } from 'react'
import { formatFechaDisplay, titleCase } from '../lib/cicloUtils'
import { COMPONENTES_CICLO } from '../lib/parseCicloExcel'

function limpiarTexto(texto) {
  return (texto || '').replace(/\s+/g, ' ').trim()
}

// Advertencia (no bloqueante) de un día sin menú en el Excel.
function advertenciaDia(dia) {
  if (dia.festivo) return null
  if (dia.menu_numero == null) return 'Sin menú detectado'
  return null
}

export default function CicloPreviewModal({ data, dias, fechasExistentes, archivoNombre, onCancel, onConfirm, saving }) {
  const advertencias = useMemo(
    () => new Map(dias.map(d => [d.fecha, advertenciaDia(d)])),
    [dias]
  )
  const totalAdvertencias = [...advertencias.values()].filter(Boolean).length
  const sobrescritas = dias.filter(d => fechasExistentes.has(d.fecha)).length
  const titulo = data.meses.length > 1 ? data.meses.map(m => m.nombreMes).join(' / ') : data.nombreMes

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Vista previa: {titulo}</div>

        <p className={`modal-hint${sobrescritas > 0 ? ' modal-hint-warning' : ''}`}>
          {sobrescritas > 0
            ? `${sobrescritas} de estas fechas ya estaban cargadas y se sobrescribirán. `
            : ''}
          Solo se guardan las fechas del archivo; las demás fechas del mes se conservan.
        </p>

        {totalAdvertencias > 0 && (
          <div className="rem-warning-list">
            <div className="rem-warning-list-title">⚠️ {totalAdvertencias} fecha{totalAdvertencias === 1 ? '' : 's'} con advertencia (puedes guardar igual)</div>
          </div>
        )}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Menú detectado</th>
                <th>Componentes</th>
              </tr>
            </thead>
            <tbody>
              {dias.map(d => {
                const advertencia = advertencias.get(d.fecha)
                return (
                  <tr key={d.fecha} className={d.festivo ? 'row-festivo' : ''}>
                    <td>
                      {formatFechaDisplay(d.fecha)}
                      {fechasExistentes.has(d.fecha) && (
                        <div><span className="badge logistica-badge-warning">Se sobrescribe</span></div>
                      )}
                    </td>
                    <td>{titleCase(d.dia_semana)}</td>
                    {d.festivo ? (
                      <td colSpan={2}>FESTIVO</td>
                    ) : (
                      <>
                        <td>{d.menu_numero != null ? `MENU ${d.menu_numero}` : 'Sin menú detectado'}</td>
                        <td>
                          {COMPONENTES_CICLO.map(c => limpiarTexto(d[c])).filter(Boolean).join(' · ') || '-'}
                          {advertencia && <div className="logistica-warning-text">⚠️ {advertencia}</div>}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="modal-table-footer">
          Total: {dias.length} fecha{dias.length === 1 ? '' : 's'} · Archivo: {archivoNombre}
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={onConfirm} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
