'use client'

import { useCallback, useEffect, useState } from 'react'
import { todayLocalISO } from '../lib/tablaWhatsappUtils'
import { getRegistroUniversal, regenerarRegistroUniversalAction } from '../lib/entregasActions'
import { fetchReporteConductoresDia, fetchRegistroEntregasConductores } from '../lib/registroEntregasCalc'
import { generateRegistroEntregasPDF } from '../lib/registroEntregasPdf'

export default function RegistroEntregasModal({ onClose }) {
  const [link, setLink] = useState(null)
  const [loadingLink, setLoadingLink] = useState(true)
  const [regenerando, setRegenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [selectedDate, setSelectedDate] = useState(todayLocalISO())
  const [reporte, setReporte] = useState({ loading: true, conductores: [], totalEntregas: 0, totalConductoresActivos: 0 })
  const [generandoPdf, setGenerandoPdf] = useState(false)

  useEffect(() => {
    let active = true
    async function fetchLink() {
      setLoadingLink(true)
      try {
        const result = await getRegistroUniversal()
        if (!active) return
        setLink(result)
      } catch (err) {
        if (!active) return
        setErrorMsg('No se pudo cargar el link universal.')
      } finally {
        if (active) setLoadingLink(false)
      }
    }
    fetchLink()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function fetchReporte() {
      setReporte(r => ({ ...r, loading: true }))
      try {
        const data = await fetchReporteConductoresDia(selectedDate)
        if (!active) return
        setReporte({ loading: false, ...data })
      } catch (err) {
        if (!active) return
        setReporte({ loading: false, conductores: [], totalEntregas: 0, totalConductoresActivos: 0 })
      }
    }
    fetchReporte()
    return () => { active = false }
  }, [selectedDate])

  const handleCopy = useCallback(async () => {
    if (!link?.url) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch (err) {
      setErrorMsg('No se pudo copiar el link. Copia manualmente desde el campo.')
    }
  }, [link])

  async function handleRegenerar() {
    const confirmado = window.confirm('Esto invalidará el link actual. Los conductores necesitarán el nuevo. ¿Continuar?')
    if (!confirmado) return
    setRegenerando(true)
    setErrorMsg('')
    try {
      const nuevo = await regenerarRegistroUniversalAction()
      setLink(nuevo)
    } catch (err) {
      setErrorMsg('No se pudo regenerar el link.')
    } finally {
      setRegenerando(false)
    }
  }

  async function handleDownloadPdf() {
    if (reporte.totalEntregas === 0 || generandoPdf) return
    setGenerandoPdf(true)
    try {
      const conductoresDetalle = await fetchRegistroEntregasConductores(selectedDate)
      const { doc } = generateRegistroEntregasPDF(conductoresDetalle, { fechaISO: selectedDate })
      doc.save(`registro_entregas_${selectedDate}.pdf`)
    } catch (err) {
      setErrorMsg('No se pudo generar el PDF del reporte.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Registro de entregas</div>

        {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

        <div className="registro-reporte-block">
          <div className="registro-reporte-titulo">Link universal para conductores</div>
          {loadingLink ? (
            <div className="empty-state"><p>Cargando link...</p></div>
          ) : !link ? (
            <div className="rt-status-card">
              <div className="rt-status-card-emoji">⚠️</div>
              <div className="rt-status-card-text">No hay link universal activo</div>
            </div>
          ) : (
            <>
              <div className="registro-link-url-row">
                <input type="text" className="registro-link-url" value={link.url} readOnly />
              </div>
              <div className="registro-universal-actions">
                <button type="button" className="btn-secondary" onClick={handleCopy}>
                  {copiado ? '✅ Copiado' : '📋 Copiar link'}
                </button>
                <button type="button" className="btn-secondary" onClick={handleRegenerar} disabled={regenerando}>
                  {regenerando ? 'Regenerando...' : '🔄 Regenerar link'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="reg-entregas-fecha">Reporte del día</label>
          <input
            id="reg-entregas-fecha"
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="registro-reporte-block">
          <div className="registro-reporte-titulo">Reporte consolidado por conductor</div>
          <div className="registro-reporte-contador">
            {reporte.totalEntregas} entrega{reporte.totalEntregas === 1 ? '' : 's'} registrada{reporte.totalEntregas === 1 ? '' : 's'} · {reporte.totalConductoresActivos} conductor{reporte.totalConductoresActivos === 1 ? '' : 'es'} activo{reporte.totalConductoresActivos === 1 ? '' : 's'}
          </div>

          {reporte.loading ? (
            <div className="empty-state"><p>Cargando reporte...</p></div>
          ) : reporte.conductores.length === 0 ? (
            <div className="registro-reporte-aviso">Aún no hay entregas registradas para esta fecha</div>
          ) : (
            <div className="registro-conductores-list">
              {reporte.conductores.map(c => (
                <div key={c.repartidorId} className="registro-conductor-item">
                  <div className="registro-conductor-info">
                    <div className="registro-link-conductor">{c.conductor}</div>
                    <div className="registro-link-placa">{c.entregados} de {c.total} entregas</div>
                  </div>
                  <div className="entregas-progreso-bar">
                    <div className="entregas-progreso-bar-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn-generate-pdf registro-reporte-btn"
            onClick={handleDownloadPdf}
            disabled={reporte.loading || reporte.totalEntregas === 0 || generandoPdf}
          >
            {generandoPdf ? 'Generando PDF...' : '📄 Descargar PDF del día'}
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
