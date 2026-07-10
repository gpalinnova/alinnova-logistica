'use client'

import { useEffect, useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal'

function toIntOrDefault(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function buildInitialBlocks(asignaciones) {
  const map = new Map()
  for (const a of asignaciones) {
    const rep = a.repartidor
    if (!rep) continue
    let block = map.get(rep.id)
    if (!block) {
      block = {
        key: rep.id,
        repartidorId: rep.id,
        isNewRepartidor: false,
        conductor: rep.conductor || '',
        auxiliar: rep.auxiliar || '',
        placa: rep.placa || '',
        deleted: false,
        duplicateWarning: '',
        addingSitio: false,
        draftSitio: null,
        _original: { conductor: rep.conductor || '', auxiliar: rep.auxiliar || '', placa: rep.placa || '' },
        asignaciones: [],
      }
      map.set(rep.id, block)
    }
    block.asignaciones.push({
      key: a.id,
      asignacionId: a.id,
      isNew: false,
      deleted: false,
      id_sitio_entrega: a.id_sitio_entrega,
      orden_entrega: a.orden_entrega,
      cargue_alinnova: a.cargue_alinnova || '',
      horario_entrega_alinnova: a.horario_entrega_alinnova || '',
      _original: {
        orden_entrega: a.orden_entrega,
        cargue_alinnova: a.cargue_alinnova || '',
        horario_entrega_alinnova: a.horario_entrega_alinnova || '',
      },
    })
  }
  const blocks = Array.from(map.values())
  for (const block of blocks) {
    block.asignaciones.sort((x, y) => (x.orden_entrega ?? 0) - (y.orden_entrega ?? 0))
  }
  return blocks
}

export default function RutaEditModal({ ruta, asignaciones, sitios, sitiosById, loading, saving, error, onClose, onGuardar, onCheckDuplicado }) {
  const [blocks, setBlocks] = useState([])
  const [addingRepartidor, setAddingRepartidor] = useState(false)
  const [nuevoRepartidor, setNuevoRepartidor] = useState({ conductor: '', auxiliar: '', placa: '' })
  const [confirmEliminarRepartidor, setConfirmEliminarRepartidor] = useState(null)
  const [pendingDiff, setPendingDiff] = useState(null)
  const [formError, setFormError] = useState('')
  const tempCounter = useRef(0)
  const prevSaving = useRef(saving)

  useEffect(() => {
    if (!loading) setBlocks(buildInitialBlocks(asignaciones))
  }, [loading, asignaciones])

  useEffect(() => {
    if (prevSaving.current && !saving) setPendingDiff(null)
    prevSaving.current = saving
  }, [saving])

  const sitiosActivos = sitios.filter(s => s.activo !== false)

  function nextTempKey(prefix) {
    tempCounter.current += 1
    return `${prefix}-${tempCounter.current}`
  }

  function updateBlockField(key, field, value) {
    setBlocks(bs => bs.map(b => (b.key === key ? { ...b, [field]: value } : b)))
  }

  async function checkDup(block) {
    if (!onCheckDuplicado || !block.conductor.trim() || !block.placa.trim()) return
    const isDup = await onCheckDuplicado(block.conductor.trim(), block.placa.trim().toUpperCase(), block.repartidorId)
    setBlocks(bs => bs.map(b => (b.key === block.key
      ? { ...b, duplicateWarning: isDup ? `Ya existe otro repartidor con conductor "${block.conductor}" y placa "${block.placa}".` : '' }
      : b)))
  }

  function toggleDeleteRepartidor(block) {
    if (block.deleted) {
      setBlocks(bs => bs.map(b => (b.key === block.key ? { ...b, deleted: false } : b)))
      return
    }
    if (block.isNewRepartidor) {
      setBlocks(bs => bs.filter(b => b.key !== block.key))
      return
    }
    setConfirmEliminarRepartidor(block)
  }

  function confirmarEliminarRepartidor() {
    const key = confirmEliminarRepartidor.key
    setBlocks(bs => bs.map(b => (b.key === key ? { ...b, deleted: true } : b)))
    setConfirmEliminarRepartidor(null)
  }

  function updateAsigField(blockKey, asigKey, field, value) {
    setBlocks(bs => bs.map(b => (b.key !== blockKey ? b : {
      ...b,
      asignaciones: b.asignaciones.map(a => (a.key === asigKey ? { ...a, [field]: value } : a)),
    })))
  }

  function toggleDeleteAsig(blockKey, asig) {
    setBlocks(bs => bs.map(b => {
      if (b.key !== blockKey) return b
      if (asig.deleted) {
        return { ...b, asignaciones: b.asignaciones.map(a => (a.key === asig.key ? { ...a, deleted: false } : a)) }
      }
      if (asig.isNew) {
        return { ...b, asignaciones: b.asignaciones.filter(a => a.key !== asig.key) }
      }
      return { ...b, asignaciones: b.asignaciones.map(a => (a.key === asig.key ? { ...a, deleted: true } : a)) }
    }))
  }

  function openAddSitio(blockKey) {
    setBlocks(bs => bs.map(b => (b.key === blockKey
      ? { ...b, addingSitio: true, draftSitio: { id_sitio_entrega: '', orden_entrega: String(b.asignaciones.filter(a => !a.deleted).length + 1), cargue_alinnova: '', horario_entrega_alinnova: '' } }
      : b)))
  }

  function cancelAddSitio(blockKey) {
    setBlocks(bs => bs.map(b => (b.key === blockKey ? { ...b, addingSitio: false, draftSitio: null } : b)))
  }

  function updateDraftSitio(blockKey, field, value) {
    setBlocks(bs => bs.map(b => (b.key === blockKey ? { ...b, draftSitio: { ...b.draftSitio, [field]: value } } : b)))
  }

  function confirmAddSitio(blockKey) {
    setFormError('')
    setBlocks(bs => bs.map(b => {
      if (b.key !== blockKey) return b
      const d = b.draftSitio
      if (!d.id_sitio_entrega) {
        setFormError('Selecciona un sitio para agregarlo al repartidor.')
        return b
      }
      const nuevaAsig = {
        key: nextTempKey('a'),
        asignacionId: null,
        isNew: true,
        deleted: false,
        id_sitio_entrega: Number(d.id_sitio_entrega),
        orden_entrega: toIntOrDefault(d.orden_entrega, b.asignaciones.filter(a => !a.deleted).length + 1),
        cargue_alinnova: d.cargue_alinnova || '',
        horario_entrega_alinnova: d.horario_entrega_alinnova || '',
      }
      return { ...b, addingSitio: false, draftSitio: null, asignaciones: [...b.asignaciones, nuevaAsig] }
    }))
  }

  function confirmAddRepartidor() {
    if (!nuevoRepartidor.conductor.trim() || !nuevoRepartidor.auxiliar.trim() || !nuevoRepartidor.placa.trim()) {
      setFormError('Conductor, Auxiliar y Placa son obligatorios para el nuevo repartidor.')
      return
    }
    const block = {
      key: nextTempKey('r'),
      repartidorId: null,
      isNewRepartidor: true,
      conductor: nuevoRepartidor.conductor.trim(),
      auxiliar: nuevoRepartidor.auxiliar.trim(),
      placa: nuevoRepartidor.placa.trim(),
      deleted: false,
      duplicateWarning: '',
      addingSitio: false,
      draftSitio: null,
      asignaciones: [],
    }
    setBlocks(bs => [...bs, block])
    setNuevoRepartidor({ conductor: '', auxiliar: '', placa: '' })
    setAddingRepartidor(false)
    setFormError('')
  }

  function buildDiff() {
    const repartidorInserts = []
    const repartidorUpdates = []
    const repartidorDeletes = []
    const asignacionInserts = []
    const asignacionUpdates = []
    const asignacionDeletes = []

    for (const b of blocks) {
      if (b.isNewRepartidor) {
        repartidorInserts.push({
          tempKey: b.key,
          conductor: b.conductor.trim(),
          auxiliar: b.auxiliar.trim(),
          placa: b.placa.trim().toUpperCase(),
          asignaciones: b.asignaciones.filter(a => !a.deleted).map(a => ({
            id_sitio_entrega: a.id_sitio_entrega,
            orden_entrega: toIntOrDefault(a.orden_entrega, 1),
            cargue_alinnova: a.cargue_alinnova || null,
            horario_entrega_alinnova: a.horario_entrega_alinnova || null,
          })),
        })
        continue
      }

      if (b.deleted) {
        repartidorDeletes.push({ id: b.repartidorId, conductor: b.conductor, placa: b.placa })
        for (const a of b.asignaciones) {
          if (!a.isNew) asignacionDeletes.push(a.asignacionId)
        }
        continue
      }

      if (b.conductor.trim() !== b._original.conductor || b.auxiliar.trim() !== b._original.auxiliar || b.placa.trim().toUpperCase() !== b._original.placa) {
        repartidorUpdates.push({ id: b.repartidorId, conductor: b.conductor.trim(), auxiliar: b.auxiliar.trim(), placa: b.placa.trim().toUpperCase() })
      }

      for (const a of b.asignaciones) {
        if (a.deleted) {
          if (!a.isNew) asignacionDeletes.push(a.asignacionId)
          continue
        }
        if (a.isNew) {
          asignacionInserts.push({
            ruta_mes_id: ruta.id,
            repartidor_id: b.repartidorId,
            id_sitio_entrega: a.id_sitio_entrega,
            orden_entrega: toIntOrDefault(a.orden_entrega, 1),
            cargue_alinnova: a.cargue_alinnova || null,
            horario_entrega_alinnova: a.horario_entrega_alinnova || null,
          })
        } else if (
          toIntOrDefault(a.orden_entrega, 1) !== a._original.orden_entrega ||
          (a.cargue_alinnova || '') !== a._original.cargue_alinnova ||
          (a.horario_entrega_alinnova || '') !== a._original.horario_entrega_alinnova
        ) {
          asignacionUpdates.push({
            id: a.asignacionId,
            orden_entrega: toIntOrDefault(a.orden_entrega, 1),
            cargue_alinnova: a.cargue_alinnova || null,
            horario_entrega_alinnova: a.horario_entrega_alinnova || null,
          })
        }
      }
    }

    const asignacionesAgregadas = asignacionInserts.length + repartidorInserts.reduce((sum, r) => sum + r.asignaciones.length, 0)

    return {
      repartidorInserts,
      repartidorUpdates,
      repartidorDeletes,
      asignacionInserts,
      asignacionUpdates,
      asignacionDeletes,
      counts: {
        asignacionesModificadas: asignacionUpdates.length,
        asignacionesEliminadas: asignacionDeletes.length,
        asignacionesAgregadas,
      },
    }
  }

  function handleGuardarClick() {
    const invalido = blocks.some(b => !b.deleted && (!b.conductor.trim() || !b.auxiliar.trim() || !b.placa.trim()))
    if (invalido) {
      setFormError('Todos los repartidores activos deben tener Conductor, Auxiliar y Placa.')
      return
    }
    setFormError('')
    setPendingDiff(buildDiff())
  }

  return (
    <>
      <div className="modal-overlay" onClick={() => !saving && onClose()}>
        <div className="modal-box modal-box-xl" onClick={e => e.stopPropagation()}>
          <div className="modal-title">Editar Ruta: {ruta.nombre_mes}</div>

          {loading ? (
            <div className="empty-state"><p>Cargando datos de la ruta...</p></div>
          ) : (
            <>
              {blocks.map(block => (
                <div key={block.key} className={`ruta-edit-block${block.deleted ? ' is-deleted' : ''}`}>
                  <div className="ruta-edit-block-header">
                    <div className="ruta-edit-block-fields">
                      <div className="form-group">
                        <label>Conductor</label>
                        <input
                          type="text"
                          value={block.conductor}
                          disabled={block.deleted}
                          onChange={e => updateBlockField(block.key, 'conductor', e.target.value)}
                          onBlur={() => checkDup(block)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Auxiliar</label>
                        <input
                          type="text"
                          value={block.auxiliar}
                          disabled={block.deleted}
                          onChange={e => updateBlockField(block.key, 'auxiliar', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Placa</label>
                        <input
                          type="text"
                          value={block.placa}
                          disabled={block.deleted}
                          onChange={e => updateBlockField(block.key, 'placa', e.target.value)}
                          onBlur={() => checkDup(block)}
                        />
                      </div>
                    </div>
                    <button className="btn-danger" onClick={() => toggleDeleteRepartidor(block)}>
                      {block.deleted ? '↩️ Restaurar repartidor' : '🗑️ Eliminar repartidor'}
                    </button>
                  </div>

                  {block.duplicateWarning && <p className="modal-hint modal-hint-warning">{block.duplicateWarning}</p>}

                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID Sitio</th>
                          <th>Nombre Institución</th>
                          <th>Orden</th>
                          <th>Cargue</th>
                          <th>Entrega</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.asignaciones.map(a => {
                          const sitio = sitiosById.get(a.id_sitio_entrega)
                          const rowDisabled = block.deleted || a.deleted
                          return (
                            <tr key={a.key} className={a.deleted ? 'row-eliminado' : ''}>
                              <td>{a.id_sitio_entrega}</td>
                              <td>{sitio ? sitio.nombre_institucion : `ID ${a.id_sitio_entrega} no encontrado`}</td>
                              <td>
                                <input
                                  type="number"
                                  className="table-input"
                                  value={a.orden_entrega ?? ''}
                                  disabled={rowDisabled}
                                  onChange={e => updateAsigField(block.key, a.key, 'orden_entrega', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="table-input"
                                  value={a.cargue_alinnova}
                                  disabled={rowDisabled}
                                  onChange={e => updateAsigField(block.key, a.key, 'cargue_alinnova', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="table-input"
                                  value={a.horario_entrega_alinnova}
                                  disabled={rowDisabled}
                                  onChange={e => updateAsigField(block.key, a.key, 'horario_entrega_alinnova', e.target.value)}
                                />
                              </td>
                              <td>
                                <button
                                  className="icon-btn danger"
                                  title={a.deleted ? 'Restaurar' : 'Eliminar'}
                                  disabled={block.deleted}
                                  onClick={() => toggleDeleteAsig(block.key, a)}
                                >
                                  {a.deleted ? '↩️' : '🗑️'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        {block.asignaciones.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af' }}>Sin sitios asignados</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!block.deleted && (
                    block.addingSitio ? (
                      <div className="ruta-edit-add-form">
                        <div className="form-grid-2">
                          <div className="form-group">
                            <label>Sitio</label>
                            <select value={block.draftSitio.id_sitio_entrega} onChange={e => updateDraftSitio(block.key, 'id_sitio_entrega', e.target.value)}>
                              <option value="">Selecciona...</option>
                              {sitiosActivos
                                .filter(s => !block.asignaciones.some(a => !a.deleted && a.id_sitio_entrega === s.id_sitio_entrega))
                                .map(s => (
                                  <option key={s.id_sitio_entrega} value={s.id_sitio_entrega}>{s.id_sitio_entrega} - {s.nombre_institucion}</option>
                                ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Orden</label>
                            <input type="number" value={block.draftSitio.orden_entrega} onChange={e => updateDraftSitio(block.key, 'orden_entrega', e.target.value)} />
                          </div>
                        </div>
                        <div className="form-grid-2">
                          <div className="form-group">
                            <label>Cargue</label>
                            <input type="text" value={block.draftSitio.cargue_alinnova} onChange={e => updateDraftSitio(block.key, 'cargue_alinnova', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label>Entrega</label>
                            <input type="text" value={block.draftSitio.horario_entrega_alinnova} onChange={e => updateDraftSitio(block.key, 'horario_entrega_alinnova', e.target.value)} />
                          </div>
                        </div>
                        <div className="modal-actions">
                          <button className="btn-secondary" onClick={() => cancelAddSitio(block.key)}>Cancelar</button>
                          <button className="btn-primary" onClick={() => confirmAddSitio(block.key)}>Añadir</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => openAddSitio(block.key)}>➕ Agregar sitio a este repartidor</button>
                    )
                  )}
                </div>
              ))}

              {addingRepartidor ? (
                <div className="ruta-edit-new-block">
                  <div className="section-label">Nuevo repartidor</div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Conductor</label>
                      <input type="text" value={nuevoRepartidor.conductor} onChange={e => setNuevoRepartidor(v => ({ ...v, conductor: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Placa</label>
                      <input type="text" value={nuevoRepartidor.placa} onChange={e => setNuevoRepartidor(v => ({ ...v, placa: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Auxiliar</label>
                    <input type="text" value={nuevoRepartidor.auxiliar} onChange={e => setNuevoRepartidor(v => ({ ...v, auxiliar: e.target.value }))} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => { setAddingRepartidor(false); setNuevoRepartidor({ conductor: '', auxiliar: '', placa: '' }) }}>Cancelar</button>
                    <button className="btn-primary" onClick={confirmAddRepartidor}>Añadir</button>
                  </div>
                </div>
              ) : (
                <button className="btn-primary" onClick={() => setAddingRepartidor(true)}>➕ Agregar nuevo repartidor</button>
              )}

              {formError && <p className="modal-error">{formError}</p>}
              {error && <p className="modal-error">{error}</p>}
            </>
          )}

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={handleGuardarClick} disabled={saving || loading}>💾 Guardar cambios</button>
          </div>
        </div>
      </div>

      {confirmEliminarRepartidor && (
        <ConfirmModal
          title={`¿Eliminar el repartidor ${confirmEliminarRepartidor.conductor} - ${confirmEliminarRepartidor.placa}?`}
          message={`Se eliminarán sus ${confirmEliminarRepartidor.asignaciones.filter(a => !a.deleted).length} asignaciones.`}
          confirmLabel="Eliminar"
          danger
          onConfirm={confirmarEliminarRepartidor}
          onCancel={() => setConfirmEliminarRepartidor(null)}
        />
      )}

      {pendingDiff && (
        <ConfirmModal
          title="¿Guardar todos los cambios?"
          message={`${pendingDiff.counts.asignacionesModificadas} asignaciones modificadas, ${pendingDiff.counts.asignacionesEliminadas} eliminadas, ${pendingDiff.counts.asignacionesAgregadas} agregadas.`}
          confirmLabel="💾 Guardar cambios"
          onConfirm={() => onGuardar(pendingDiff)}
          onCancel={() => setPendingDiff(null)}
          loading={saving}
        />
      )}
    </>
  )
}
