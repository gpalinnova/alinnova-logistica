'use client'

import { formatFechaLarga } from '../lib/tablaWhatsappUtils'

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function BaseSuministroDetalleModal({ fecha, filas, sitiosById, loading, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Detalle: {capitalize(formatFechaLarga(fecha))}</div>

        {loading ? (
          <div className="empty-state"><p>Cargando base de suministro...</p></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Institución</th>
                  <th>Localidad</th>
                  <th>Jornada</th>
                  <th>Horario</th>
                  <th>A</th>
                  <th>B</th>
                  <th>C</th>
                  <th>D</th>
                  <th>Muestras</th>
                  <th>Total</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => {
                  const sitio = sitiosById.get(f.id_sitio_entrega)
                  return (
                    <tr key={f.id} className={f.observacion ? 'row-novedad' : ''}>
                      <td>{f.id_sitio_entrega}</td>
                      <td>{sitio ? sitio.nombre_institucion : `ID ${f.id_sitio_entrega} no encontrado`}</td>
                      <td>{sitio?.localidad || '-'}</td>
                      <td>{sitio?.jornada || '-'}</td>
                      <td>{sitio?.horario_sugerido || '-'}</td>
                      <td>{f.tipo_a}</td>
                      <td>{f.tipo_b}</td>
                      <td>{f.tipo_c}</td>
                      <td>{f.tipo_d}</td>
                      <td>{f.muestra_tipo_1 + f.muestra_tipo_2}</td>
                      <td>{f.total}</td>
                      <td>{f.observacion || '-'}</td>
                    </tr>
                  )
                })}
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
