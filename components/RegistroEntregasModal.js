'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayLocalISO, formatFechaLarga } from '../lib/tablaWhatsappUtils'
import { getLinksRegistroEntregas } from '../lib/entregasActions'

export default function RegistroEntregasModal({ onClose }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [rutaActiva, setRutaActiva] = useState(true)
  const [links, setLinks] = useState([])
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    async function fetchDefaultDate() {
      const { data } = await supabase
        .from('reforzados_base_suministro')
        .select('fecha')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      setSelectedDate(data?.fecha || todayLocalISO())
    }
    fetchDefaultDate()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let active = true
    async function fetchLinks() {
      setLoading(true)
      setErrorMsg('')
      try {
        const result = await getLinksRegistroEntregas(selectedDate)
        if (!active) return
        setRutaActiva(result.rutaActiva)
        setLinks(result.links)
      } catch (err) {
        if (!active) return
        setErrorMsg('No se pudieron generar los links de registro.')
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchLinks()
    return () => { active = false }
  }, [selectedDate])

  const handleCopy = useCallback(async (url, id) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(current => (current === id ? null : current)), 2000)
    } catch (err) {
      setErrorMsg('No se pudo copiar el link. Copia manualmente desde el campo.')
    }
  }, [])

  const fechaDisplay = selectedDate ? formatFechaLarga(selectedDate) : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Links de registro para el día {fechaDisplay}</div>

        <div className="form-group">
          <label htmlFor="reg-entregas-fecha">Fecha de entrega</label>
          <input
            id="reg-entregas-fecha"
            type="date"
            value={selectedDate || ''}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="empty-state"><p>Generando links...</p></div>
        ) : errorMsg ? (
          <div className="form-error-banner">{errorMsg}</div>
        ) : !rutaActiva ? (
          <div className="rt-status-card">
            <div className="rt-status-card-emoji">⚠️</div>
            <div className="rt-status-card-text">No hay ruta activa</div>
          </div>
        ) : links.length === 0 ? (
          <div className="empty-state"><p>No hay conductores con entregas para esta fecha.</p></div>
        ) : (
          <div className="registro-links-list">
            {links.map(l => (
              <div key={l.repartidorId} className="registro-link-item">
                <div className="registro-link-info">
                  <div className="registro-link-conductor">{l.conductor}</div>
                  <div className="registro-link-placa">{l.placa}{l.auxiliar ? ` · ${l.auxiliar}` : ''}</div>
                </div>
                <div className="registro-link-url-row">
                  <input type="text" className="registro-link-url" value={l.url || ''} readOnly />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleCopy(l.url, l.repartidorId)}
                    disabled={!l.url}
                  >
                    {copiedId === l.repartidorId ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
