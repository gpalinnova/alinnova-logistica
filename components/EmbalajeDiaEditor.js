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

function buildRows(filas) {
  const rows = []
  for (const fila of filas) {
    if (!fila.lineas || fila.lineas.length === 0) continue
    const componenteLabel = COMPONENTE_LABELS[fila.key] || fila.label
    for (const linea of fila.lineas) {
      rows.push({
        productoId: linea.productoId,
        label: linea.subLabel ? `${componenteLabel} — ${linea.subLabel}` : componenteLabel,
        unidadesOriginal: linea.unidadesOriginal,
        unidadesActual: linea.unidadesActual,
        hasOverride: linea.hasOverride,
      })
    }
  }
  return rows
}

function EmbalajeRow({ fecha, row, onSaved, onRestored }) {
  const { productoId, label, unidadesOriginal } = row
  const [value, setValue] = useState(String(row.unidadesActual))
  const [hasOverride, setHasOverride] = useState(row.hasOverride)
  const [status, setStatus] = useState('idle')

  const numValue = Number(value)
  const isDirty = Number.isInteger(numValue) && numValue !== unidadesOriginal

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

  const statusLabel = { saving: 'guardando…', saved: 'guardado', error: 'error' }[status]

  return (
    <div className="embalaje-editor-row">
      <div className="embalaje-editor-label">{label}</div>
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
  )
}

export default function EmbalajeDiaEditor({ fecha, filas, onOverrideSaved, onOverrideRestored }) {
  const rows = buildRows(filas)

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
          />
        ))
      )}
    </div>
  )
}
