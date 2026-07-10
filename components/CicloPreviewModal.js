'use client'

import { formatFechaDisplay, titleCase } from '../lib/cicloUtils'

export default function CicloPreviewModal({ data, archivoNombre, existingCiclo, onCancel, onConfirm, saving }) {
  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Vista previa: {data.nombreMes}</div>

        {existingCiclo && (
          <p className="modal-hint modal-hint-warning">
            Este mes ya está cargado. ¿Deseas reemplazarlo?
          </p>
        )}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Menú</th>
                <th>Bebida</th>
                <th>Proteico</th>
                <th>Postre</th>
                <th>Fruta</th>
              </tr>
            </thead>
            <tbody>
              {data.dias.map(d => (
                <tr key={d.fecha} className={d.festivo ? 'row-festivo' : ''}>
                  <td>{formatFechaDisplay(d.fecha)}</td>
                  <td>{titleCase(d.dia_semana)}</td>
                  {d.festivo ? (
                    <td colSpan={5}>FESTIVO</td>
                  ) : (
                    <>
                      <td>{d.menu_numero ?? '-'}</td>
                      <td>{d.bebida_uht || '-'}</td>
                      <td>{d.proteico || '-'}</td>
                      <td>{d.postre || '-'}</td>
                      <td>{d.fruta || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="modal-table-footer">
          Total: {data.dias.length} días — {data.semanas} semana{data.semanas === 1 ? '' : 's'} · Archivo: {archivoNombre}
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
