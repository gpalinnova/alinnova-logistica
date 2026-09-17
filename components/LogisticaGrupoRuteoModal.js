'use client'

import { useRef, useState } from 'react'

const SENTINEL_MINIMO = 900

function buildInitialUmbrales(rawUmbrales) {
  return (Array.isArray(rawUmbrales) ? rawUmbrales : []).map((u, i) => {
    const asign = {}
    ;(u.asignaciones || []).forEach((ordenes, containerIdx) => {
      ordenes.forEach(orden => { asign[orden] = containerIdx })
    })
    return { key: `u-${i}`, maxSitios: String(u.max_sitios ?? ''), asign }
  })
}

export default function LogisticaGrupoRuteoModal({ grupo, subzonasDelGrupo, saving, onClose, onGuardar }) {
  const [nombreMostrar, setNombreMostrar] = useState(grupo.nombre_mostrar || '')
  const [prefijoRuta, setPrefijoRuta] = useState(grupo.prefijo_ruta || '')
  const [maxSubzonas, setMaxSubzonas] = useState(grupo.max_subzonas || 1)
  const [destinoFijo, setDestinoFijo] = useState(grupo.destino_fijo || '')
  const [carroDedicado, setCarroDedicado] = useState(Boolean(grupo.carro_dedicado))
  const [activo, setActivo] = useState(grupo.activo !== false)
  const [umbrales, setUmbrales] = useState(() => buildInitialUmbrales(grupo.umbrales))
  const [error, setError] = useState('')
  const tempCounter = useRef(0)

  const activeSubzonas = subzonasDelGrupo
    .filter(s => s.activo)
    .slice()
    .sort((a, b) => a.orden_dentro_grupo - b.orden_dentro_grupo)

  function handleMaxSubzonasChange(value) {
    const n = Math.max(1, parseInt(value, 10) || 1)
    setMaxSubzonas(n)
    setUmbrales(us => us.map(u => {
      const next = {}
      for (const [orden, idx] of Object.entries(u.asign)) {
        if (idx < n) next[orden] = idx
      }
      return { ...u, asign: next }
    }))
  }

  function toggleAsignacion(umbralKey, orden, containerIdx) {
    setUmbrales(us => us.map(u => {
      if (u.key !== umbralKey) return u
      const next = { ...u.asign }
      if (next[orden] === containerIdx) {
        delete next[orden]
      } else {
        next[orden] = containerIdx
      }
      return { ...u, asign: next }
    }))
  }

  function updateMaxSitios(key, value) {
    setUmbrales(us => us.map(u => (u.key === key ? { ...u, maxSitios: value } : u)))
  }

  function addUmbral() {
    tempCounter.current += 1
    setUmbrales(us => [...us, { key: `nuevo-${tempCounter.current}`, maxSitios: '', asign: {} }])
  }

  function removeUmbral(key) {
    setUmbrales(us => us.filter(u => u.key !== key))
  }

  function contarRutas(u) {
    const usados = new Set(Object.values(u.asign))
    return usados.size
  }

  function handleGuardarClick() {
    if (!nombreMostrar.trim()) { setError('El nombre visible es obligatorio.'); return }
    if (!prefijoRuta.trim()) { setError('El prefijo de ruta es obligatorio.'); return }
    if (umbrales.length === 0) { setError('Debe haber al menos un umbral.'); return }

    const parsed = umbrales.map(u => ({ ...u, maxNum: parseInt(u.maxSitios, 10) }))
    if (parsed.some(u => !Number.isInteger(u.maxNum) || u.maxNum <= 0)) {
      setError('Todos los umbrales deben tener un número de sitios válido, mayor a 0.')
      return
    }
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].maxNum <= parsed[i - 1].maxNum) {
        setError('Los umbrales deben estar ordenados de menor a mayor (por "hasta N sitios").')
        return
      }
    }
    const ultimo = parsed[parsed.length - 1]
    if (ultimo.maxNum < SENTINEL_MINIMO) {
      setError(`El último umbral debe cubrir cualquier cantidad de sitios (usa un valor grande, ej. 999). Actual: ${ultimo.maxNum}.`)
      return
    }

    const activeOrdenes = activeSubzonas.map(s => s.orden_dentro_grupo)
    for (const u of parsed) {
      const faltantes = activeOrdenes.filter(o => !(o in u.asign))
      if (faltantes.length > 0) {
        const nombres = activeSubzonas.filter(s => faltantes.includes(s.orden_dentro_grupo)).map(s => s.nombre_mostrar).join(', ')
        setError(`El umbral de hasta ${u.maxSitios} sitios no asigna todas las subzonas activas. Faltan: ${nombres}.`)
        return
      }
    }

    const umbralesJson = parsed.map(u => {
      const containers = []
      for (let idx = 0; idx < maxSubzonas; idx++) {
        const ordenes = activeOrdenes.filter(o => u.asign[o] === idx).sort((a, b) => a - b)
        if (ordenes.length > 0) containers.push(ordenes)
      }
      return { max_sitios: u.maxNum, asignaciones: containers }
    })

    setError('')
    onGuardar({
      nombre_mostrar: nombreMostrar.trim(),
      prefijo_ruta: prefijoRuta.trim(),
      max_subzonas: maxSubzonas,
      destino_fijo: destinoFijo.trim() || null,
      carro_dedicado: carroDedicado,
      activo,
      umbrales: umbralesJson,
    })
  }

  const containerRange = Array.from({ length: maxSubzonas }, (_, i) => i)

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-box modal-box-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Editar grupo de ruteo: {grupo.codigo}</div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Nombre visible</label>
            <input type="text" value={nombreMostrar} onChange={e => setNombreMostrar(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Prefijo de ruta</label>
            <input type="text" value={prefijoRuta} onChange={e => setPrefijoRuta(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Max subzonas (contenedores de ruta)</label>
            <input type="number" min="1" value={maxSubzonas} onChange={e => handleMaxSubzonasChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Destino fijo</label>
            <input type="text" value={destinoFijo} onChange={e => setDestinoFijo(e.target.value)} placeholder="Ej: CEDI Celta Park" />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={carroDedicado} onChange={e => setCarroDedicado(e.target.checked)} />
              Carro dedicado
            </label>
          </div>
          <div className="form-group">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Activo
            </label>
          </div>
        </div>

        <div className="section-label">Umbrales de partición</div>

        {activeSubzonas.length === 0 ? (
          <div className="logistica-warning-box">Este grupo no tiene subzonas activas. Actívalas en la pestaña Subzonas antes de configurar umbrales.</div>
        ) : (
          <>
            {umbrales.map(u => (
              <div key={u.key} className="ruta-edit-block">
                <div className="ruta-edit-block-header">
                  <div className="umbral-header-row">
                    <span>Si hay hasta</span>
                    <input
                      type="number"
                      min="1"
                      className="table-input umbral-max-input"
                      value={u.maxSitios}
                      onChange={e => updateMaxSitios(u.key, e.target.value)}
                    />
                    <span>sitios activos → generar <b>{contarRutas(u)}</b> ruta(s)</span>
                  </div>
                  <button className="btn-danger" onClick={() => removeUmbral(u.key)}>🗑️ Eliminar umbral</button>
                </div>

                <div className="umbral-chip-grid">
                  {activeSubzonas.map(s => {
                    const asignado = u.asign[s.orden_dentro_grupo]
                    return (
                      <div key={s.codigo} className={`umbral-chip${asignado != null ? ` umbral-chip-r${asignado % 4}` : ''}`}>
                        <span className="umbral-chip-name">{s.nombre_mostrar}</span>
                        <span className="umbral-chip-btns">
                          {containerRange.map(idx => (
                            <button
                              key={idx}
                              type="button"
                              className={`umbral-chip-btn${asignado === idx ? ` active umbral-chip-btn-r${idx % 4}` : ''}`}
                              title={`Asignar a Ruta ${prefijoRuta || grupo.prefijo_ruta} ${idx + 1}`}
                              onClick={() => toggleAsignacion(u.key, s.orden_dentro_grupo, idx)}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="umbral-containers">
                  {containerRange.map(idx => {
                    const chips = activeSubzonas.filter(s => u.asign[s.orden_dentro_grupo] === idx)
                    return (
                      <div key={idx} className="umbral-container">
                        <div className={`umbral-container-title umbral-chip-r${idx % 4}`}>
                          Ruta {prefijoRuta || grupo.prefijo_ruta} {idx + 1}
                        </div>
                        {chips.length === 0 ? (
                          <div className="umbral-container-empty">— vacío —</div>
                        ) : (
                          <div className="umbral-container-chips">
                            {chips.map(s => <span key={s.codigo} className="umbral-container-chip">{s.nombre_mostrar}</span>)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <button className="btn-secondary" onClick={addUmbral}>➕ Agregar umbral</button>
          </>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleGuardarClick} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}
