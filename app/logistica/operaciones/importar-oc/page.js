'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import PageHeader from '../../../../components/PageHeader'
import { supabase } from '../../../../lib/supabase'
import { readFileAsArrayBuffer } from '../../../../lib/parseRutasExcel'
import { parsearExcelOc, construirPreview } from '../../../../lib/logisticaOcImport'

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

function ColapsableSection({ title, count, accent, defaultOpen = true, children }) {
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

export default function ImportarOCPage() {
  const [estado, setEstado] = useState('inicial')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [ocInfo, setOcInfo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [ocExistente, setOcExistente] = useState(null)
  const [reemplazarOcElegido, setReemplazarOcElegido] = useState(false)
  const [decisionesSitios, setDecisionesSitios] = useState({})
  const [resultadoExito, setResultadoExito] = useState(null)
  const fileInputRef = useRef(null)

  function resetear() {
    setEstado('inicial')
    setErrorMsg('')
    setArchivoNombre('')
    setOcInfo(null)
    setPreview(null)
    setOcExistente(null)
    setReemplazarOcElegido(false)
    setDecisionesSitios({})
    setResultadoExito(null)
  }

  async function procesarArchivo(file) {
    setEstado('parseando')
    setErrorMsg('')
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const parsed = parsearExcelOc(buffer)
      if (parsed.lineasValidas.length === 0) throw new Error('El archivo no contiene líneas válidas para importar.')

      const [{ data: sitiosData, error: sitiosError }, { data: productosData, error: productosError }] = await Promise.all([
        supabase.from('logistica_sitios').select('id, punto_wms, nombre_institucion'),
        supabase.from('logistica_productos').select('id, codigo_articulo, nombre'),
      ])
      if (sitiosError || productosError) throw new Error('No se pudieron consultar los sitios/productos existentes.')

      const previewResult = construirPreview(parsed.lineasValidas, sitiosData || [], productosData || [])
      const numeroOcJoined = parsed.numerosOc.join(',')
      const hoy = new Date().toISOString().slice(0, 10)

      const { data: ocExistenteData, error: ocCheckError } = await supabase
        .from('logistica_oc')
        .select('id, numero_oc, fecha_recepcion')
        .eq('numero_oc', numeroOcJoined)
        .eq('fecha_recepcion', hoy)
        .limit(1)
        .maybeSingle()
      if (ocCheckError) throw new Error('No se pudo verificar si la OC ya existe.')

      setArchivoNombre(file.name)
      setOcInfo(parsed)
      setPreview(previewResult)
      setOcExistente(ocExistenteData || null)
      setReemplazarOcElegido(false)
      const decisionesIniciales = {}
      previewResult.sitiosConflictos.forEach(c => { decisionesIniciales[c.punto_wms] = 'mantener' })
      setDecisionesSitios(decisionesIniciales)
      setEstado('preview')
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo procesar el archivo.')
      setEstado('error')
    }
  }

  function handleFileSelected(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMsg('Solo se aceptan archivos .xlsx')
      setEstado('error')
      return
    }
    procesarArchivo(file)
  }

  function handleDragOver(e) { e.preventDefault(); setDragActive(true) }
  function handleDragLeave(e) { e.preventDefault(); setDragActive(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFileSelected(e.dataTransfer.files?.[0])
  }
  function handleInputChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    handleFileSelected(file)
  }

  async function confirmarImportacion() {
    setEstado('confirmando')
    setErrorMsg('')
    let ocCreada = null
    try {
      if (reemplazarOcElegido && ocExistente) {
        const { error } = await supabase.from('logistica_oc').delete().eq('id', ocExistente.id)
        if (error) throw new Error('No se pudo reemplazar la OC existente.')
      }

      if (preview.sitiosNuevos.length > 0) {
        const { error } = await supabase.from('logistica_sitios').insert(preview.sitiosNuevos.map(s => ({
          punto_wms: s.punto_wms,
          nombre_institucion: s.nombre_institucion,
          localidad: s.localidad,
        })))
        if (error) throw new Error('No se pudieron crear los sitios nuevos.')
      }

      if (preview.productosNuevos.length > 0) {
        const { error } = await supabase.from('logistica_productos').insert(preview.productosNuevos.map(p => ({
          codigo_articulo: p.codigo_articulo,
          nombre: p.nombre,
          modalidad: p.modalidad_detectada,
          capacidad_canastilla: 0,
          valor_unitario: 0,
        })))
        if (error) throw new Error('No se pudieron crear los productos nuevos.')
      }

      const puntosActualizar = Object.entries(decisionesSitios).filter(([, v]) => v === 'actualizar').map(([k]) => Number(k))
      for (const punto of puntosActualizar) {
        const conflicto = preview.sitiosConflictos.find(c => c.punto_wms === punto)
        if (conflicto) {
          const { error } = await supabase.from('logistica_sitios').update({ nombre_institucion: conflicto.nombre_nuevo }).eq('punto_wms', punto)
          if (error) throw new Error(`No se pudo actualizar el sitio ${punto}.`)
        }
      }

      const numeroOcJoined = ocInfo.numerosOc.join(',')
      const hoy = new Date().toISOString().slice(0, 10)
      const { data: ocInsertada, error: ocError } = await supabase
        .from('logistica_oc')
        .insert([{ numero_oc: numeroOcJoined, fecha_recepcion: hoy, archivo_origen: archivoNombre, estado: 'importada' }])
        .select()
        .single()
      if (ocError) throw new Error('No se pudo crear el registro de OC.')
      ocCreada = ocInsertada

      const [{ data: sitiosData2, error: sitiosError2 }, { data: productosData2, error: productosError2 }] = await Promise.all([
        supabase.from('logistica_sitios').select('id, punto_wms'),
        supabase.from('logistica_productos').select('id, codigo_articulo'),
      ])
      if (sitiosError2 || productosError2) throw new Error('No se pudieron recargar sitios/productos para el detalle.')

      const sitioIdPorPunto = new Map((sitiosData2 || []).map(s => [s.punto_wms, s.id]))
      const productoIdPorCodigo = new Map((productosData2 || []).map(p => [p.codigo_articulo, p.id]))

      const detalleRows = ocInfo.lineasValidas
        .filter(l => l.fecha_entrega && sitioIdPorPunto.has(l.punto_wms) && productoIdPorCodigo.has(l.codigo_articulo))
        .map(l => ({
          oc_id: ocCreada.id,
          sitio_id: sitioIdPorPunto.get(l.punto_wms),
          producto_id: productoIdPorCodigo.get(l.codigo_articulo),
          cantidad: l.cantidad,
          fecha_entrega_original: l.fecha_entrega,
          fecha_entrega_efectiva: l.fecha_entrega,
          fecha_consumo: l.fecha_consumo,
          observacion: null,
        }))

      if (detalleRows.length === 0) throw new Error('No se pudo emparejar ninguna línea con sitios, productos o fechas válidas.')

      const { error: detalleError } = await supabase.from('logistica_oc_detalle').insert(detalleRows)
      if (detalleError) throw new Error('No se pudo insertar el detalle de la OC.')

      setResultadoExito({
        totalLineas: detalleRows.length,
        sitiosCreados: preview.sitiosNuevos.length,
        productosCreados: preview.productosNuevos.length,
        numeroOc: numeroOcJoined,
      })
      setEstado('exito')
    } catch (err) {
      if (ocCreada) {
        await supabase.from('logistica_oc').delete().eq('id', ocCreada.id)
      }
      setErrorMsg(err.message || 'No se pudo completar la importación.')
      setEstado('error')
    }
  }

  const fechasEntrega = ocInfo
    ? Array.from(new Set(ocInfo.lineasValidas.map(l => l.fecha_entrega).filter(Boolean))).sort()
    : []
  const rangoFechas = fechasEntrega.length === 0
    ? 'No detectada'
    : fechasEntrega.length === 1
      ? fechasEntrega[0]
      : `${fechasEntrega[0]} a ${fechasEntrega[fechasEntrega.length - 1]}`

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/operaciones"
          backLabel="Volver"
          title="📥 Importar OC — Logística"
          subtitle="Carga y validación de OC de Compensar (.xlsx)"
        />
        <div className="page-content">
          {estado === 'inicial' && (
            <div
              className={`dropzone ${dragActive ? 'dropzone-highlight' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <div className="dropzone-icon">📥</div>
              <div className="dropzone-text">Arrastra el Excel de OC de Compensar o haz clic para seleccionar</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleInputChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {estado === 'parseando' && (
            <div className="empty-state"><p>Leyendo archivo Excel...</p></div>
          )}

          {estado === 'confirmando' && (
            <div className="empty-state"><p>Importando...</p></div>
          )}

          {estado === 'error' && (
            <>
              <div className="form-error-banner">{errorMsg}</div>
              <div className="page-toolbar">
                <button className="btn-primary" onClick={resetear}>🔄 Reintentar</button>
              </div>
            </>
          )}

          {estado === 'exito' && resultadoExito && (
            <>
              <div className="logistica-exito-box">
                ✓ OC importada correctamente
                <div className="logistica-exito-detalle">
                  {resultadoExito.totalLineas.toLocaleString('es-CO')} líneas · {resultadoExito.sitiosCreados} sitios nuevos · {resultadoExito.productosCreados} productos nuevos
                </div>
              </div>
              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <button className="btn-primary" onClick={resetear}>📥 Importar otra OC</button>
                <Link href="/logistica/operaciones/reprogramacion" className="btn-secondary">➡️ Ir a Reprogramación</Link>
                <Link href="/logistica/operaciones" className="btn-secondary">← Volver a Operaciones</Link>
              </div>
            </>
          )}

          {estado === 'preview' && preview && ocInfo && (
            <>
              <div className="rem-stats-row">
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.totalLineas}</div>
                  <div className="rem-stat-label">Líneas válidas</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{ocInfo.lineasReforzados}</div>
                  <div className="rem-stat-label">Refrigerio Reforzado filtradas</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.sitiosNuevos.length}</div>
                  <div className="rem-stat-label">Sitios nuevos</div>
                </div>
                <div className="rem-stat-card">
                  <div className="rem-stat-num">{preview.productosNuevos.length}</div>
                  <div className="rem-stat-label">Productos nuevos</div>
                </div>
              </div>

              <div className="modal-hint">
                <strong>Números de OC detectados:</strong> {ocInfo.numerosOc.join(', ') || 'Ninguno'}<br />
                <strong>Fecha de entrega detectada:</strong> {rangoFechas}
              </div>

              <div className="rem-stats-row">
                {preview.resumenPorModalidad.map(m => {
                  const info = MODALIDAD_INFO[m.modalidad]
                  return (
                    <div key={m.modalidad} className="rem-stat-card">
                      <div className="rem-stat-num">{m.total_unidades.toLocaleString('es-CO')}</div>
                      <div className="rem-stat-label"><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || m.modalidad}</span></div>
                    </div>
                  )
                })}
              </div>

              {ocExistente && (
                <div className="logistica-warning-box">
                  <div>⚠️ Ya existe una OC con número <strong>{ocExistente.numero_oc}</strong> importada el {ocExistente.fecha_recepcion}.</div>
                  <div className="logistica-warning-actions">
                    <button
                      className={`btn-secondary ${reemplazarOcElegido ? 'logistica-btn-selected' : ''}`}
                      onClick={() => setReemplazarOcElegido(true)}
                    >
                      🔁 Reemplazar OC existente
                    </button>
                    <button className="btn-secondary" onClick={resetear}>✖ Cancelar</button>
                  </div>
                </div>
              )}

              {preview.sitiosNuevos.length > 0 && (
                <ColapsableSection title="Sitios nuevos que se autocrearán" count={preview.sitiosNuevos.length} accent="accent-green">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Punto WMS</th><th>Nombre Institución</th><th>Localidad</th></tr>
                      </thead>
                      <tbody>
                        {preview.sitiosNuevos.map(s => (
                          <tr key={s.punto_wms} className={s.localidad === 'SIN LOCALIDAD' ? 'logistica-row-highlight' : ''}>
                            <td className="logistica-mono">{s.punto_wms}</td>
                            <td>{s.nombre_institucion}</td>
                            <td>{s.localidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.sitiosNuevos.some(s => s.localidad === 'SIN LOCALIDAD') && (
                    <p className="modal-hint modal-hint-warning">Debes completar la localidad después en la pantalla Sitios.</p>
                  )}
                </ColapsableSection>
              )}

              {preview.productosNuevos.length > 0 && (
                <ColapsableSection title="Productos nuevos que se autocrearán" count={preview.productosNuevos.length} accent="logistica-accent-orange">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Código artículo</th><th>Nombre</th><th>Modalidad detectada</th></tr>
                      </thead>
                      <tbody>
                        {preview.productosNuevos.map(p => {
                          const info = MODALIDAD_INFO[p.modalidad_detectada]
                          return (
                            <tr key={p.codigo_articulo}>
                              <td className="logistica-mono">{p.codigo_articulo}</td>
                              <td>{p.nombre}</td>
                              <td><span className={`logistica-pill ${info?.className || ''}`}>{info?.label || p.modalidad_detectada}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="modal-hint">Estos productos se crean con capacidad_canastilla=0 y valor_unitario=0. Complétalos después en la pantalla Productos.</p>
                </ColapsableSection>
              )}

              {preview.sitiosConflictos.length > 0 && (
                <ColapsableSection title="Sitios con nombre diferente al existente" count={preview.sitiosConflictos.length} accent="accent-red">
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Punto WMS</th><th>Nombre actual en BD</th><th>Nombre en Excel</th><th>Acción</th></tr>
                      </thead>
                      <tbody>
                        {preview.sitiosConflictos.map(c => (
                          <tr key={c.punto_wms}>
                            <td className="logistica-mono">{c.punto_wms}</td>
                            <td>{c.nombre_actual}</td>
                            <td>{c.nombre_nuevo}</td>
                            <td>
                              <div className="logistica-radio-group">
                                <label className="logistica-radio-option">
                                  <input
                                    type="radio"
                                    name={`decision-${c.punto_wms}`}
                                    checked={decisionesSitios[c.punto_wms] !== 'actualizar'}
                                    onChange={() => setDecisionesSitios(prev => ({ ...prev, [c.punto_wms]: 'mantener' }))}
                                  />
                                  Mantener actual
                                </label>
                                <label className="logistica-radio-option">
                                  <input
                                    type="radio"
                                    name={`decision-${c.punto_wms}`}
                                    checked={decisionesSitios[c.punto_wms] === 'actualizar'}
                                    onChange={() => setDecisionesSitios(prev => ({ ...prev, [c.punto_wms]: 'actualizar' }))}
                                  />
                                  Actualizar
                                </label>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ColapsableSection>
              )}

              <ColapsableSection title="Resumen por localidad" count={preview.resumenPorLocalidad.length} accent="accent-celeste">
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Localidad</th><th>Líneas</th><th>Unidades totales</th></tr>
                    </thead>
                    <tbody>
                      {preview.resumenPorLocalidad.map(r => (
                        <tr key={r.localidad}>
                          <td className={r.localidad === 'SIN LOCALIDAD' ? 'logistica-highlight-yellow' : ''}>{r.localidad}</td>
                          <td>{r.total_lineas.toLocaleString('es-CO')}</td>
                          <td>{r.total_unidades.toLocaleString('es-CO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ColapsableSection>

              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 12 }}>
                <button className="btn-secondary" onClick={resetear}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={confirmarImportacion}
                  disabled={Boolean(ocExistente) && !reemplazarOcElegido}
                >
                  ✅ Confirmar importación
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
