'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageHeader from '../../../../components/PageHeader'
import { supabase } from '../../../../lib/supabase'
import { ASIGNACIONES_SEMILLA, normalizarNombreSitio } from '../../../../lib/logisticaAsignacionesSemilla'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

const SUFIJOS_MODALIDAD = { panaderia: 'PAN', am_pm: 'AMPM', gastronomia: 'GASTRO' }
const MODALIDADES = ['panaderia', 'am_pm', 'gastronomia']

function ColapsableSection({ title, count, accent, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`section-collapsible ${accent} ${open ? '' : 'collapsed'}`}>
      <div className="section-collapsible-header" onClick={() => setOpen(o => !o)}>
        <div>
          <span className="section-collapsible-title">{title}</span>
          <span className="section-collapsible-count"> ({count})</span>
        </div>
        <span className="section-collapsible-chevron">▼</span>
      </div>
      {open && <div className="section-collapsible-body logistica-section-pad">{children}</div>}
    </div>
  )
}

function generarPreview(sitios, rutas, existentesSet) {
  const rutasPorNombre = new Map(rutas.map(r => [r.nombre, r]))
  const sitiosPorLocalidad = new Map()
  for (const s of sitios) {
    const key = (s.localidad || '').trim().toUpperCase()
    if (!sitiosPorLocalidad.has(key)) sitiosPorLocalidad.set(key, [])
    sitiosPorLocalidad.get(key).push(s)
  }

  let totalColegios = 0
  const noEncontrados = []
  const ambiguos = []
  const nuevasAsignaciones = []
  const yaExistentes = []
  const erroresRuta = []

  for (const [localidad, entradas] of Object.entries(ASIGNACIONES_SEMILLA)) {
    const candidatos = sitiosPorLocalidad.get(localidad.trim().toUpperCase()) || []
    for (const [nombreBuscado, subRuta] of entradas) {
      totalColegios += 1
      const nombreNorm = normalizarNombreSitio(nombreBuscado)
      const matches = candidatos.filter(s => normalizarNombreSitio(s.nombre_institucion).includes(nombreNorm))

      if (matches.length === 0) {
        noEncontrados.push({ nombreBuscado, localidad })
        continue
      }
      if (matches.length > 1) {
        ambiguos.push({ nombreBuscado, localidad, matches })
      }
      const sitio = matches[0]

      for (const modalidad of MODALIDADES) {
        const sufijo = SUFIJOS_MODALIDAD[modalidad]
        const nombreRuta = `${localidad} ${sufijo} ${subRuta}`
        const ruta = rutasPorNombre.get(nombreRuta)
        if (!ruta) {
          erroresRuta.push({ sitio, modalidad, nombreRuta })
          continue
        }
        const key = `${sitio.id}|${ruta.id}`
        const item = { sitio, modalidad, ruta }
        if (existentesSet.has(key)) {
          yaExistentes.push(item)
        } else {
          nuevasAsignaciones.push(item)
        }
      }
    }
  }

  return { totalColegios, noEncontrados, ambiguos, nuevasAsignaciones, yaExistentes, erroresRuta }
}

export default function ImportarAsignacionesPage() {
  const [estado, setEstado] = useState('inicial')
  const [errorMsg, setErrorMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const [resultado, setResultado] = useState(null)

  async function handleGenerarPreview() {
    setEstado('generando')
    setErrorMsg('')
    try {
      const { data: sitiosData, error: errSitios } = await supabase
        .from('logistica_sitios')
        .select('id, punto_wms, nombre_institucion, localidad')
        .eq('activo', true)
      if (errSitios) throw errSitios

      const { data: rutasData, error: errRutas } = await supabase
        .from('logistica_rutas')
        .select('id, nombre, modalidad, localidad_principal')
        .eq('activo', true)
      if (errRutas) throw errRutas

      const { data: asigData, error: errAsig } = await supabase
        .from('logistica_sitio_ruta')
        .select('sitio_id, ruta_id')
      if (errAsig) throw errAsig

      const existentesSet = new Set((asigData || []).map(a => `${a.sitio_id}|${a.ruta_id}`))
      const resultadoPreview = generarPreview(sitiosData || [], rutasData || [], existentesSet)
      setPreview(resultadoPreview)
      setEstado('preview')
    } catch (err) {
      setErrorMsg('No se pudo generar el preview de asignaciones.')
      setEstado('error')
    }
  }

  async function handleConfirmar() {
    setEstado('aplicando')
    setErrorMsg('')
    try {
      const rows = preview.nuevasAsignaciones.map(a => ({ sitio_id: a.sitio.id, ruta_id: a.ruta.id }))
      const resultados = await Promise.all(
        rows.map(row => supabase.from('logistica_sitio_ruta').insert([row]))
      )
      const exitosas = resultados.filter(r => !r.error).length
      const fallidas = resultados.filter(r => r.error).length
      setResultado({ exitosas, fallidas, total: rows.length })
      setEstado('exito')
    } catch (err) {
      setErrorMsg('No se pudieron aplicar las asignaciones.')
      setEstado('error')
    }
  }

  function handleCancelar() {
    setPreview(null)
    setEstado('inicial')
  }

  function resetear() {
    setPreview(null)
    setResultado(null)
    setErrorMsg('')
    setEstado('inicial')
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="🎯 Importar asignaciones semilla — Logística"
          subtitle="Sembrar asignación sitio-ruta desde el mapa base"
        />
        <div className="page-content">
          <div className="logistica-info-box">
            💡 Esta pantalla es one-shot para sembrar la configuración inicial de rutas por proximidad geográfica derivada del Excel de rutas por carro. Solo debe usarse una vez.
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {estado === 'inicial' && (
            <div className="page-toolbar">
              <button className="btn-primary" onClick={handleGenerarPreview}>🔍 Generar preview</button>
            </div>
          )}

          {estado === 'generando' && (
            <div className="empty-state"><p>Analizando sitios y rutas...</p></div>
          )}

          {estado === 'aplicando' && (
            <div className="empty-state"><p>Aplicando asignaciones...</p></div>
          )}

          {estado === 'error' && (
            <div className="page-toolbar">
              <button className="btn-primary" onClick={resetear}>🔄 Reintentar</button>
            </div>
          )}

          {estado === 'exito' && resultado && (
            <>
              <div className="logistica-exito-box">
                ✓ Asignaciones aplicadas correctamente
                <div className="logistica-exito-detalle">
                  {resultado.exitosas.toLocaleString('es-CO')} asignaciones creadas
                  {resultado.fallidas > 0 && ` · ${resultado.fallidas} fallaron`}
                </div>
              </div>
              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <Link href="/logistica/data-maestra" className="btn-primary">← Volver a Data Maestra</Link>
              </div>
            </>
          )}

          {estado === 'preview' && preview && (
            <>
              <div className="rem-stats-row">
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.totalColegios}</div>
                  <div className="rem-stat-label">Colegios de la semilla</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.totalColegios - preview.noEncontrados.length}</div>
                  <div className="rem-stat-label">Encontrados en BD</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.noEncontrados.length}</div>
                  <div className="rem-stat-label">No encontrados en BD</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.ambiguos.length}</div>
                  <div className="rem-stat-label">Ambiguos</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.nuevasAsignaciones.length}</div>
                  <div className="rem-stat-label">Asignaciones nuevas a crear</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.yaExistentes.length}</div>
                  <div className="rem-stat-label">Ya existentes (se saltarán)</div>
                </div>
              </div>

              {preview.noEncontrados.length > 0 && (
                <ColapsableSection title="Colegios NO encontrados en BD" count={preview.noEncontrados.length} accent="accent-red">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre buscado</th><th>Localidad</th></tr>
                      </thead>
                      <tbody>
                        {preview.noEncontrados.map((n, i) => (
                          <tr key={i}>
                            <td>{n.nombreBuscado}</td>
                            <td><span className="badge badge-info">{n.localidad}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="modal-hint">Estos colegios no hicieron match por nombre/localidad en la base. Revísalos y corrígelos manualmente desde la pantalla Sitios o desde Rutero del Día.</p>
                </ColapsableSection>
              )}

              {preview.ambiguos.length > 0 && (
                <ColapsableSection title="Colegios con match ambiguo" count={preview.ambiguos.length} accent="logistica-accent-orange">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre buscado</th><th>Localidad</th><th>Coincidencias encontradas</th></tr>
                      </thead>
                      <tbody>
                        {preview.ambiguos.map((a, i) => (
                          <tr key={i}>
                            <td>{a.nombreBuscado}</td>
                            <td><span className="badge badge-info">{a.localidad}</span></td>
                            <td>{a.matches.map(m => m.nombre_institucion).join(' · ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="modal-hint">Se usó la primera coincidencia de cada fila. Verifica que sea la correcta.</p>
                </ColapsableSection>
              )}

              {preview.erroresRuta.length > 0 && (
                <ColapsableSection title="Rutas destino no encontradas" count={preview.erroresRuta.length} accent="accent-red">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Sitio</th><th>Modalidad</th><th>Ruta esperada</th></tr>
                      </thead>
                      <tbody>
                        {preview.erroresRuta.map((e, i) => {
                          const info = MODALIDAD_INFO[e.modalidad]
                          return (
                            <tr key={i}>
                              <td>{e.sitio.nombre_institucion}</td>
                              <td><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || e.modalidad}</span></td>
                              <td className="logistica-mono">{e.nombreRuta}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </ColapsableSection>
              )}

              <ColapsableSection title="Asignaciones nuevas a crear" count={preview.nuevasAsignaciones.length} accent="accent-green" defaultOpen>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Sitio</th><th>Localidad</th><th>Modalidad</th><th>Ruta destino</th></tr>
                    </thead>
                    <tbody>
                      {preview.nuevasAsignaciones.map((a, i) => {
                        const info = MODALIDAD_INFO[a.modalidad]
                        return (
                          <tr key={i}>
                            <td>{a.sitio.nombre_institucion}</td>
                            <td><span className="badge badge-info">{a.sitio.localidad}</span></td>
                            <td><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || a.modalidad}</span></td>
                            <td className="logistica-mono">{a.ruta.nombre}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </ColapsableSection>

              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <button className="btn-secondary" onClick={handleCancelar}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={handleConfirmar}
                  disabled={preview.nuevasAsignaciones.length === 0}
                >
                  ✓ Confirmar y aplicar asignaciones
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
