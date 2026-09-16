'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import LogisticaSitioModal from '../../../../components/LogisticaSitioModal'
import LogisticaDirectorioExcelModal from '../../../../components/LogisticaDirectorioExcelModal'
import { supabase } from '../../../../lib/supabase'
import { getRutaHabitual } from '../../../../lib/logisticaAsignacionesQuery'

const PAGE_SIZE = 50

function RutaHabitualValor({ info }) {
  if (!info) return <span className="logistica-muted">—</span>
  if (info.confianza === 'alta') {
    return (
      <div>
        <div>{info.ruta}</div>
        <div className="wizard-ruta-habitual-sub">{info.frecuencia}/{info.totalDias} días</div>
      </div>
    )
  }
  if (info.confianza === 'media') {
    return (
      <div className="wizard-ruta-habitual-media">
        <div>{info.ruta}</div>
        <div className="wizard-ruta-habitual-sub">{info.frecuencia}/{info.totalDias} días</div>
      </div>
    )
  }
  return (
    <div className="wizard-ruta-habitual-baja">
      <div>{info.ruta}</div>
      <div className="wizard-ruta-habitual-sub">basado en {info.totalDias} días</div>
    </div>
  )
}

function RutaHabitualCell({ sitio, info, onGuardado, onError }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cancelarRef = useRef(false)

  function iniciarEdicion(e) {
    e.stopPropagation()
    if (editando) return
    cancelarRef.current = false
    setValor(info?.ruta || '')
    setEditando(true)
  }

  function cancelar() {
    cancelarRef.current = true
    setEditando(false)
  }

  async function confirmar() {
    if (cancelarRef.current) { cancelarRef.current = false; return }
    const nombreRuta = valor.trim()
    if (!nombreRuta) {
      setEditando(false)
      return
    }
    setGuardando(true)
    const punto_wms = String(sitio.punto_wms)
    const { error } = await supabase
      .from('logistica_asignaciones_historico')
      .insert({ punto_wms, nombre_ruta: nombreRuta, fecha: new Date().toISOString() })
    setGuardando(false)
    if (error) {
      console.error('No se pudo guardar la ruta habitual:', error)
      onError?.('No se pudo guardar la ruta habitual, intenta de nuevo')
      return
    }
    const resultado = await getRutaHabitual([punto_wms])
    onGuardado?.(punto_wms, resultado[punto_wms])
    setEditando(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') { e.stopPropagation(); cancelar() }
  }

  if (!editando) {
    return (
      <div className="ruta-habitual-cell" onClick={iniciarEdicion}>
        <RutaHabitualValor info={info} />
      </div>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <input
        type="text"
        autoFocus
        className="ruta-habitual-input"
        value={valor}
        disabled={guardando}
        onChange={e => setValor(e.target.value)}
        onBlur={confirmar}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

function Paginador({ pagina, totalPaginas, total, onChange }) {
  if (totalPaginas <= 1) return null
  return (
    <div className="wizard-paginador">
      <span>Página {pagina} de {totalPaginas} · {total} colegio(s)</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>← Anterior</button>
        <button className="btn-secondary" disabled={pagina >= totalPaginas} onClick={() => onChange(pagina + 1)}>Siguiente →</button>
      </div>
    </div>
  )
}

export default function DirectorioColegiosPage() {
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [pagina, setPagina] = useState(1)
  const [rutaHabitualPorPunto, setRutaHabitualPorPunto] = useState({})
  const [cargandoHabitual, setCargandoHabitual] = useState(false)
  const [modalSitio, setModalSitio] = useState(null)
  const [modalExcelAbierto, setModalExcelAbierto] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => { fetchSitios() }, [])
  useEffect(() => { setPagina(1) }, [search])
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(''), 3500)
    return () => clearTimeout(t)
  }, [toastMsg])

  function handleRutaHabitualGuardada(punto, info) {
    setRutaHabitualPorPunto(prev => ({ ...prev, [punto]: info }))
  }

  async function fetchSitios() {
    setLoading(true)
    const { data, error } = await supabase.from('logistica_sitios').select('*').order('nombre_institucion')
    if (error) {
      setErrorMsg('No se pudieron cargar los colegios.')
    } else {
      setSitios(data || [])
      setErrorMsg('')
      cargarRutaHabitual(data || [])
    }
    setLoading(false)
  }

  async function cargarRutaHabitual(lista) {
    if (!lista.length) { setRutaHabitualPorPunto({}); return }
    setCargandoHabitual(true)
    const resultado = await getRutaHabitual(lista.map(s => s.punto_wms))
    setRutaHabitualPorPunto(resultado)
    setCargandoHabitual(false)
  }

  const localidadesUnicas = useMemo(
    () => Array.from(new Set(sitios.map(s => s.localidad).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [sitios]
  )

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sitios
    return sitios.filter(s => [s.nombre_institucion, String(s.punto_wms), s.localidad, s.nombre_sitio]
      .some(v => v != null && String(v).toLowerCase().includes(term)))
  }, [sitios, search])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filasVisibles = filtrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)

  const conteo = useMemo(() => ({
    totalColegios: sitios.length,
    conLocalidad: sitios.filter(s => s.localidad && s.localidad !== 'SIN LOCALIDAD').length,
    conRutaHabitual: sitios.filter(s => rutaHabitualPorPunto[String(s.punto_wms)]).length,
  }), [sitios, rutaHabitualPorPunto])

  function abrirNuevo() { setModalSitio({ sitio: null }) }
  function abrirEditar(sitio) { setModalSitio({ sitio }) }
  function cerrarModalSitio() { setModalSitio(null) }
  async function handleSitioGuardado() { await fetchSitios() }

  function cerrarModalExcel() { setModalExcelAbierto(false) }
  async function handleExcelImportado() {
    setModalExcelAbierto(false)
    await fetchSitios()
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="📚 Directorio de colegios"
          subtitle="Data maestra de sitios de entrega — Logística"
        />
        <div className="page-content">
          <div className="rem-stats-row">
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : conteo.totalColegios}</div>
              <div className="rem-stat-label">Colegios en el directorio</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : conteo.conLocalidad}</div>
              <div className="rem-stat-label">Con localidad asignada</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading || cargandoHabitual ? '…' : conteo.conRutaHabitual}</div>
              <div className="rem-stat-label">Con ruta habitual detectada</div>
            </div>
          </div>

          <div className="page-toolbar spread">
            <button className="btn-primary" onClick={abrirNuevo}>+ Agregar colegio</button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => setModalExcelAbierto(true)}>📥 Cargar desde Excel</button>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por nombre, punto WMS o localidad..."
                style={{ minWidth: 280 }}
              />
            </div>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando colegios...</p></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><p>{sitios.length === 0 ? 'No hay colegios cargados todavía.' : 'No hay colegios que coincidan con la búsqueda.'}</p></div>
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Punto WMS</th>
                      <th>Institución</th>
                      <th>Sitio de entrega</th>
                      <th>Localidad</th>
                      <th>Dirección</th>
                      <th>Ruta habitual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVisibles.map(s => (
                      <tr key={s.id} className="wizard-row-clickable" onClick={() => abrirEditar(s)}>
                        <td className="logistica-mono">{s.punto_wms}</td>
                        <td>{s.nombre_institucion}</td>
                        <td>{s.nombre_sitio || <span className="logistica-muted">—</span>}</td>
                        <td>{s.localidad}</td>
                        <td>{s.direccion || <span className="logistica-muted">—</span>}</td>
                        <td>
                          <RutaHabitualCell
                            sitio={s}
                            info={rutaHabitualPorPunto[String(s.punto_wms)]}
                            onGuardado={handleRutaHabitualGuardada}
                            onError={setToastMsg}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginador pagina={paginaSegura} totalPaginas={totalPaginas} total={filtrados.length} onChange={setPagina} />
            </>
          )}
        </div>
      </main>

      {modalSitio && (
        <LogisticaSitioModal
          key={modalSitio.sitio?.id || 'new'}
          open={Boolean(modalSitio)}
          sitio={modalSitio.sitio}
          localidadesDisponibles={localidadesUnicas}
          onClose={cerrarModalSitio}
          onSaved={handleSitioGuardado}
        />
      )}

      {modalExcelAbierto && (
        <LogisticaDirectorioExcelModal onClose={cerrarModalExcel} onImported={handleExcelImportado} />
      )}

      {toastMsg && <div className="toast toast-error">{toastMsg}</div>}
    </div>
  )
}
