'use client'

import { formatFechaDisplay, titleCase } from '../lib/cicloUtils'

export default function CicloDetalleModal({ ciclo, dias, loading, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Detalle: {ciclo.nombre_mes}</div>

        {loading ? (
          <div className="empty-state"><p>Cargando días...</p></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Día semana</th>
                  <th>Menú</th>
                  <th>Bebida</th>
                  <th>Agua</th>
                  <th>Proteico</th>
                  <th>Postre</th>
                  <th>Fruta</th>
                </tr>
              </thead>
              <tbody>
                {dias.map(d => (
                  <tr key={d.id} className={d.festivo ? 'row-festivo' : ''}>
                    <td>{formatFechaDisplay(d.fecha)}</td>
                    <td>{titleCase(d.dia_semana)}</td>
                    {d.festivo ? (
                      <td colSpan={6}>FESTIVO</td>
                    ) : (
                      <>
                        <td>{d.menu_numero ?? '-'}</td>
                        <td>{d.bebida_uht || '-'}</td>
                        <td>{d.agua || '-'}</td>
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
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
