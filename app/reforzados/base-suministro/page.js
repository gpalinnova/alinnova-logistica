'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import ConfirmModal from '../../../components/ConfirmModal'
import Toast from '../../../components/Toast'
import BaseSuministroPreviewModal from '../../../components/BaseSuministroPreviewModal'
import BaseSuministroDetalleModal from '../../../components/BaseSuministroDetalleModal'
import { supabase } from '../../../lib/supabase'
import { parseBaseSuministroExcel, readFileAsArrayBuffer } from '../../../lib/parseBaseSuministro'
import { formatFechaLarga } from '../../../lib/tablaWhatsappUtils'

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function currentMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesLabel(mesISO) {
  const [y, m] = mesISO.split('-')
  return `${capitalize(MESES_ES[parseInt(m, 10) - 1])} ${y}`
}

function aggregateByFecha(rows) {
  const map = new Map()
  for (const r of rows) {
    let s = map.get(r.fecha)
    if (!s) {
      s = { fecha: r.fecha, sitios: 0, total: 0, tipo1: 0, tipo2: 0, muestras: 0, tipoN: 0 }
      map.set(r.fecha, s)
    }
    s.sitios += 1
    s.total += r.total || 0
    s.tipo1 += r.tipo_1_total || 0
    s.tipo2 += r.tipo_2_total || 0
    s.muestras += (r.muestra_tipo_1 || 0) + (r.muestra_tipo_2 || 0)
    s.tipoN += r.tipo_n || 0
  }
  return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export default function BaseSuministroPage() {
  const [sitios, setSitios] = useState([])
  const [basesRaw, setBasesRaw] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO())
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [detalleFecha, setDetalleFecha] = useState(null)
  const [detalleFilas, setDetalleFilas] = useState([])
  const [detalleLoading, setDetalleLoading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { fetchSitios(); fetchBases() }, [])

  const sitiosById = useMemo(() => {
    const map = new Map()
    for (const s of sitios) map.set(s.id_sitio_entrega, s)
    return map
  }, [sitios])

  const basesAgg = useMemo(() => aggregateByFecha(basesRaw), [basesRaw])
  const basesByFecha = useMemo(() => new Map(basesAgg.map(b => [b.fecha, b])), [basesAgg])

  const monthsOptions = useMemo(() => {
    const set = new Set([currentMonthISO()])
    for (const b of basesAgg) set.add(b.fecha.slice(0, 7))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [basesAgg])

  const filteredBases = useMemo(() => basesAgg.filter(b => b.fecha.startsWith(selectedMonth)), [basesAgg, selectedMonth])

  async function fetchSitios() {
    const { data, error } = await supabase.from('reforzados_sitios').select('*')
    if (!error) setSitios(data || [])
  }

  async function fetchBases() {
    setLoading(true)
    const { data, error } = await supabase.from('reforzados_base_suministro').select('*').order('fecha', { ascending: false })
    if (error) {
      setErrorMsg('No se pudieron cargar las bases de suministro.')
    } else {
      setBasesRaw(data || [])
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
      const data = parseBaseSuministroExcel(buffer, file.name)
      setPreview({ data, archivoNombre: file.name, fechaDetectada: data.fechaSugerida })
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

  async function handleConfirmUpload({ fecha }) {
    if (!preview) return
    setSaving(true)
    try {
      const { data, archivoNombre } = preview
      const filas = data.filas

      const nuevos = []
      const actualizaciones = []
      for (const f of filas) {
        const existing = sitiosById.get(f.id_sitio_entrega)
        const sitioPayload = {
          localidad: f.localidad,
          proyecto_inversion: f.proyecto_inversion,
          nombre_institucion: f.nombre_institucion,
          sede_educativa: f.sede_educativa,
          sitio_entrega: f.sitio_entrega,
          nombre_descripcion: f.nombre_descripcion,
          jornada: f.jornada,
          horario_sugerido: f.horario_sugerido,
          direccion: f.direccion,
          barrio: f.barrio,
        }
        if (!existing) {
          nuevos.push({ id_sitio_entrega: f.id_sitio_entrega, ...sitioPayload, activo: true })
        } else {
          const patch = {}
          for (const [k, v] of Object.entries(sitioPayload)) {
            if (v != null && v !== '' && (existing[k] == null || existing[k] === '')) patch[k] = v
          }
          if (Object.keys(patch).length > 0) {
            patch.updated_at = new Date().toISOString()
            actualizaciones.push({ id: existing.id, patch })
          }
        }
      }

      if (nuevos.length > 0) {
        const { error: insError } = await supabase.from('reforzados_sitios').insert(nuevos)
        if (insError) throw insError
      }
      for (const a of actualizaciones) {
        const { error: updError } = await supabase.from('reforzados_sitios').update(a.patch).eq('id', a.id)
        if (updError) throw updError
      }

      const { error: delError } = await supabase.from('reforzados_base_suministro').delete().eq('fecha', fecha)
      if (delError) throw delError

      const rows = filas.map(f => ({
        fecha,
        id_sitio_entrega: f.id_sitio_entrega,
        tipo_a: f.tipo_a,
        tipo_b: f.tipo_b,
        tipo_c: f.tipo_c,
        tipo_d: f.tipo_d,
        tipo_n: f.tipo_n,
        muestra_tipo_1: f.muestra_tipo_1,
        muestra_tipo_2: f.muestra_tipo_2,
        dia_semana: f.dia_semana,
        crs: f.crs,
        observacion: f.observacion,
        proveedor: f.proveedor,
        archivo_nombre: archivoNombre,
      }))
      const { error: insBaseError } = await supabase.from('reforzados_base_suministro').insert(rows)
      if (insBaseError) throw insBaseError

      const totalUnidades = rows.reduce((sum, r) => sum + r.tipo_a + r.tipo_b + r.tipo_c + r.tipo_d + r.tipo_n + r.muestra_tipo_1 + r.muestra_tipo_2, 0)

      await Promise.all([fetchSitios(), fetchBases()])
      setPreview(null)
      setToast({ message: `Base de ${formatFechaLarga(fecha)} guardada: ${rows.length} sitios, ${totalUnidades.toLocaleString('es-CO')} unidades totales.`, type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo guardar la base de suministro.')
    } finally {
      setSaving(false)
    }
  }

  function askEliminar(fecha) {
    setConfirmAction({ type: 'eliminar', fecha })
  }

  async function handleConfirmActionRun() {
    if (!confirmAction) return
    setConfirmLoading(true)
    try {
      const { error } = await supabase.from('reforzados_base_suministro').delete().eq('fecha', confirmAction.fecha)
      if (error) throw error
      setToast({ message: `Base de ${formatFechaLarga(confirmAction.fecha)} eliminada`, type: 'success' })
      await fetchBases()
      setConfirmAction(null)
    } catch (err) {
      setErrorMsg('No se pudo eliminar la base de suministro.')
    } finally {
      setConfirmLoading(false)
    }
  }

  async function openDetalle(fecha) {
    setDetalleFecha(fecha)
    setDetalleFilas([])
    setDetalleLoading(true)
    const { data, error } = await supabase
      .from('reforzados_base_suministro')
      .select('*')
      .eq('fecha', fecha)
      .order('id_sitio_entrega')
    if (!error) setDetalleFilas(data || [])
    setDetalleLoading(false)
  }

  function closeDetalle() {
    setDetalleFecha(null)
    setDetalleFilas([])
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Base de Suministro" subtitle="Cargue diario de cantidades por sitio de entrega" />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="section-label">Cargar Base</div>
          <div className="dropzone">
            <div className="dropzone-icon">📤</div>
            <div className="dropzone-text">Subir Excel de Base de Suministro</div>
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
            <div className="dropzone-hint">Formato esperado: archivo diario tipo "15_Julio_Base_de_Suministro_..."</div>
          </div>

          <div className="section-label">Cargas Recientes</div>

          <div className="form-group bs-month-select">
            <label>Mes</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {monthsOptions.map(m => (
                <option key={m} value={m}>{mesLabel(m)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="empty-state"><p>Cargando bases de suministro...</p></div>
          ) : filteredBases.length === 0 ? (
            <div className="empty-state"><p>No hay bases de suministro cargadas para este mes.</p></div>
          ) : (
            filteredBases.map(b => (
              <div key={b.fecha} className="ciclo-card">
                <div className="ciclo-card-main">
                  <div className="ciclo-card-mes">{capitalize(formatFechaLarga(b.fecha))}</div>
                  <div className="ciclo-card-meta">
                    <span className="ciclo-card-dias">{b.sitios} sitios · {b.total.toLocaleString('es-CO')} unidades totales</span>
                  </div>
                  <div className="ciclo-card-meta">
                    <span className="badge badge-tipo1">Tipo 1: {b.tipo1.toLocaleString('es-CO')}</span>
                    <span className="badge badge-tipo2">Tipo 2: {b.tipo2.toLocaleString('es-CO')}</span>
                    {b.tipoN > 0 && <span className="badge">Tipo N: {b.tipoN.toLocaleString('es-CO')}</span>}
                  </div>
                </div>
                <div className="ciclo-card-actions">
                  <button className="btn-secondary" onClick={() => openDetalle(b.fecha)}>👁️ Ver detalle</button>
                  <button className="btn-danger" onClick={() => askEliminar(b.fecha)}>🗑️ Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {preview && (
        <BaseSuministroPreviewModal
          data={preview.data}
          archivoNombre={preview.archivoNombre}
          fechaDetectada={preview.fechaDetectada}
          basesExistentes={basesByFecha}
          sitiosById={sitiosById}
          onCancel={closePreview}
          onConfirm={handleConfirmUpload}
          saving={saving}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={`¿Eliminar la base de suministro del ${capitalize(formatFechaLarga(confirmAction.fecha))}?`}
          message="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onConfirm={handleConfirmActionRun}
          onCancel={() => !confirmLoading && setConfirmAction(null)}
          loading={confirmLoading}
        />
      )}

      {detalleFecha && (
        <BaseSuministroDetalleModal
          fecha={detalleFecha}
          filas={detalleFilas}
          sitiosById={sitiosById}
          loading={detalleLoading}
          onClose={closeDetalle}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
