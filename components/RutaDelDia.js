'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildTituloTabla, buildRutasData } from '../lib/tablaRutasUtils'

function OrdenEntregaInput({ fecha, idSitio, ordenInicial }) {
  const [value, setValue] = useState(String(ordenInicial))

  useEffect(() => {
    setValue(String(ordenInicial))
  }, [fecha, idSitio, ordenInicial])

  async function handleSave() {
    const numValue = value === '' ? 0 : Number(value)
    if (!Number.isInteger(numValue)) {
      setValue(String(ordenInicial))
      return
    }
    if (numValue === ordenInicial) return
    await supabase.from('reforzados_override_orden_entrega').upsert(
      {
        fecha,
        id_sitio_entrega: idSitio,
        orden_entrega: numValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fecha,id_sitio_entrega' }
    )
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <input
      type="number"
      className="table-input rt-orden-input"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
    />
  )
}

export default function RutaDelDia({ fecha, onStatus }) {
  const [sitios, setSitios] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const [baseRows, setBaseRows] = useState([])
  const [ordenOverrides, setOrdenOverrides] = useState([])
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [asigLoading, setAsigLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    async function fetchData() {
      setLoadingInicial(true)
      const [
        { data: sitiosData, error: sitiosError },
        { data: rutaData, error: rutaError },
        { data: baseData, error: baseError },
        { data: ordenData, error: ordenError },
      ] = await Promise.all([
        supabase.from('reforzados_sitios').select('*'),
        supabase.from('reforzados_rutas_mes').select('*').eq('estado', 'activo').maybeSingle(),
        supabase.from('reforzados_base_suministro').select('*').eq('fecha', fecha),
        supabase.from('reforzados_override_orden_entrega').select('*').eq('fecha', fecha),
      ])
      if (!active) return
      setErrorMsg(sitiosError || rutaError || baseError || ordenError ? 'No se pudo cargar la información de la ruta.' : '')
      setSitios(sitiosData || [])
      setRutaActiva(rutaData || null)
      setBaseRows(baseData || [])
      setOrdenOverrides(ordenData || [])
      setLoadingInicial(false)
    }
    fetchData()
    return () => { active = false }
  }, [fecha])

  useEffect(() => {
    if (!rutaActiva) {
      setAsignaciones([])
      return
    }
    let active = true
    async function fetchAsignaciones() {
      setAsigLoading(true)
      const { data, error } = await supabase
        .from('reforzados_ruta_asignaciones')
        .select('*, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
        .eq('ruta_mes_id', rutaActiva.id)
      if (!active) return
      if (error) setErrorMsg('No se pudieron cargar las asignaciones de la ruta.')
      setAsignaciones(data || [])
      setAsigLoading(false)
    }
    fetchAsignaciones()
    return () => { active = false }
  }, [rutaActiva])

  const tituloTabla = useMemo(() => buildTituloTabla(fecha), [fecha])

  const rutaAplica = useMemo(() => {
    if (!rutaActiva) return false
    const [y, m] = fecha.split('-').map(Number)
    return rutaActiva.mes === m && rutaActiva.año === y
  }, [rutaActiva, fecha])

  const sitiosById = useMemo(() => new Map(sitios.map(s => [s.id_sitio_entrega, s])), [sitios])
  const ordenOverridesByIdSitio = useMemo(
    () => new Map(ordenOverrides.map(o => [o.id_sitio_entrega, o.orden_entrega])),
    [ordenOverrides]
  )

  const tableData = useMemo(() => {
    if (!rutaAplica || asignaciones.length === 0) return null
    const baseByIdSitio = new Map(baseRows.map(b => [b.id_sitio_entrega, b]))
    return buildRutasData(asignaciones, sitiosById, baseByIdSitio, ordenOverridesByIdSitio)
  }, [rutaAplica, asignaciones, sitiosById, baseRows, ordenOverridesByIdSitio])

  const loading = loadingInicial || asigLoading

  useEffect(() => {
    if (loading) return
    onStatus?.({ rutaActiva: rutaAplica, baseSuministro: baseRows.length > 0 })
  }, [loading, rutaAplica, baseRows, onStatus])

  if (loading) return <div className="empty-state"><p>Cargando información...</p></div>
  if (errorMsg) return <div className="form-error-banner">{errorMsg}</div>

  if (!rutaAplica) {
    return (
      <div className="rt-status-card">
        <div className="rt-status-card-emoji">⚠️</div>
        <div className="rt-status-card-text">No hay ruta activa</div>
      </div>
    )
  }

  if (baseRows.length === 0) {
    return (
      <div className="rt-status-card">
        <div className="rt-status-card-emoji">⚠️</div>
        <div className="rt-status-card-text">Base de suministro no cargada</div>
      </div>
    )
  }

  if (asignaciones.length === 0) {
    return <div className="empty-state"><p>La ruta activa no tiene asignaciones.</p></div>
  }

  return (
    <div className="rutas-table-wrap">
      <div className="rt-export-wrap">
        <div className="rt-titulo">{tituloTabla}</div>
        <table className="rutas-table">
          <colgroup>
            <col style={{ minWidth: '180px' }} />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>CONDUCTOR</th>
              <th>PLACA</th>
              <th>CARGUE ALINNOVA</th>
              <th>Id Sitio Entrega</th>
              <th>Institución</th>
              <th>Sitio de Entrega</th>
              <th>HORARIO SUGERIDO COMPENSAR</th>
              <th>HORARIO ENTREGA ALINNOVA</th>
              <th>ORDEN ENTREGA</th>
              <th>Dirección de Entrega</th>
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
                    <td>{f.institucion}</td>
                    <td>{f.sitioEntrega}</td>
                    <td>{f.horarioSugerido}</td>
                    <td>{f.horarioEntregaAlinnova}</td>
                    <td>
                      <OrdenEntregaInput fecha={fecha} idSitio={f.idSitio} ordenInicial={f.orden} />
                      {f.sinBase ? ' ⚠️' : ''}
                    </td>
                    <td>{f.direccion}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
