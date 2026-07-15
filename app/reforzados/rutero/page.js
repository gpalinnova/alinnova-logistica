'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import Toast from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'
import { todayLocalISO } from '../../../lib/tablaWhatsappUtils'
import { buildMenuDelDia, buildRuteroConductores, buildSitiosSinAsignar } from '../../../lib/ruteroCalc'
import { generateRuteroPDF, fmtFechaCorta } from '../../../lib/ruteroPdf'

export default function RuteroPage() {
  const [selectedDate, setSelectedDate] = useState(null)
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [loadingDia, setLoadingDia] = useState(false)
  const [sitiosMaestro, setSitiosMaestro] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [productos, setProductos] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [baseRows, setBaseRows] = useState([])
  const [cicloDia, setCicloDia] = useState(null)
  const [overridesEmbalaje, setOverridesEmbalaje] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [generando, setGenerando] = useState(false)
  const [toast, setToast] = useState(null)
  const [sinAsignarOpen, setSinAsignarOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const [{ data: fechaRow }, { data: sitiosData }, { data: productosData }, { data: rutaData }] = await Promise.all([
        supabase.from('reforzados_base_suministro').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('reforzados_sitios').select('*'),
        supabase.from('reforzados_productos').select('*'),
        supabase.from('reforzados_rutas_mes').select('*').eq('estado', 'activo').maybeSingle(),
      ])
      setSitiosMaestro(sitiosData || [])
      setProductos(productosData || [])
      setRutaActiva(rutaData || null)

      if (rutaData) {
        const { data: asigData } = await supabase
          .from('reforzados_ruta_asignaciones')
          .select('*, repartidor:reforzados_repartidores(conductor, placa, auxiliar)')
          .eq('ruta_mes_id', rutaData.id)
        setAsignaciones(asigData || [])
      }

      setSelectedDate(fechaRow?.fecha || todayLocalISO())
      setLoadingInicial(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let active = true
    async function fetchDia() {
      setLoadingDia(true)
      const [{ data: base, error: baseError }, { data: ciclo }, { data: overrides }] = await Promise.all([
        supabase.from('reforzados_base_suministro').select('*').eq('fecha', selectedDate).gt('total', 0),
        supabase
          .from('reforzados_ciclo_dias')
          .select('*, ciclo:reforzados_ciclos!inner(estado)')
          .eq('fecha', selectedDate)
          .eq('ciclo.estado', 'activo')
          .maybeSingle(),
        supabase.from('reforzados_override_embalaje_dia').select('*').eq('fecha', selectedDate),
      ])
      if (!active) return
      setBaseRows(base || [])
      setCicloDia(ciclo || null)
      setOverridesEmbalaje(overrides || [])
      setErrorMsg(baseError ? 'No se pudo cargar la base de suministro.' : (!base || base.length === 0 ? 'No hay base de suministro cargada para esta fecha.' : ''))
      setLoadingDia(false)
    }
    fetchDia()
    return () => { active = false }
  }, [selectedDate])

  const sitiosById = useMemo(() => new Map(sitiosMaestro.map(s => [s.id_sitio_entrega, s])), [sitiosMaestro])
  const baseByIdSitio = useMemo(() => new Map(baseRows.map(b => [b.id_sitio_entrega, b])), [baseRows])
  const overridesByProductoId = useMemo(
    () => new Map(overridesEmbalaje.map(o => [o.embalaje_ref, o.unidades_por_canastilla])),
    [overridesEmbalaje]
  )
  const menuDelDia = useMemo(
    () => buildMenuDelDia(cicloDia, productos, overridesByProductoId),
    [cicloDia, productos, overridesByProductoId]
  )
  const conductores = useMemo(
    () => buildRuteroConductores(asignaciones, sitiosById, baseByIdSitio, menuDelDia),
    [asignaciones, sitiosById, baseByIdSitio, menuDelDia]
  )
  const sinAsignar = useMemo(
    () => buildSitiosSinAsignar(baseRows, asignaciones, sitiosById),
    [baseRows, asignaciones, sitiosById]
  )

  const resumen = useMemo(() => {
    const totalSitiosAsignados = conductores.reduce((s, c) => s + c.filas.length, 0)
    const totalUnidadesAsignadas = conductores.reduce((s, c) => s + c.totales.total, 0)
    const sinAsignarUnidades = sinAsignar.reduce((s, r) => s + r.total, 0)
    return {
      conductoresCount: conductores.length,
      totalSitios: totalSitiosAsignados + sinAsignar.length,
      totalUnidades: totalUnidadesAsignadas + sinAsignarUnidades,
      sinAsignarCount: sinAsignar.length,
      sinAsignarUnidades,
    }
  }, [conductores, sinAsignar])

  async function handleGenerate() {
    if (conductores.length === 0 || generando) return
    setGenerando(true)
    try {
      const { doc } = generateRuteroPDF(conductores, { fechaISO: selectedDate, menuDelDia })
      doc.save(`Rutero_Alinnova_${selectedDate}.pdf`)
      setToast({ message: `PDF generado con ${conductores.length} conductor${conductores.length === 1 ? '' : 'es'}.`, type: 'success' })
    } catch (err) {
      setToast({ message: 'No se pudo generar el PDF del rutero.', type: 'error' })
    } finally {
      setGenerando(false)
    }
  }

  if (loadingInicial || !selectedDate) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Rutero" subtitle="Generación automática del rutero por conductor" />
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
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Rutero" subtitle="Generación automática del rutero por conductor" />
        <div className="page-content">
          <div className="section-label">Selección de fecha</div>
          <div className="tw-date-card">
            <div className="form-group tw-date-group">
              <label htmlFor="rut-fecha">Fecha de entrega</label>
              <input
                id="rut-fecha"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {!rutaActiva && <div className="form-error-banner">No hay ninguna ruta activa. Activa una ruta en Rutas para poder generar el rutero.</div>}
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}
          {rutaActiva && !cicloDia && !loadingDia && (
            <div className="form-error-banner">No hay menú del ciclo activo definido para esta fecha. Las canastillas se calcularán en 0.</div>
          )}

          <div className="section-label">Menú del día</div>
          {!menuDelDia ? (
            <div className="empty-state"><p>Sin menú detectado para esta fecha.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Menú</th>
                    <th>Bebida</th>
                    <th>Cereal Tipo 1 &quot;Pequeño&quot;</th>
                    <th>Cereal Tipo 2 &quot;Grande&quot;</th>
                    <th>Fruta</th>
                    <th>Postre</th>
                    <th>N/A</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{menuDelDia.menuNumero ?? '-'}</td>
                    <td>{menuDelDia.bebida?.nombre || '-'}</td>
                    <td>{menuDelDia.cereal1?.nombre || '-'}</td>
                    <td>{menuDelDia.cereal2?.nombre || '-'}</td>
                    <td>{menuDelDia.fruta?.nombre || '-'}</td>
                    <td>{menuDelDia.postre?.nombre || '-'}</td>
                    <td>{menuDelDia.agua?.nombre || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {resumen.sinAsignarCount > 0 && (
            <div className="rutero-warning-banner">
              ⚠ {resumen.sinAsignarCount} sitio{resumen.sinAsignarCount === 1 ? '' : 's'} sin ruta asignada · {resumen.sinAsignarUnidades.toLocaleString('es-CO')} unidades sin conductor. Asígnalos en Data Maestra → Rutas antes de imprimir el rutero.
            </div>
          )}

          <div className="section-label">Resumen</div>
          <div className="rem-stats-row">
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumen.conductoresCount}</div>
              <div className="rem-stat-label">Conductores con asignaciones</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumen.totalSitios}</div>
              <div className="rem-stat-label">Total sitios</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumen.totalUnidades.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Total unidades a repartir</div>
            </div>
          </div>

          <div className="section-label">Conductores</div>
          {loadingDia ? (
            <div className="empty-state"><p>Cargando información del día...</p></div>
          ) : conductores.length === 0 && resumen.sinAsignarCount === 0 ? (
            <div className="empty-state"><p>No hay conductores con entregas para esta fecha.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Conductor</th>
                    <th>Placa</th>
                    <th style={{ textAlign: 'center' }}>Sitios</th>
                    <th style={{ textAlign: 'center' }}>Total unidades</th>
                    <th style={{ textAlign: 'center' }}>Total canastillas</th>
                  </tr>
                </thead>
                <tbody>
                  {conductores.map(c => (
                    <tr key={c.repartidorId}>
                      <td>{c.conductor}</td>
                      <td>{c.placa}</td>
                      <td style={{ textAlign: 'center' }}>{c.filas.length}</td>
                      <td style={{ textAlign: 'center' }}>{c.totales.total.toLocaleString('es-CO')}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.totales.totalCanastas}</td>
                    </tr>
                  ))}
                  {resumen.sinAsignarCount > 0 && (
                    <>
                      <tr
                        className="row-sin-asignar"
                        onClick={() => setSinAsignarOpen(o => !o)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td colSpan={2}>{sinAsignarOpen ? '▾' : '▸'} ⚠ SIN ASIGNAR</td>
                        <td style={{ textAlign: 'center' }}>{resumen.sinAsignarCount}</td>
                        <td style={{ textAlign: 'center' }}>{resumen.sinAsignarUnidades.toLocaleString('es-CO')}</td>
                        <td style={{ textAlign: 'center' }}>-</td>
                      </tr>
                      {sinAsignarOpen && sinAsignar.map(s => (
                        <tr key={s.idSitio} className="row-sin-asignar-detail">
                          <td colSpan={5}>{s.idSitio} — {s.nombreInstitucion}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="rem-actions">
            <button className="btn-generate-pdf" onClick={handleGenerate} disabled={conductores.length === 0 || generando}>
              {generando ? 'Generando PDF...' : '📄 Generar PDF del Rutero'}
            </button>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
