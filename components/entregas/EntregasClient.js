'use client'

import { useEffect, useState } from 'react'
import ListaColegios from './ListaColegios'
import ResumenDiaButton from './ResumenDiaButton'

const STORAGE_KEY = 'registro_conductor_seleccionado'
const VIGENCIA_MS = 24 * 60 * 60 * 1000

function leerSeleccionGuardada(idsValidos) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { id, ts } = JSON.parse(raw)
    if (!id || !ts) return null
    if (Date.now() - ts > VIGENCIA_MS) return null
    if (!idsValidos.includes(id)) return null
    return id
  } catch {
    return null
  }
}

export default function EntregasClient({ fecha, conductores, colegiosPorConductor }) {
  const [seleccionado, setSeleccionado] = useState(null)
  const [pickerValue, setPickerValue] = useState('')

  useEffect(() => {
    const idsValidos = conductores.map(c => c.id)
    const guardado = leerSeleccionGuardada(idsValidos)
    if (guardado) setSeleccionado(guardado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function elegirConductor(id) {
    setSeleccionado(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, ts: Date.now() }))
    } catch {}
  }

  function cambiarConductor() {
    setSeleccionado(null)
    setPickerValue('')
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  if (conductores.length === 0) {
    return <div className="empty-state"><p>No hay conductores con ruta asignada hoy.</p></div>
  }

  if (!seleccionado) {
    return (
      <div className="registro-selector-conductor">
        <div className="registro-selector-titulo">¿Quién eres?</div>
        <select
          className="registro-selector-select"
          value={pickerValue}
          onChange={e => setPickerValue(e.target.value)}
        >
          <option value="">Selecciona tu nombre</option>
          {conductores.map(c => (
            <option key={c.id} value={c.id}>
              {c.conductor}{c.placa ? ` · ${c.placa}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary entregas-form-btn-wide"
          disabled={!pickerValue}
          onClick={() => elegirConductor(pickerValue)}
        >
          ✅ Continuar
        </button>
      </div>
    )
  }

  const conductor = conductores.find(c => c.id === seleccionado)
  const colegios = colegiosPorConductor[seleccionado] || []
  const totalColegios = colegios.length
  const entregados = colegios.filter(c => c.registro).length
  const rutaCompletada = totalColegios > 0 && entregados === totalColegios
  const progresoPct = totalColegios > 0 ? Math.round((entregados / totalColegios) * 100) : 0

  return (
    <>
      <div className="entregas-public-meta">
        <div><strong>Conductor:</strong> {conductor?.conductor || '-'}</div>
        <div><strong>Placa:</strong> {conductor?.placa || '-'}</div>
        {conductor?.auxiliar && <div><strong>Auxiliar:</strong> {conductor.auxiliar}</div>}
      </div>

      <button type="button" className="btn-secondary registro-cambiar-conductor" onClick={cambiarConductor}>
        🔄 Cambiar conductor
      </button>

      {totalColegios === 0 ? (
        <div className="empty-state"><p>No hay colegios asignados con envío para esta fecha.</p></div>
      ) : (
        <>
          <div className="entregas-progreso">
            <div className="entregas-progreso-texto">{entregados} de {totalColegios} entregados</div>
            <div className="entregas-progreso-bar">
              <div className="entregas-progreso-bar-fill" style={{ width: `${progresoPct}%` }} />
            </div>
          </div>

          <ListaColegios
            colegios={colegios}
            fecha={fecha}
            idRuta={seleccionado}
            nombreConductor={conductor.conductor}
          />

          {rutaCompletada && (
            <div className="entregas-completada">
              <div className="entregas-completada-emoji">🎉</div>
              <div className="entregas-completada-texto">Ruta completada</div>
              <ResumenDiaButton colegios={colegios} conductor={conductor.conductor} fecha={fecha} />
            </div>
          )}
        </>
      )}
    </>
  )
}
