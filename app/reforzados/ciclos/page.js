'use client'

import { useEffect, useRef, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import ConfirmModal from '../../../components/ConfirmModal'
import Toast from '../../../components/Toast'
import CicloPreviewModal from '../../../components/CicloPreviewModal'
import CicloDetalleModal from '../../../components/CicloDetalleModal'
import { supabase } from '../../../lib/supabase'
import { parseCicloExcel, readFileAsArrayBuffer } from '../../../lib/parseCicloExcel'
import { formatFechaDisplay } from '../../../lib/cicloUtils'

function sortCiclos(list) {
  return [...list].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'activo' ? -1 : 1
    if (a.año !== b.año) return b.año - a.año
    return b.mes - a.mes
  })
}

export default function CiclosPage() {
  const [ciclos, setCiclos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [detalle, setDetalle] = useState(null)
  const [detalleDias, setDetalleDias] = useState([])
  const [detalleLoading, setDetalleLoading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchCiclos() }, [])

  async function fetchCiclos() {
    setLoading(true)
    const { data, error } = await supabase
      .from('reforzados_ciclos')
      .select('*, dias:reforzados_ciclo_dias(count)')
    if (error) {
      setErrorMsg('No se pudieron cargar los ciclos.')
    } else {
      setCiclos(sortCiclos(data || []))
      setErrorMsg('')
    }
    setLoading(false)
  }

  function diasCount(ciclo) {
    return ciclo.dias?.[0]?.count ?? 0
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
      const data = parseCicloExcel(buffer)
      const { data: existentes, error: existentesError } = await supabase
        .from('reforzados_ciclo_dias')
        .select('fecha')
        .in('fecha', data.dias.map(d => d.fecha))
      if (existentesError) throw new Error('No se pudieron verificar las fechas ya cargadas.')
      setPreview({
        data,
        dias: data.dias,
        fechasExistentes: new Set((existentes || []).map(e => e.fecha)),
        archivoNombre: file.name,
      })
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo leer el archivo Excel.')
    } finally {
      setUploading(false)
    }
  }

  function closePreview() {
    if (saving) return
    setPreview(null)
  }

  // Devuelve el id del ciclo del mes, creándolo en espera si no existe. Un
  // ciclo existente nunca se borra: la carga combina por fecha.
  async function ensureCicloId({ mes, año, nombreMes }, archivoNombre) {
    const existente = ciclos.find(c => c.mes === mes && c.año === año)
    if (existente) {
      const { error } = await supabase
        .from('reforzados_ciclos')
        .update({ archivo_nombre: archivoNombre, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
      if (error) throw error
      return existente.id
    }
    const { data: inserted, error } = await supabase
      .from('reforzados_ciclos')
      .insert([{ mes, año, nombre_mes: nombreMes, estado: 'espera', archivo_nombre: archivoNombre }])
      .select('id')
      .single()
    if (error) throw error
    return inserted.id
  }

  async function handleConfirmUpload() {
    if (!preview) return
    setSaving(true)
    try {
      const { data, dias, archivoNombre } = preview

      const cicloIdPorMes = new Map()
      for (const m of data.meses) {
        cicloIdPorMes.set(`${m.año}-${String(m.mes).padStart(2, '0')}`, await ensureCicloId(m, archivoNombre))
      }

      // Upsert por fecha (UNIQUE reforzados_ciclo_dias.fecha): solo las
      // fechas del archivo; las demás fechas del mes quedan intactas.
      const diasRows = dias.map(d => ({ ...d, ciclo_id: cicloIdPorMes.get(d.fecha.slice(0, 7)) }))
      const { error: diasError } = await supabase
        .from('reforzados_ciclo_dias')
        .upsert(diasRows, { onConflict: 'fecha' })
      if (diasError) throw diasError

      await fetchCiclos()
      setPreview(null)
      const fechasTexto = dias.map(d => formatFechaDisplay(d.fecha).slice(0, 5)).join(', ')
      setToast({ message: `Se cargaron ${dias.length} fecha${dias.length === 1 ? '' : 's'}: ${fechasTexto}`, type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo guardar el ciclo.')
    } finally {
      setSaving(false)
    }
  }

  function askActivar(ciclo) {
    setConfirmAction({ type: 'activar', ciclo })
  }

  function askDesactivar(ciclo) {
    setConfirmAction({ type: 'desactivar', ciclo })
  }

  function askEliminar(ciclo) {
    setConfirmAction({ type: 'eliminar', ciclo })
  }

  async function handleConfirmActionRun() {
    if (!confirmAction) return
    const { type, ciclo } = confirmAction
    setConfirmLoading(true)
    try {
      if (type === 'activar') {
        const { error: e1 } = await supabase.from('reforzados_ciclos').update({ estado: 'espera', updated_at: new Date().toISOString() }).eq('estado', 'activo')
        if (e1) throw e1
        const { error: e2 } = await supabase.from('reforzados_ciclos').update({ estado: 'activo', updated_at: new Date().toISOString() }).eq('id', ciclo.id)
        if (e2) throw e2
        setToast({ message: `Ciclo de ${ciclo.nombre_mes} activado`, type: 'success' })
      } else if (type === 'desactivar') {
        const { error } = await supabase.from('reforzados_ciclos').update({ estado: 'espera', updated_at: new Date().toISOString() }).eq('id', ciclo.id)
        if (error) throw error
        setToast({ message: `Ciclo de ${ciclo.nombre_mes} desactivado`, type: 'success' })
      } else if (type === 'eliminar') {
        const { error } = await supabase.from('reforzados_ciclos').delete().eq('id', ciclo.id)
        if (error) throw error
        setToast({ message: `Ciclo de ${ciclo.nombre_mes} eliminado`, type: 'success' })
      }
      await fetchCiclos()
      setConfirmAction(null)
    } catch (err) {
      setErrorMsg('No se pudo completar la acción.')
    } finally {
      setConfirmLoading(false)
    }
  }

  async function openDetalle(ciclo) {
    setDetalle(ciclo)
    setDetalleDias([])
    setDetalleLoading(true)
    const { data, error } = await supabase
      .from('reforzados_ciclo_dias')
      .select('*')
      .eq('ciclo_id', ciclo.id)
      .order('fecha')
    if (!error) setDetalleDias(data || [])
    setDetalleLoading(false)
  }

  function closeDetalle() {
    setDetalle(null)
    setDetalleDias([])
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Ciclos" subtitle="Gestión de rotación de menús por mes" />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="dropzone">
            <div className="dropzone-icon">📤</div>
            <div className="dropzone-text">Subir Excel del Ciclo Mensual</div>
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
          </div>

          <div className="section-label">Ciclos Guardados</div>

          {loading ? (
            <div className="empty-state"><p>Cargando ciclos...</p></div>
          ) : ciclos.length === 0 ? (
            <div className="empty-state"><p>No hay ciclos cargados todavía.</p></div>
          ) : (
            ciclos.map(ciclo => {
              const count = diasCount(ciclo)
              const semanas = Math.ceil(count / 6)
              return (
                <div key={ciclo.id} className="ciclo-card">
                  <div className="ciclo-card-main">
                    <div className="ciclo-card-mes">{ciclo.nombre_mes}</div>
                    <div className="ciclo-card-meta">
                      {ciclo.estado === 'activo' ? (
                        <span className="badge badge-activo">🟢 ACTIVO</span>
                      ) : (
                        <span className="badge badge-espera">⚪ EN ESPERA</span>
                      )}
                      <span className="ciclo-card-dias">{count} días — {semanas} semana{semanas === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="ciclo-card-actions">
                    {ciclo.estado === 'espera' && (
                      <button className="btn-activar" onClick={() => askActivar(ciclo)}>▶️ Activar</button>
                    )}
                    {ciclo.estado === 'activo' && (
                      <button className="btn-desactivar" onClick={() => askDesactivar(ciclo)}>⏸️ Desactivar</button>
                    )}
                    <button className="btn-secondary" onClick={() => openDetalle(ciclo)}>👁️ Ver Detalle</button>
                    <button className="btn-danger" onClick={() => askEliminar(ciclo)}>🗑️ Eliminar</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {preview && (
        <CicloPreviewModal
          data={preview.data}
          dias={preview.dias}
          fechasExistentes={preview.fechasExistentes}
          archivoNombre={preview.archivoNombre}
          onCancel={closePreview}
          onConfirm={handleConfirmUpload}
          saving={saving}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'activar' ? `¿Activar el ciclo de ${confirmAction.ciclo.nombre_mes}?` :
            confirmAction.type === 'desactivar' ? `¿Desactivar el ciclo de ${confirmAction.ciclo.nombre_mes}?` :
            `¿Eliminar el ciclo de ${confirmAction.ciclo.nombre_mes}?`
          }
          message={
            confirmAction.type === 'activar' ? 'El ciclo activo actual pasará a espera.' :
            confirmAction.type === 'desactivar' ? 'Ningún ciclo quedará activo.' :
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
        <CicloDetalleModal
          ciclo={detalle}
          dias={detalleDias}
          loading={detalleLoading}
          onClose={closeDetalle}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
