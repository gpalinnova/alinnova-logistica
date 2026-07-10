'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import MenuDelDia from '../../../components/MenuDelDia'
import RutaDelDia from '../../../components/RutaDelDia'
import InterventoriaDia from '../../../components/InterventoriaDia'
import { supabase } from '../../../lib/supabase'
import { todayLocalISO, formatFechaLarga } from '../../../lib/tablaWhatsappUtils'

export default function EnvioDelDiaPage() {
  const [selectedDate, setSelectedDate] = useState(null)
  const [menuStatus, setMenuStatus] = useState(null)
  const [rutaStatus, setRutaStatus] = useState(null)

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

  const handleDateChange = useCallback(e => {
    setMenuStatus(null)
    setRutaStatus(null)
    setSelectedDate(e.target.value)
  }, [])

  const fechaDisplay = useMemo(() => (selectedDate ? formatFechaLarga(selectedDate) : ''), [selectedDate])

  const badges = useMemo(() => {
    if (!menuStatus || !rutaStatus) return []
    const result = []
    if (!menuStatus.cicloActivo) result.push({ type: 'warn', text: '⚠️ No hay ciclo activo. Ve a Ciclos Maestro.' })
    if (!rutaStatus.rutaActiva) result.push({ type: 'warn', text: '⚠️ No hay ruta activa para esta fecha.' })
    if (!rutaStatus.baseSuministro) result.push({ type: 'warn', text: `⚠️ No hay base de suministro cargada para ${fechaDisplay}.` })
    if (result.length === 0) result.push({ type: 'ok', text: '✅ Datos listos' })
    return result
  }, [menuStatus, rutaStatus, fechaDisplay])

  if (!selectedDate) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <PageHeader
            backHref="/reforzados"
            backLabel="Reforzados"
            title="Envío del Día"
            subtitle="Reporte diario listo para captura de pantalla"
          />
          <div className="page-content">
            <div className="empty-state"><p>Cargando información...</p></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/reforzados"
          backLabel="Reforzados"
          title="Envío del Día"
          subtitle="Reporte diario listo para captura de pantalla"
        />
        <div className="page-content">
          <div className="section-label">Selección de fecha</div>
          <div className="tw-date-card">
            <div className="form-group tw-date-group">
              <label htmlFor="ed-fecha">Fecha de entrega</label>
              <input
                id="ed-fecha"
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
              />
            </div>
          </div>

          {badges.length > 0 && (
            <div className="rt-status-badges">
              {badges.map((b, i) => (
                <div key={i} className={`ciclo-status-badge ciclo-status-${b.type}`}>{b.text}</div>
              ))}
            </div>
          )}

          <div className="section-label">Bloques del día</div>

          <div className="envio-bloque">
            <div className="envio-bloque-header">🍽️ Menú del Día</div>
            <MenuDelDia fecha={selectedDate} onStatus={setMenuStatus} />
          </div>

          <div className="envio-bloque-separator" />

          <div className="envio-bloque envio-bloque-ancho">
            <div className="envio-bloque-header">🚛 Ruta del Día</div>
            <RutaDelDia fecha={selectedDate} onStatus={setRutaStatus} />
          </div>

          <div className="envio-bloque-separator" />

          <div className="envio-bloque">
            <div className="envio-bloque-header">🔍 Interventoría</div>
            <InterventoriaDia fecha={selectedDate} />
          </div>
        </div>
      </main>
    </div>
  )
}
