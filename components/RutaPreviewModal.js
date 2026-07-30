'use client'

import { useMemo } from 'react'
import { nombreMes } from '../lib/parseRutasExcel'

export default function RutaPreviewModal({ data, archivoNombre, mes, año, rutas, sitiosById, onCancel, onConfirm, saving }) {
  const nombreMesActual = nombreMes(mes, año)

  const versionesExistentes = useMemo(
    () => rutas.filter(r => r.mes === mes && r.año === año),
    [rutas, mes, año]
  )
  const siguienteVersion = versionesExistentes.length > 0
    ? Math.max(...versionesExistentes.map(r => r.version)) + 1
    : 1

  const idsFaltantes = useMemo(() => {
    const set = new Set()
    for (const a of data.asignaciones) {
      if (!sitiosById.has(a.id_sitio_entrega)) set.add(a.id_sitio_entrega)
    }
    return Array.from(set).sort((x, y) => x - y)
  }, [data.asignaciones, sitiosById])

  function handleConfirm() {
    if (saving) return
    onConfirm({ mes, año })
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Vista previa: {nombreMesActual}</div>

        {versionesExistentes.length > 0 && (
          <p className="modal-hint modal-hint-warning">
            Ya existe{versionesExistentes.length > 1 ? `n ${versionesExistentes.length} versiones` : ' 1 versión'} de {nombreMesActual}. Esta se guardará como una nueva versión (v{siguienteVersion}) sin borrar las anteriores.
          </p>
        )}

        {idsFaltantes.length > 0 && (
          <p className="modal-hint modal-hint-warning">
            Los siguientes IDs no están en Sitios Maestro y no se guardarán: {idsFaltantes.join(', ')}. Cárgalos primero en Sitios Maestro.
          </p>
        )}

        <div className="section-label">Repartidores detectados</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Placa</th>
                <th>Auxiliar</th>
              </tr>
            </thead>
            <tbody>
              {data.repartidores.map(r => (
                <tr key={`${r.conductor}||${r.placa}`}>
                  <td>{r.conductor}</td>
                  <td>{r.placa}</td>
                  <td>{r.auxiliar || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-label">Asignaciones</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Conductor</th>
                <th>Placa</th>
                <th>Sitio</th>
                <th>Orden</th>
                <th>Cargue</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {data.asignaciones.map((a, i) => {
                const sitio = sitiosById.get(a.id_sitio_entrega)
                return (
                  <tr key={i} className={sitio ? '' : 'row-festivo'}>
                    <td>{a.conductor}</td>
                    <td>{a.placa}</td>
                    <td>{sitio ? sitio.nombre_institucion : `ID ${a.id_sitio_entrega} no encontrado`}</td>
                    <td>{a.orden_entrega}</td>
                    <td>{a.cargue_alinnova || '-'}</td>
                    <td>{a.horario_entrega_alinnova || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="modal-table-footer">
          Total: {data.repartidores.length} repartidores — {data.asignaciones.length} asignaciones · Archivo: {archivoNombre}
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
