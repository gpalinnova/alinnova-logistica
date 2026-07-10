'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import Toast from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'
import {
  todayLocalISO,
  addDaysISO,
  formatFechaLarga,
  buildFilasTabla,
  buildWhatsappText,
} from '../../../lib/tablaWhatsappUtils'

export default function TablaWhatsappPage() {
  const [selectedDate, setSelectedDate] = useState(() => addDaysISO(todayLocalISO(), 1))
  const [productos, setProductos] = useState([])
  const [productosLoading, setProductosLoading] = useState(true)
  const [activeCiclo, setActiveCiclo] = useState(null)
  const [cicloDia, setCicloDia] = useState(null)
  const [diaLoading, setDiaLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [copying, setCopying] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const tableRef = useRef(null)

  useEffect(() => {
    async function fetchInitial() {
      setProductosLoading(true)
      const [{ data: prodData, error: prodError }, { data: cicloData, error: cicloError }] = await Promise.all([
        supabase.from('reforzados_productos').select('*'),
        supabase.from('reforzados_ciclos').select('*').eq('estado', 'activo').maybeSingle(),
      ])
      if (prodError) setErrorMsg('No se pudo cargar el catálogo de productos.')
      setProductos(prodData || [])
      if (!cicloError) setActiveCiclo(cicloData || null)
      setProductosLoading(false)
    }
    fetchInitial()
  }, [])

  useEffect(() => {
    async function fetchDia() {
      setDiaLoading(true)
      const { data, error } = await supabase
        .from('reforzados_ciclo_dias')
        .select('*, ciclo:reforzados_ciclos(id, nombre_mes, estado)')
        .eq('fecha', selectedDate)
        .limit(1)
        .maybeSingle()
      if (error) {
        setErrorMsg('No se pudo cargar la información del ciclo para esta fecha.')
        setCicloDia(null)
      } else {
        setCicloDia(data || null)
        setErrorMsg('')
      }
      setDiaLoading(false)
    }
    fetchDia()
  }, [selectedDate])

  const fechaDisplay = useMemo(() => formatFechaLarga(selectedDate), [selectedDate])

  const filas = useMemo(() => {
    if (!cicloDia || cicloDia.festivo) return []
    return buildFilasTabla(cicloDia, productos)
  }, [cicloDia, productos])

  const badge = useMemo(() => {
    if (!activeCiclo) {
      return { type: 'error', text: '❌ No hay ningún ciclo activo. Ve a Ciclos y activa uno.' }
    }
    if (cicloDia && cicloDia.ciclo?.id === activeCiclo.id) {
      return { type: 'ok', text: `✅ Ciclo activo: ${activeCiclo.nombre_mes}` }
    }
    return {
      type: 'warn',
      text: `⚠️ La fecha no coincide con el ciclo activo (${activeCiclo.nombre_mes}). Selecciona otra fecha o carga el ciclo correspondiente.`,
    }
  }, [activeCiclo, cicloDia])

  const loading = productosLoading || diaLoading

  async function handleCopyText() {
    if (!cicloDia || cicloDia.festivo || filas.length === 0) return
    setCopying(true)
    try {
      const text = buildWhatsappText(fechaDisplay, cicloDia.menu_numero, filas)
      await navigator.clipboard.writeText(text)
      setToast({ message: 'Tabla copiada como texto', type: 'success' })
    } catch (err) {
      setToast({ message: 'No se pudo copiar el texto.', type: 'error' })
    } finally {
      setCopying(false)
    }
  }

  async function handleDownloadImage() {
    if (!tableRef.current) return
    setExportingImage(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(tableRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `tabla-whatsapp-${selectedDate}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      setToast({ message: 'No se pudo generar la imagen.', type: 'error' })
    } finally {
      setExportingImage(false)
    }
  }

  async function handleDownloadPdf() {
    if (!tableRef.current) return
    setExportingPdf(true)
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
      const node = tableRef.current
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const { width, height } = node.getBoundingClientRect()
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [width, height],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height)
      pdf.save(`tabla-whatsapp-${selectedDate}.pdf`)
    } catch (err) {
      setToast({ message: 'No se pudo generar el PDF.', type: 'error' })
    } finally {
      setExportingPdf(false)
    }
  }

  const canExport = !loading && cicloDia && !cicloDia.festivo && filas.length > 0

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/reforzados"
          backLabel="Reforzados"
          title="Menú del Día"
          subtitle="Genera la tabla diaria del complemento reforzado para enviar al grupo"
        />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="section-label">Selección de fecha</div>
          <div className="tw-date-card">
            <div className="form-group tw-date-group">
              <label htmlFor="tw-fecha">Fecha de entrega</label>
              <input
                id="tw-fecha"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            <div className={`ciclo-status-badge ciclo-status-${badge.type}`}>{badge.text}</div>
          </div>

          <div className="section-label">Vista previa de la tabla</div>

          {loading ? (
            <div className="empty-state"><p>Cargando información...</p></div>
          ) : cicloDia?.festivo ? (
            <div className="festivo-card">
              <div className="festivo-emoji">🎉</div>
              <div className="festivo-text">FESTIVO — No hay entrega este día</div>
            </div>
          ) : !cicloDia ? (
            <div className="empty-state"><p>No hay información de ciclo para esta fecha</p></div>
          ) : (
            <div className="whatsapp-table-wrap">
              <table className="whatsapp-table" ref={tableRef}>
                <tbody>
                  <tr>
                    <td colSpan={3} className="wt-header">PROVEEDOR ALINNOVA</td>
                  </tr>
                  <tr>
                    <td className="wt-subtitle">{fechaDisplay}</td>
                    <td className="wt-subtitle">MENU {cicloDia.menu_numero ?? '-'}</td>
                    <td className="wt-subtitle">Embalaje por Componente</td>
                  </tr>
                  {filas.map(fila => (
                    <tr key={fila.key}>
                      <td className="wt-componente">{fila.label}</td>
                      <td className="wt-producto">{fila.nombreDisplay}</td>
                      <td className="wt-empaque">
                        {fila.empaqueLines.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="section-label">Acciones</div>
          <div className="tw-actions">
            <button className="btn-tw-action" onClick={handleCopyText} disabled={!canExport || copying}>
              📋 {copying ? 'Copiando...' : 'Copiar como texto'}
            </button>
            <button className="btn-tw-action" onClick={handleDownloadImage} disabled={!canExport || exportingImage}>
              📸 {exportingImage ? 'Generando...' : 'Descargar como imagen'}
            </button>
            <button className="btn-tw-action" onClick={handleDownloadPdf} disabled={!canExport || exportingPdf}>
              📄 {exportingPdf ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
