'use client'

import { useMemo, useState } from 'react'
import { MESES, nombreMes } from '../lib/parseRutasExcel'

export default function RutaPreviewModal({ data, archivoNombre, mesDetectado, rutas, sitiosById, onCancel, onConfirm, saving }) {
  const [mes, setMes] = useState(mesDetectado?.mes ?? '')
  const [año, setAño] = useState(mesDetectado?.año ?? '')

  const necesitaSeleccion = !mesDetectado
  const mesNum = mes ? Number(mes) : null
  const añoNum = año ? Number(año) : null
  const nombreMesActual = mesNum && añoNum ? nombreMes(mesNum, añoNum) : null

  const existingRuta = useMemo(() => {
    if (!mesNum || !añoNum) return null
    return rutas.find(r => r.mes === mesNum && r.año === añoNum) || null
  }, [rutas, mesNum, añoNum])

  const idsFaltantes = useMemo(() => {
    const set = new Set()
    for (const a of data.asignaciones) {
      if (!sitiosById.has(a.id_sitio_entrega)) set.add(a.id_sitio_entrega)
    }
    return Array.from(set).sort((x, y) => x - y)
  }, [data.asignaciones, sitiosById])

  const puedeConfirmar = Boolean(mesNum && añoNum) && !saving

  function handleConfirm() {
    if (!puedeConfirmar) return
    onConfirm({ mes: mesNum, año: añoNum, nombreMes: nombreMesActual, existingRuta })
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Vista previa: {nombreMesActual || 'selecciona el mes'}</div>

        {necesitaSeleccion && (
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
        )}

        {existingRuta && (
          <p className="modal-hint modal-hint-warning">Este mes ya está cargado. ¿Reemplazar?</p>
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
          <button className="btn-primary" onClick={handleConfirm} disabled={!puedeConfirmar}>
            {saving ? 'Guardando...' : 'Confirmar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
