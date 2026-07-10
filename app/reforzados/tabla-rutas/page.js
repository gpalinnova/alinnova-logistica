'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PageHeader from '../../../components/PageHeader'
import Toast from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'
import { todayLocalISO, formatFechaLarga } from '../../../lib/tablaWhatsappUtils'
import { buildTituloTabla, buildRutasData, buildRutasAsciiText } from '../../../lib/tablaRutasUtils'

export default function TablaRutasPage() {
  const [selectedDate, setSelectedDate] = useState(todayLocalISO())
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [sitios, setSitios] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const [asigLoading, setAsigLoading] = useState(false)
  const [baseRows, setBaseRows] = useState([])
  const [baseLoading, setBaseLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [copying, setCopying] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const tableRef = useRef(null)

  useEffect(() => {
    async function fetchInitial() {
      setLoadingInicial(true)
      const [{ data: sitiosData, error: sitiosError }, { data: rutaData, error: rutaError }, { data: fechaData }] = await Promise.all([
        supabase.from('reforzados_sitios').select('*'),
        supabase.from('reforzados_rutas_mes').select('*').eq('estado', 'activo').maybeSingle(),
        supabase.from('reforzados_base_suministro').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (sitiosError || rutaError) setErrorMsg('No se pudo cargar la información base.')
      setSitios(sitiosData || [])
      setRutaActiva(rutaData || null)
      setSelectedDate(fechaData?.fecha || todayLocalISO())
      setLoadingInicial(false)
    }
    fetchInitial()
  }, [])

  useEffect(() => {
    if (!rutaActiva) {
      setAsignaciones([])
      return
    }
    async function fetchAsignaciones() {
      setAsigLoading(true)
      const { data, error } = await supabase
        .from('reforzados_ruta_asignaciones')
        .select('*, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
        .eq('ruta_mes_id', rutaActiva.id)
      if (error) setErrorMsg('No se pudieron cargar las asignaciones de la ruta.')
      setAsignaciones(data || [])
      setAsigLoading(false)
    }
    fetchAsignaciones()
  }, [rutaActiva])

  useEffect(() => {
    if (!selectedDate) return
    async function fetchBase() {
      setBaseLoading(true)
      const { data, error } = await supabase.from('reforzados_base_suministro').select('*').eq('fecha', selectedDate)
      if (error) setErrorMsg('No se pudo cargar la base de suministro de esta fecha.')
      setBaseRows(data || [])
      setBaseLoading(false)
    }
    fetchBase()
  }, [selectedDate])

  const fechaDisplay = useMemo(() => formatFechaLarga(selectedDate), [selectedDate])
  const tituloTabla = useMemo(() => buildTituloTabla(selectedDate), [selectedDate])

  const rutaAplica = useMemo(() => {
    if (!rutaActiva) return false
    const [y, m] = selectedDate.split('-').map(Number)
    return rutaActiva.mes === m && rutaActiva.año === y
  }, [rutaActiva, selectedDate])

  const badges = useMemo(() => {
    const result = []
    if (rutaAplica) {
      result.push({ type: 'ok', text: `✅ Ruta activa: ${rutaActiva.nombre_mes}` })
    } else {
      result.push({ type: 'warn', text: '⚠️ No hay ruta activa para esta fecha. Ve a Rutas Maestro y activa una.' })
    }
    if (rutaAplica && !baseLoading && baseRows.length === 0) {
      result.push({ type: 'warn', text: `⚠️ No hay base de suministro cargada para ${fechaDisplay}. Ve a Base de Suministro y súbela.` })
    }
    return result
  }, [rutaAplica, rutaActiva, baseRows, baseLoading, fechaDisplay])

  const tableData = useMemo(() => {
    if (!rutaAplica || asignaciones.length === 0) return null
    const sitiosById = new Map(sitios.map(s => [s.id_sitio_entrega, s]))
    const baseByIdSitio = new Map(baseRows.map(b => [b.id_sitio_entrega, b]))
    return buildRutasData(asignaciones, sitiosById, baseByIdSitio)
  }, [rutaAplica, asignaciones, sitios, baseRows])

  const loading = loadingInicial || asigLoading || baseLoading
  const canExport = !loading && rutaAplica && baseRows.length > 0 && tableData && tableData.conductores.length > 0

  async function handleCopyText() {
    if (!canExport) return
    setCopying(true)
    try {
      const text = buildRutasAsciiText(tituloTabla, tableData.conductores, tableData.totalTipo1, tableData.totalTipo2)
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
      link.download = `Rutas_${selectedDate}.png`
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
      pdf.save(`Rutas_${selectedDate}.pdf`)
    } catch (err) {
      setToast({ message: 'No se pudo generar el PDF.', type: 'error' })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/reforzados"
          backLabel="Reforzados"
          title="Tabla de Rutas"
          subtitle="Genera el reporte diario de rutas del complemento reforzado"
        />
        <div className="page-content">
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="section-label">Selección de fecha</div>
          <div className="tw-date-card">
            <div className="form-group tw-date-group">
              <label htmlFor="rt-fecha">Fecha de entrega</label>
              <input
                id="rt-fecha"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="section-label">Estado</div>
          <div className="rt-status-badges">
            {badges.map((b, i) => (
              <div key={i} className={`ciclo-status-badge ciclo-status-${b.type}`}>{b.text}</div>
            ))}
          </div>

          <div className="section-label">Vista previa de la tabla</div>

          {loading ? (
            <div className="empty-state"><p>Cargando información...</p></div>
          ) : !rutaAplica ? (
            <div className="rt-status-card">
              <div className="rt-status-card-emoji">⚠️</div>
              <div className="rt-status-card-text">No hay ruta activa</div>
              <Link href="/reforzados/rutas" className="btn-primary">Ir a Rutas Maestro</Link>
            </div>
          ) : baseRows.length === 0 ? (
            <div className="rt-status-card">
              <div className="rt-status-card-emoji">⚠️</div>
              <div className="rt-status-card-text">Base de suministro no cargada para {fechaDisplay}</div>
              <Link href="/reforzados/base-suministro" className="btn-primary">Ir a Base de Suministro</Link>
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="empty-state"><p>La ruta activa no tiene asignaciones.</p></div>
          ) : (
            <div className="rutas-table-wrap">
              <div className="rt-export-wrap" ref={tableRef}>
                <div className="rt-titulo">{tituloTabla}</div>
                <table className="rutas-table">
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th>Placa</th>
                      <th>Cargue Alinnova</th>
                      <th>Id Sitio</th>
                      <th>Nombre y/o Descripción Sitio</th>
                      <th>Dirección</th>
                      <th>Horario Sugerido Compensar</th>
                      <th>Horario Entrega Alinnova</th>
                      <th>Orden</th>
                      <th>Total Tipo 1</th>
                      <th>Total Tipo 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.conductores.map(c => (
                      <Fragment key={c.repartidorId}>
                        {c.filas.map((f, i) => (
                          <tr key={f.asignacionId}>
                            {i === 0 && (
                              <>
                                <td rowSpan={c.filas.length} className="rt-conductor-cell">
                                  <div>CONDUCTOR: {c.conductor}</div>
                                  <div>AUXILIAR: {c.auxiliar}</div>
                                </td>
                                <td rowSpan={c.filas.length}>{c.placa}</td>
                                <td rowSpan={c.filas.length}>{c.cargueAlinnova || '-'}</td>
                              </>
                            )}
                            <td>{f.idSitio}</td>
                            <td>{f.nombreDescripcion}</td>
                            <td>{f.direccion}</td>
                            <td>{f.horarioSugerido}</td>
                            <td>{f.horarioEntregaAlinnova}</td>
                            <td>{f.orden}{f.sinBase ? ' ⚠️' : ''}</td>
                            <td>{f.sinBase ? '-' : f.tipo1}</td>
                            <td>{f.sinBase ? '-' : f.tipo2}</td>
                          </tr>
                        ))}
                        <tr className="rt-subtotal-row">
                          <td colSpan={9}>SUBTOTAL {c.conductor}</td>
                          <td>{c.subtotalTipo1}</td>
                          <td>{c.subtotalTipo2}</td>
                        </tr>
                      </Fragment>
                    ))}
                    <tr className="rt-total-row">
                      <td colSpan={9}>TOTAL GENERAL</td>
                      <td>{tableData.totalTipo1}</td>
                      <td>{tableData.totalTipo2}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
