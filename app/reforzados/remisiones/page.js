'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import Toast from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'
import { todayLocalISO } from '../../../lib/tablaWhatsappUtils'
import { generateRemisionesPDF, fmtFechaCorta } from '../../../lib/remisionesPdf'

function buildSitiosARemisionar(baseRows, sitiosById) {
  const list = baseRows.map(b => {
    const s = sitiosById.get(b.id_sitio_entrega) || {}
    const total = (b.tipo_a || 0) + (b.tipo_b || 0) + (b.tipo_c || 0) + (b.tipo_d || 0) + (b.muestra_tipo_1 || 0) + (b.muestra_tipo_2 || 0)
    return {
      id_sitio_entrega: b.id_sitio_entrega,
      nombre_institucion: s.nombre_institucion || `Sitio ${b.id_sitio_entrega} (sin datos maestro)`,
      nombre_descripcion: s.nombre_descripcion,
      sede_educativa: s.sede_educativa,
      sitio_entrega: s.sitio_entrega,
      localidad: s.localidad,
      jornada: s.jornada,
      horario_sugerido: s.horario_sugerido,
      direccion: s.direccion,
      barrio: s.barrio,
      observacion: b.observacion,
      tipo_a: b.tipo_a || 0,
      tipo_b: b.tipo_b || 0,
      tipo_c: b.tipo_c || 0,
      tipo_d: b.tipo_d || 0,
      muestra_tipo_1: b.muestra_tipo_1 || 0,
      muestra_tipo_2: b.muestra_tipo_2 || 0,
      total,
      incompleto: !s.nombre_institucion || !s.direccion || !s.barrio,
    }
  }).filter(r => r.total > 0)

  list.sort((a, b) => {
    const n = (a.nombre_institucion || '').localeCompare(b.nombre_institucion || '', 'es')
    if (n !== 0) return n
    return (a.id_sitio_entrega || 0) - (b.id_sitio_entrega || 0)
  })
  return list
}

export default function RemisionesPage() {
  const [selectedDate, setSelectedDate] = useState(null)
  const [sitiosMaestro, setSitiosMaestro] = useState([])
  const [baseRows, setBaseRows] = useState([])
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [loadingBase, setLoadingBase] = useState(false)
  const [numeroInicial, setNumeroInicial] = useState(1)
  const [proyecto, setProyecto] = useState('8060')
  const [generando, setGenerando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function init() {
      const [{ data: fechaRow }, { data: sitiosData }, { data: ultimaGen }] = await Promise.all([
        supabase.from('reforzados_base_suministro').select('fecha').order('fecha', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('reforzados_sitios').select('*'),
        supabase.from('reforzados_remisiones_generadas').select('numero_final').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      setSitiosMaestro(sitiosData || [])
      setNumeroInicial(ultimaGen?.numero_final ? ultimaGen.numero_final + 1 : 1)
      setSelectedDate(fechaRow?.fecha || todayLocalISO())
      setLoadingInicial(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    let active = true
    async function fetchBase() {
      setLoadingBase(true)
      const { data, error } = await supabase.from('reforzados_base_suministro').select('*').eq('fecha', selectedDate)
      if (!active) return
      setBaseRows(data || [])
      setErrorMsg(error ? 'No se pudo cargar la base de suministro.' : (!data || data.length === 0 ? 'No hay base de suministro cargada para esta fecha.' : ''))
      setLoadingBase(false)
    }
    fetchBase()
    return () => { active = false }
  }, [selectedDate])

  const sitiosById = useMemo(() => new Map(sitiosMaestro.map(s => [s.id_sitio_entrega, s])), [sitiosMaestro])

  const sitiosARemisionar = useMemo(() => buildSitiosARemisionar(baseRows, sitiosById), [baseRows, sitiosById])

  const sitiosIncompletos = useMemo(() => sitiosARemisionar.filter(s => s.incompleto), [sitiosARemisionar])

  const resumen = useMemo(() => {
    const r = { sitios: sitiosARemisionar.length, tipoA: 0, tipoB: 0, tipoC: 0, tipoD: 0, totalUnidades: 0 }
    sitiosARemisionar.forEach(s => {
      r.tipoA += s.tipo_a
      r.tipoB += s.tipo_b
      r.tipoC += s.tipo_c
      r.tipoD += s.tipo_d
      r.totalUnidades += s.total
    })
    return r
  }, [sitiosARemisionar])

  async function handleGenerate() {
    if (sitiosARemisionar.length === 0 || generando) return
    setGenerando(true)
    try {
      const result = generateRemisionesPDF(sitiosARemisionar, {
        numeroInicial: Number(numeroInicial) || 1,
        fechaEmisionISO: selectedDate,
        fechaEntregaISO: selectedDate,
      })

      const { error } = await supabase.from('reforzados_remisiones_generadas').insert({
        fecha_entrega: selectedDate,
        fecha_emision: selectedDate,
        numero_inicial: Number(numeroInicial) || 1,
        numero_final: result.numeroFinal,
        cantidad_remisiones: result.cantidad,
        total_unidades: result.totalUnidades,
        total_valor: result.totalValor,
        proyecto,
      })
      if (error) throw error

      result.doc.save(`Remisiones_Alinnova_${selectedDate}.pdf`)
      setToast({ message: `PDF generado con ${result.cantidad} remisiones.`, type: 'success' })
      setNumeroInicial(result.numeroFinal + 1)
    } catch (err) {
      setToast({ message: 'No se pudo generar el PDF de remisiones.', type: 'error' })
    } finally {
      setGenerando(false)
    }
  }

  if (loadingInicial || !selectedDate) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Remisiones" subtitle="Generación automática de remisiones del día" />
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
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Remisiones" subtitle="Generación automática de remisiones del día" />
        <div className="page-content">
          <div className="section-label">Selección de fecha</div>
          <div className="tw-date-card">
            <div className="form-group tw-date-group">
              <label htmlFor="rem-fecha">Fecha de entrega</label>
              <input
                id="rem-fecha"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          <div className="section-label">Configuración</div>
          <div className="rem-config-card">
            <div className="rem-config-row">
              <div className="form-group">
                <label htmlFor="rem-numero">Número inicial de remisión</label>
                <input
                  id="rem-numero"
                  type="number"
                  min="1"
                  value={numeroInicial}
                  onChange={e => setNumeroInicial(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="rem-fecha-emision">Fecha de emisión</label>
                <input id="rem-fecha-emision" type="text" value={fmtFechaCorta(selectedDate)} readOnly style={{ opacity: 0.7 }} />
              </div>
              <div className="form-group">
                <label htmlFor="rem-proyecto">Proyecto / Contrato</label>
                <input
                  id="rem-proyecto"
                  type="text"
                  value={proyecto}
                  onChange={e => setProyecto(e.target.value)}
                  placeholder="Código proyecto"
                />
              </div>
            </div>
          </div>

          <div className="section-label">Resumen de la base</div>
          <div className="rem-stats-row">
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumen.sitios}</div>
              <div className="rem-stat-label">Sitios con entregas</div>
            </div>
            <div className="rem-stat-card tipa">
              <div className="rem-stat-num">{resumen.tipoA.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Tipo A</div>
            </div>
            <div className="rem-stat-card tipb">
              <div className="rem-stat-num">{resumen.tipoB.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Tipo B</div>
            </div>
            <div className="rem-stat-card tipc">
              <div className="rem-stat-num">{resumen.tipoC.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Tipo C</div>
            </div>
            <div className="rem-stat-card tipd">
              <div className="rem-stat-num">{resumen.tipoD.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Tipo D</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{resumen.totalUnidades.toLocaleString('es-CO')}</div>
              <div className="rem-stat-label">Total unidades</div>
            </div>
          </div>

          <div className="section-label">Sitios a remisionar</div>
          {loadingBase ? (
            <div className="empty-state"><p>Cargando base de suministro...</p></div>
          ) : sitiosARemisionar.length === 0 ? (
            <div className="empty-state"><p>No hay sitios con entregas para esta fecha.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Sitio</th>
                    <th>Institución</th>
                    <th>Sitio de Entrega</th>
                    <th>Localidad</th>
                    <th style={{ textAlign: 'center' }}>A</th>
                    <th style={{ textAlign: 'center' }}>B</th>
                    <th style={{ textAlign: 'center' }}>C</th>
                    <th style={{ textAlign: 'center' }}>D</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sitiosARemisionar.map((s, i) => (
                    <tr key={s.id_sitio_entrega}>
                      <td>{i + 1}</td>
                      <td>{s.id_sitio_entrega}</td>
                      <td>{s.nombre_institucion}</td>
                      <td>{s.nombre_descripcion || s.nombre_institucion}</td>
                      <td>{s.localidad || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{s.tipo_a > 0 ? <span className="rem-pill rem-pill-a">{s.tipo_a}</span> : '-'}</td>
                      <td style={{ textAlign: 'center' }}>{s.tipo_b > 0 ? <span className="rem-pill rem-pill-b">{s.tipo_b}</span> : '-'}</td>
                      <td style={{ textAlign: 'center' }}>{s.tipo_c > 0 ? <span className="rem-pill rem-pill-c">{s.tipo_c}</span> : '-'}</td>
                      <td style={{ textAlign: 'center' }}>{s.tipo_d > 0 ? <span className="rem-pill rem-pill-d">{s.tipo_d}</span> : '-'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sitiosIncompletos.length > 0 && (
            <div className="rem-warning-list">
              <div className="rem-warning-list-title">⚠️ Sitios con datos incompletos (se generan igual, con &quot;-&quot; en los campos vacíos)</div>
              {sitiosIncompletos.map(s => (
                <div key={s.id_sitio_entrega} className="rem-warning-item">
                  {s.id_sitio_entrega} — {s.nombre_institucion}
                </div>
              ))}
            </div>
          )}

          <div className="rem-actions">
            <button className="btn-generate-pdf" onClick={handleGenerate} disabled={sitiosARemisionar.length === 0 || generando}>
              {generando ? 'Generando PDF...' : '📄 Generar PDF de Remisiones'}
            </button>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
