'use client'

export default function RutaDetalleModal({ ruta, asignaciones, sitiosById, loading, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Detalle: {ruta.nombre_mes}</div>

        {loading ? (
          <div className="empty-state"><p>Cargando asignaciones...</p></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Placa</th>
                  <th>Auxiliar</th>
                  <th>Institución</th>
                  <th>Dirección</th>
                  <th>Localidad</th>
                  <th>Orden</th>
                  <th>Cargue</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map(a => {
                  const sitio = sitiosById.get(a.id_sitio_entrega)
                  return (
                    <tr key={a.id}>
                      <td>{a.repartidor?.conductor || '-'}</td>
                      <td>{a.repartidor?.placa || '-'}</td>
                      <td>{a.repartidor?.auxiliar || '-'}</td>
                      <td>{sitio ? sitio.nombre_institucion : `ID ${a.id_sitio_entrega} no encontrado`}</td>
                      <td>{sitio?.direccion || '-'}</td>
                      <td>{sitio?.localidad || '-'}</td>
                      <td>{a.orden_entrega}</td>
                      <td>{a.cargue_alinnova || '-'}</td>
                      <td>{a.horario_entrega_alinnova || '-'}</td>
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
