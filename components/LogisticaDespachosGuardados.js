'use client'

import { useEffect, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import {
  listarDespachosGuardados, eliminarDespachoGuardado, fmtFechaHora, LINEA_DESPACHO_LABEL,
} from '../lib/logisticaDespachosGuardados'

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'panaderia', label: LINEA_DESPACHO_LABEL.panaderia },
  { key: 'gastronomia', label: LINEA_DESPACHO_LABEL.gastronomia },
]

// Lista de despachos guardados del wizard (paso 1), más reciente arriba.
// "Abrir" delega en el wizard, que carga el estado y lo lleva al paso 7.
export default function LogisticaDespachosGuardados({ onAbrir, abriendoId }) {
  const [despachos, setDespachos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setDespachos(await listarDespachosGuardados())
    } catch (err) {
      console.error('No se pudieron cargar los despachos guardados:', err)
      setError('No se pudieron cargar los despachos guardados.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function confirmarEliminar() {
    if (!porEliminar) return
    setEliminando(true)
    try {
      await eliminarDespachoGuardado(porEliminar.id)
      setDespachos(prev => prev.filter(d => d.id !== porEliminar.id))
      setPorEliminar(null)
    } catch (err) {
      console.error('No se pudo eliminar el despacho:', err)
      setError('No se pudo eliminar el despacho.')
      setPorEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  const visibles = despachos.filter(d => filtro === 'todas' || d.linea === filtro)

  return (
    <div style={{ marginTop: 24 }}>
      <h3>📂 Despachos guardados</h3>
      <div className="logistica-filter-tabs">
        {FILTROS.map(f => (
          <button key={f.key} className={`logistica-filter-tab ${filtro === f.key ? 'active' : ''}`} onClick={() => setFiltro(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="form-error-banner">{error}</div>}
      {cargando ? (
        <div className="empty-state"><p>Cargando despachos guardados...</p></div>
      ) : !visibles.length ? (
        <div className="empty-state"><p>No hay despachos guardados{filtro !== 'todas' ? ' de esta línea' : ''}.</p></div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Línea</th>
                <th>OCs</th>
                <th>Rutas</th>
                <th>Creado</th>
                <th>Última modificación</th>
                <th>Novedades</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(d => {
                const r = d.resumen || {}
                return (
                  <tr key={d.id}>
                    <td><b>{d.nombre}</b></td>
                    <td>{LINEA_DESPACHO_LABEL[d.linea] || d.linea}</td>
                    <td className="logistica-mono">{(r.ocs || []).join(', ') || '—'}</td>
                    <td>{r.numRutas ?? '—'}</td>
                    <td>{fmtFechaHora(d.created_at)}</td>
                    <td>{fmtFechaHora(d.updated_at)}</td>
                    <td>{r.numNovedades ?? 0}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-primary" disabled={Boolean(abriendoId)} onClick={() => onAbrir(d.id)}>
                        {abriendoId === d.id ? 'Abriendo...' : '📂 Abrir'}
                      </button>{' '}
                      <button className="btn-danger" disabled={Boolean(abriendoId)} onClick={() => setPorEliminar(d)}>🗑 Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {porEliminar && (
        <ConfirmModal
          title="Eliminar despacho guardado"
          message={`¿Eliminar "${porEliminar.nombre}"? Se pierde el despacho guardado y su historial de novedades. Esta acción no se puede deshacer.`}
          confirmLabel="🗑 Eliminar"
          danger
          loading={eliminando}
          onConfirm={confirmarEliminar}
          onCancel={() => setPorEliminar(null)}
        />
      )}
    </div>
  )
}
