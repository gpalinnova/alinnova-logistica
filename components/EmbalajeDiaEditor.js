'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

const COMPONENTE_LABELS = {
  'BEBIDA UHT': 'Bebida UHT',
  AGUA: 'Agua',
  PROTEICO: 'Proteico',
  POSTRE: 'Postre',
  FRUTA: 'Fruta',
}

function buildRows(filas, labelOverridesByProductoId, notasByProductoId) {
  const rows = []
  for (const fila of filas) {
    if (!fila.lineas || fila.lineas.length === 0) continue
    const componenteLabel = COMPONENTE_LABELS[fila.key] || fila.label
    for (const linea of fila.lineas) {
      const labelDefault = linea.subLabel ? `${componenteLabel} — ${linea.subLabel}` : componenteLabel
      rows.push({
        productoId: linea.productoId,
        labelDefault,
        labelCustom: labelOverridesByProductoId?.get(linea.productoId) || null,
        notaCustom: notasByProductoId?.get(linea.productoId) || null,
        unidadesOriginal: linea.unidadesOriginal,
        unidadesActual: linea.unidadesActual,
        hasOverride: linea.hasOverride,
      })
    }
  }
  return rows
}

function EmbalajeRow({ fecha, row, onSaved, onRestored, onLabelSaved, onLabelRestored, onNotaSaved, onNotaRestored }) {
  const { productoId, labelDefault, unidadesOriginal } = row
  const [value, setValue] = useState(String(row.unidadesActual))
  const [hasOverride, setHasOverride] = useState(row.hasOverride)
  const [status, setStatus] = useState('idle')
  const [labelValue, setLabelValue] = useState(row.labelCustom || labelDefault)
  const [labelStatus, setLabelStatus] = useState('idle')
  const [notaSaved, setNotaSaved] = useState(row.notaCustom || null)
  const [notaActive, setNotaActive] = useState(!!row.notaCustom)
  const [notaDraft, setNotaDraft] = useState(row.notaCustom || '')
  const [notaStatus, setNotaStatus] = useState('idle')

  const numValue = Number(value)
  const isDirty = Number.isInteger(numValue) && numValue !== unidadesOriginal

  function currentQtyForUpsert() {
    return Number.isInteger(numValue) && numValue > 0 ? numValue : unidadesOriginal
  }

  async function handleSave() {
    if (!Number.isInteger(numValue) || numValue <= 0) {
      setStatus('error')
      return
    }
    if (numValue === unidadesOriginal && !hasOverride) {
      setStatus('idle')
      return
    }
    if (numValue === unidadesOriginal && hasOverride) {
      await handleRestore()
      return
    }
    setStatus('saving')
    const { error } = await supabase.from('reforzados_override_embalaje_dia').upsert(
      {
        fecha,
        embalaje_ref: productoId,
        unidades_por_canastilla: numValue,
        unidades_original: unidadesOriginal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fecha,embalaje_ref' }
    )
    if (error) {
      setStatus('error')
      return
    }
    setHasOverride(true)
    setStatus('saved')
    onSaved?.(productoId, numValue)
  }

  async function handleRestore() {
    setStatus('saving')
    const { error } = await supabase
      .from('reforzados_override_embalaje_dia')
      .delete()
      .eq('fecha', fecha)
      .eq('embalaje_ref', productoId)
    if (error) {
      setStatus('error')
      return
    }
    setValue(String(unidadesOriginal))
    setHasOverride(false)
    setStatus('idle')
    onRestored?.(productoId)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  // Nota descriptiva editable de la fila (ej. "canastilla por 210 unidades en
  // bolsa de 10"). No afecta el cálculo de embalaje ni el rutero: solo se
  // guarda label_custom en reforzados_override_embalaje_dia. unidades_por_canastilla
  // se re-envía sin cambios porque la columna es NOT NULL en la tabla.
  async function handleLabelSave() {
    const trimmed = labelValue.trim()
    const toSave = trimmed && trimmed !== labelDefault ? trimmed : null
    setLabelStatus('saving')
    const { error } = await supabase.from('reforzados_override_embalaje_dia').upsert(
      {
        fecha,
        embalaje_ref: productoId,
        unidades_por_canastilla: currentQtyForUpsert(),
        unidades_original: unidadesOriginal,
        label_custom: toSave,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fecha,embalaje_ref' }
    )
    if (error) {
      setLabelStatus('error')
      return
    }
    setLabelValue(toSave || labelDefault)
    if (toSave) setHasOverride(true)
    setLabelStatus('idle')
    if (toSave) onLabelSaved?.(productoId, toSave)
    else onLabelRestored?.(productoId)
  }

  function handleLabelKeyDown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  function handleNotaAdd() {
    setNotaActive(true)
  }

  function handleNotaCancel() {
    setNotaDraft(notaSaved || '')
    setNotaActive(!!notaSaved)
    setNotaStatus('idle')
  }

  async function handleNotaGuardar() {
    const trimmed = notaDraft.trim()
    if (!trimmed) {
      setNotaStatus('error')
      return
    }
    setNotaStatus('saving')
    const { error } = await supabase.from('reforzados_override_embalaje_dia').upsert(
      {
        fecha,
        embalaje_ref: productoId,
        unidades_por_canastilla: currentQtyForUpsert(),
        unidades_original: unidadesOriginal,
        embalaje_nota: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fecha,embalaje_ref' }
    )
    if (error) {
      setNotaStatus('error')
      return
    }
    setNotaSaved(trimmed)
    setNotaDraft(trimmed)
    setNotaActive(true)
    setNotaStatus('idle')
    onNotaSaved?.(productoId, trimmed)
  }

  async function handleNotaEliminar() {
    setNotaStatus('saving')
    const { error } = await supabase
      .from('reforzados_override_embalaje_dia')
      .update({ embalaje_nota: null, updated_at: new Date().toISOString() })
      .eq('fecha', fecha)
      .eq('embalaje_ref', productoId)
    if (error) {
      setNotaStatus('error')
      return
    }
    setNotaSaved(null)
    setNotaDraft('')
    setNotaActive(false)
    setNotaStatus('idle')
    onNotaRestored?.(productoId)
  }

  const statusLabel = { saving: 'guardando…', saved: 'guardado', error: 'error' }[status]
  const labelStatusLabel = { saving: 'guardando…', error: 'error' }[labelStatus]
  const notaStatusLabel = { saving: 'guardando…', error: 'error' }[notaStatus]

  return (
    <div className="embalaje-editor-item">
      <div className="embalaje-editor-main-row">
        <input
          type="text"
          className="embalaje-editor-label-input"
          value={labelValue}
          onChange={e => setLabelValue(e.target.value)}
          onBlur={handleLabelSave}
          onKeyDown={handleLabelKeyDown}
        />
        {labelStatusLabel && (
          <span className={`embalaje-editor-status embalaje-editor-status-${labelStatus}`}>{labelStatusLabel}</span>
        )}
        <div className="embalaje-editor-controls">
          <input
            type="number"
            min="1"
            className={`embalaje-editor-input${isDirty ? ' embalaje-editor-input-warn' : ''}`}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
          />
          {hasOverride && (
            <button type="button" className="embalaje-editor-restore" onClick={handleRestore}>
              ↩ Restaurar
            </button>
          )}
          {statusLabel && (
            <span className={`embalaje-editor-status embalaje-editor-status-${status}`}>{statusLabel}</span>
          )}
        </div>
      </div>
      <div className="embalaje-editor-nota-row">
        {!notaActive ? (
          <button type="button" className="embalaje-editor-nota-btn" onClick={handleNotaAdd}>
            + Agregar nota
          </button>
        ) : (
          <>
            <input
              type="text"
              className="embalaje-editor-nota-input"
              placeholder="Ej: + 5 sueltas"
              value={notaDraft}
              onChange={e => setNotaDraft(e.target.value)}
            />
            <div className="embalaje-editor-nota-actions">
              <button type="button" className="embalaje-editor-nota-save" onClick={handleNotaGuardar}>
                Guardar
              </button>
              {notaSaved ? (
                <button type="button" className="embalaje-editor-nota-delete" onClick={handleNotaEliminar}>
                  Eliminar
                </button>
              ) : (
                <button type="button" className="embalaje-editor-nota-cancel" onClick={handleNotaCancel}>
                  Cancelar
                </button>
              )}
            </div>
          </>
        )}
        {notaStatusLabel && (
          <span className={`embalaje-editor-status embalaje-editor-status-${notaStatus}`}>{notaStatusLabel}</span>
        )}
      </div>
    </div>
  )
}

export default function EmbalajeDiaEditor({
  fecha,
  filas,
  labelOverridesByProductoId,
  notasByProductoId,
  onOverrideSaved,
  onOverrideRestored,
  onLabelSaved,
  onLabelRestored,
  onNotaSaved,
  onNotaRestored,
}) {
  const rows = buildRows(filas, labelOverridesByProductoId, notasByProductoId)

  return (
    <div className="embalaje-editor">
      <div className="embalaje-editor-title">✏️ Ajustar embalaje del día</div>
      <p className="embalaje-editor-note">Solo aplica para este día. La data maestra no se modifica.</p>
      {rows.length === 0 ? (
        <div className="empty-state"><p>No hay líneas de embalaje para ajustar.</p></div>
      ) : (
        rows.map(row => (
          <EmbalajeRow
            key={`${fecha}-${row.productoId}`}
            fecha={fecha}
            row={row}
            onSaved={onOverrideSaved}
            onRestored={onOverrideRestored}
            onLabelSaved={onLabelSaved}
            onLabelRestored={onLabelRestored}
            onNotaSaved={onNotaSaved}
            onNotaRestored={onNotaRestored}
          />
        ))
      )}
    </div>
  )
}
