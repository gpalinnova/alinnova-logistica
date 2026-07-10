'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import ConfirmModal from '../../../components/ConfirmModal'
import Toast from '../../../components/Toast'
import RutaPreviewModal from '../../../components/RutaPreviewModal'
import RutaDetalleModal from '../../../components/RutaDetalleModal'
import RutaEditModal from '../../../components/RutaEditModal'
import { supabase } from '../../../lib/supabase'
import { parseRutasExcel, parseRutasPaste, readFileAsArrayBuffer, detectMesAnioFromFilename } from '../../../lib/parseRutasExcel'
import { descargarPlantillaRutas } from '../../../lib/rutasTemplate'

function sortRutas(list) {
  return [...list].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'activo' ? -1 : 1
    if (a.año !== b.año) return b.año - a.año
    return b.mes - a.mes
  })
}

export default function RutasPage() {
  const [rutas, setRutas] = useState([])
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [analizandoPaste, setAnalizandoPaste] = useState(false)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [detalleAsignaciones, setDetalleAsignaciones] = useState([])
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const [editandoAsignaciones, setEditandoAsignaciones] = useState([])
  const [editandoLoading, setEditandoLoading] = useState(false)
  const [editandoSaving, setEditandoSaving] = useState(false)
  const [editandoError, setEditandoError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => { fetchSitios(); fetchRutas() }, [])

  const sitiosById = useMemo(() => {
    const map = new Map()
    for (const s of sitios) map.set(s.id_sitio_entrega, s)
    return map
  }, [sitios])

  async function fetchSitios() {
    const { data, error } = await supabase.from('reforzados_sitios').select('id_sitio_entrega, nombre_institucion, direccion, localidad, activo')
    if (!error) setSitios(data || [])
  }

  async function fetchRutas() {
    setLoading(true)
    const [{ data: rutasData, error: rutasError }, { data: asigData, error: asigError }] = await Promise.all([
      supabase.from('reforzados_rutas_mes').select('*'),
      supabase.from('reforzados_ruta_asignaciones').select('ruta_mes_id, repartidor_id'),
    ])
    if (rutasError || asigError) {
      setErrorMsg('No se pudieron cargar las rutas.')
    } else {
      const statsMap = new Map()
      for (const a of asigData || []) {
        let s = statsMap.get(a.ruta_mes_id)
        if (!s) {
          s = { asignaciones: 0, repartidoresSet: new Set() }
          statsMap.set(a.ruta_mes_id, s)
        }
        s.asignaciones += 1
        s.repartidoresSet.add(a.repartidor_id)
      }
      const merged = (rutasData || []).map(r => {
        const s = statsMap.get(r.id)
        return { ...r, countAsignaciones: s ? s.asignaciones : 0, countRepartidores: s ? s.repartidoresSet.size : 0 }
      })
      setRutas(sortRutas(merged))
      setErrorMsg('')
    }
    setLoading(false)
  }

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setErrorMsg('')
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const data = parseRutasExcel(buffer)
      const mesDetectado = detectMesAnioFromFilename(file.name)
      setPreview({ data, archivoNombre: file.name, mesDetectado })
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo leer el archivo Excel.')
    } finally {
      setUploading(false)
    }
  }

  function handleAnalizarPaste() {
    setAnalizandoPaste(true)
    setErrorMsg('')
    try {
      const data = parseRutasPaste(pasteText)
      setPreview({ data, archivoNombre: 'Pegado desde portapapeles', mesDetectado: null })
      setPasteText('')
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo analizar el texto pegado.')
    } finally {
      setAnalizandoPaste(false)
    }
  }

  function closePreview() {
    if (saving) return
    setPreview(null)
  }

  async function handleConfirmUpload({ mes, año, nombreMes, existingRuta }) {
    if (!preview) return
    setSaving(true)
    try {
      const { data, archivoNombre } = preview
      let estado = 'espera'

      if (existingRuta) {
        estado = existingRuta.estado
        const { error: deleteError } = await supabase.from('reforzados_rutas_mes').delete().eq('id', existingRuta.id)
        if (deleteError) throw deleteError
      }

      const repartidoresPayload = data.repartidores.map(r => ({ conductor: r.conductor, auxiliar: r.auxiliar, placa: r.placa }))
      const { data: upserted, error: repartidoresError } = await supabase
        .from('reforzados_repartidores')
        .upsert(repartidoresPayload, { onConflict: 'conductor,placa' })
        .select('id, conductor, placa')
      if (repartidoresError) throw repartidoresError

      const repartidorIdMap = new Map()
      for (const r of upserted) repartidorIdMap.set(`${r.conductor}||${r.placa}`, r.id)

      const { data: rutaInsertada, error: rutaError } = await supabase
        .from('reforzados_rutas_mes')
        .insert([{ mes, año, nombre_mes: nombreMes, estado, archivo_nombre: archivoNombre }])
        .select()
        .single()
      if (rutaError) throw rutaError

      const asignacionesRows = data.asignaciones
        .filter(a => sitiosById.has(a.id_sitio_entrega))
        .map(a => ({
          ruta_mes_id: rutaInsertada.id,
          repartidor_id: repartidorIdMap.get(`${a.conductor}||${a.placa}`),
          id_sitio_entrega: a.id_sitio_entrega,
          orden_entrega: a.orden_entrega,
          cargue_alinnova: a.cargue_alinnova,
          horario_entrega_alinnova: a.horario_entrega_alinnova,
        }))

      if (asignacionesRows.length > 0) {
        const { error: asigError } = await supabase.from('reforzados_ruta_asignaciones').insert(asignacionesRows)
        if (asigError) {
          await supabase.from('reforzados_rutas_mes').delete().eq('id', rutaInsertada.id)
          throw asigError
        }
      }

      await fetchRutas()
      setPreview(null)
      setToast({ message: `Ruta de ${nombreMes} guardada: ${data.repartidores.length} repartidores, ${asignacionesRows.length} asignaciones.`, type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo guardar la ruta.')
    } finally {
      setSaving(false)
    }
  }

  function askActivar(ruta) {
    setConfirmAction({ type: 'activar', ruta })
  }

  function askDesactivar(ruta) {
    setConfirmAction({ type: 'desactivar', ruta })
  }

  function askEliminar(ruta) {
    setConfirmAction({ type: 'eliminar', ruta })
  }

  async function handleConfirmActionRun() {
    if (!confirmAction) return
    const { type, ruta } = confirmAction
    setConfirmLoading(true)
    try {
      if (type === 'activar') {
        const { error: e1 } = await supabase.from('reforzados_rutas_mes').update({ estado: 'espera' }).eq('estado', 'activo')
        if (e1) throw e1
        const { error: e2 } = await supabase.from('reforzados_rutas_mes').update({ estado: 'activo' }).eq('id', ruta.id)
        if (e2) throw e2
        setToast({ message: `Ruta de ${ruta.nombre_mes} activada`, type: 'success' })
      } else if (type === 'desactivar') {
        const { error } = await supabase.from('reforzados_rutas_mes').update({ estado: 'espera' }).eq('id', ruta.id)
        if (error) throw error
        setToast({ message: `Ruta de ${ruta.nombre_mes} desactivada`, type: 'success' })
      } else if (type === 'eliminar') {
        const { error } = await supabase.from('reforzados_rutas_mes').delete().eq('id', ruta.id)
        if (error) throw error
        setToast({ message: `Ruta de ${ruta.nombre_mes} eliminada`, type: 'success' })
      }
      await fetchRutas()
      setConfirmAction(null)
    } catch (err) {
      setErrorMsg('No se pudo completar la acción.')
    } finally {
      setConfirmLoading(false)
    }
  }

  async function openDetalle(ruta) {
    setDetalle(ruta)
    setDetalleAsignaciones([])
    setDetalleLoading(true)
    const { data, error } = await supabase
      .from('reforzados_ruta_asignaciones')
      .select('*, repartidor:reforzados_repartidores(conductor, placa, auxiliar)')
      .eq('ruta_mes_id', ruta.id)
      .order('orden_entrega')
    if (!error) setDetalleAsignaciones(data || [])
    setDetalleLoading(false)
  }

  function closeDetalle() {
    setDetalle(null)
    setDetalleAsignaciones([])
  }

  async function openEditar(ruta) {
    setEditando(ruta)
    setEditandoAsignaciones([])
    setEditandoError('')
    setEditandoLoading(true)
    const { data, error } = await supabase
      .from('reforzados_ruta_asignaciones')
      .select('*, repartidor:reforzados_repartidores(id, conductor, placa, auxiliar)')
      .eq('ruta_mes_id', ruta.id)
      .order('orden_entrega')
    if (!error) setEditandoAsignaciones(data || [])
    setEditandoLoading(false)
  }

  function closeEditar() {
    if (editandoSaving) return
    setEditando(null)
    setEditandoAsignaciones([])
    setEditandoError('')
  }

  async function checkDuplicadoRepartidor(conductor, placa, excludeId) {
    const { data } = await supabase.from('reforzados_repartidores').select('id').eq('conductor', conductor).eq('placa', placa)
    return (data || []).some(r => r.id !== excludeId)
  }

  async function handleGuardarEdicion(diff) {
    setEditandoSaving(true)
    setEditandoError('')
    try {
      const repartidorIdByTempKey = new Map()
      if (diff.repartidorInserts.length > 0) {
        const payload = diff.repartidorInserts.map(r => ({ conductor: r.conductor, auxiliar: r.auxiliar, placa: r.placa }))
        const { data: inserted, error } = await supabase.from('reforzados_repartidores').insert(payload).select('id')
        if (error) throw error
        diff.repartidorInserts.forEach((r, i) => repartidorIdByTempKey.set(r.tempKey, inserted[i].id))
      }

      for (const r of diff.repartidorUpdates) {
        const { error } = await supabase.from('reforzados_repartidores')
          .update({ conductor: r.conductor, auxiliar: r.auxiliar, placa: r.placa, updated_at: new Date().toISOString() })
          .eq('id', r.id)
        if (error) throw error
      }

      if (diff.asignacionInserts.length > 0) {
        const { error } = await supabase.from('reforzados_ruta_asignaciones').insert(diff.asignacionInserts)
        if (error) throw error
      }

      const nuevasParaNuevos = []
      for (const r of diff.repartidorInserts) {
        const repartidorId = repartidorIdByTempKey.get(r.tempKey)
        for (const a of r.asignaciones) {
          nuevasParaNuevos.push({
            ruta_mes_id: editando.id,
            repartidor_id: repartidorId,
            id_sitio_entrega: a.id_sitio_entrega,
            orden_entrega: a.orden_entrega,
            cargue_alinnova: a.cargue_alinnova,
            horario_entrega_alinnova: a.horario_entrega_alinnova,
          })
        }
      }
      if (nuevasParaNuevos.length > 0) {
        const { error } = await supabase.from('reforzados_ruta_asignaciones').insert(nuevasParaNuevos)
        if (error) throw error
      }

      for (const a of diff.asignacionUpdates) {
        const { error } = await supabase.from('reforzados_ruta_asignaciones')
          .update({ orden_entrega: a.orden_entrega, cargue_alinnova: a.cargue_alinnova, horario_entrega_alinnova: a.horario_entrega_alinnova })
          .eq('id', a.id)
        if (error) throw error
      }

      if (diff.asignacionDeletes.length > 0) {
        const { error } = await supabase.from('reforzados_ruta_asignaciones').delete().in('id', diff.asignacionDeletes)
        if (error) throw error
      }

      for (const r of diff.repartidorDeletes) {
        const { count } = await supabase.from('reforzados_ruta_asignaciones').select('id', { count: 'exact', head: true }).eq('repartidor_id', r.id)
        if (!count) {
          await supabase.from('reforzados_repartidores').delete().eq('id', r.id)
        }
      }

      await fetchRutas()
      setEditando(null)
      setEditandoAsignaciones([])
      setToast({ message: 'Cambios guardados correctamente.', type: 'success' })
    } catch (err) {
      setEditandoError(err.code === '23505' ? 'Ya existe un repartidor con ese conductor y placa.' : 'No se pudieron guardar los cambios de la ruta.')
    } finally {
      setEditandoSaving(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Rutas" subtitle="Asignación mensual de conductores y sitios" />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="section-label">Cargar Ruta del Mes</div>
          <div className="carga-ruta-grid">
            <div className="dropzone dropzone-highlight">
              <div className="dropzone-icon">📋</div>
              <div className="dropzone-text">Pegar desde Excel</div>
              <textarea
                className="paste-textarea"
                placeholder="Copia el rango de tu Excel y pégalo aquí (Ctrl+V). Incluye la fila de encabezados."
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={8}
              />
              {pasteText.trim().length > 0 && (
                <button className="btn-primary" onClick={handleAnalizarPaste} disabled={analizandoPaste}>
                  {analizandoPaste ? 'Analizando...' : '🔍 Analizar pegado'}
                </button>
              )}
            </div>

            <div className="carga-ruta-divider"><span>o</span></div>

            <div className="dropzone">
              <div className="dropzone-icon">📤</div>
              <div className="dropzone-text">Subir Excel</div>
              <button className="btn-primary" onClick={handlePickFile} disabled={uploading}>
                {uploading ? 'Leyendo archivo...' : 'Seleccionar Archivo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div style={{ marginTop: 14 }}>
                <a href="#" onClick={e => { e.preventDefault(); descargarPlantillaRutas() }} className="breadcrumb-link" style={{ color: '#3D1F3D', display: 'inline-flex' }}>
                  📥 Descargar plantilla
                </a>
              </div>
            </div>
          </div>

          <div className="section-label">Rutas Cargadas</div>

          {loading ? (
            <div className="empty-state"><p>Cargando rutas...</p></div>
          ) : rutas.length === 0 ? (
            <div className="empty-state"><p>No hay rutas cargadas todavía.</p></div>
          ) : (
            rutas.map(ruta => (
              <div key={ruta.id} className="ciclo-card">
                <div className="ciclo-card-main">
                  <div className="ciclo-card-mes">{ruta.nombre_mes}</div>
                  <div className="ciclo-card-meta">
                    {ruta.estado === 'activo' ? (
                      <span className="badge badge-activo">🟢 ACTIVA</span>
                    ) : (
                      <span className="badge badge-espera">⚪ EN ESPERA</span>
                    )}
                    <span className="ciclo-card-dias">{ruta.countRepartidores} repartidores · {ruta.countAsignaciones} asignaciones</span>
                  </div>
                </div>
                <div className="ciclo-card-actions">
                  {ruta.estado === 'espera' && (
                    <button className="btn-activar" onClick={() => askActivar(ruta)}>▶️ Activar</button>
                  )}
                  {ruta.estado === 'activo' && (
                    <button className="btn-desactivar" onClick={() => askDesactivar(ruta)}>⏸️ Desactivar</button>
                  )}
                  <button className="btn-secondary" onClick={() => openDetalle(ruta)}>👁️ Ver Detalle</button>
                  <button className="btn-secondary" onClick={() => openEditar(ruta)}>✏️ Editar</button>
                  <button className="btn-danger" onClick={() => askEliminar(ruta)}>🗑️ Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {preview && (
        <RutaPreviewModal
          data={preview.data}
          archivoNombre={preview.archivoNombre}
          mesDetectado={preview.mesDetectado}
          rutas={rutas}
          sitiosById={sitiosById}
          onCancel={closePreview}
          onConfirm={handleConfirmUpload}
          saving={saving}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'activar' ? `¿Activar la ruta de ${confirmAction.ruta.nombre_mes}?` :
            confirmAction.type === 'desactivar' ? `¿Desactivar la ruta de ${confirmAction.ruta.nombre_mes}?` :
            `¿Eliminar la ruta de ${confirmAction.ruta.nombre_mes}?`
          }
          message={
            confirmAction.type === 'activar' ? 'La actual pasará a espera.' :
            confirmAction.type === 'desactivar' ? 'Ninguna ruta quedará activa.' :
            'Esta acción no se puede deshacer.'
          }
          confirmLabel={confirmAction.type === 'eliminar' ? 'Eliminar' : 'Confirmar'}
          danger={confirmAction.type === 'eliminar'}
          onConfirm={handleConfirmActionRun}
          onCancel={() => !confirmLoading && setConfirmAction(null)}
          loading={confirmLoading}
        />
      )}

      {detalle && (
        <RutaDetalleModal
          ruta={detalle}
          asignaciones={detalleAsignaciones}
          sitiosById={sitiosById}
          loading={detalleLoading}
          onClose={closeDetalle}
        />
      )}

      {editando && (
        <RutaEditModal
          ruta={editando}
          asignaciones={editandoAsignaciones}
          sitios={sitios}
          sitiosById={sitiosById}
          loading={editandoLoading}
          saving={editandoSaving}
          error={editandoError}
          onClose={closeEditar}
          onGuardar={handleGuardarEdicion}
          onCheckDuplicado={checkDuplicadoRepartidor}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
