'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildInterventorias } from '../lib/tablaRutasUtils'

export default function InterventoriaDia({ fecha }) {
  const [sitios, setSitios] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [asignaciones, setAsignaciones] = useState([])
  const [baseRows, setBaseRows] = useState([])
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [asigLoading, setAsigLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    async function fetchData() {
      setLoadingInicial(true)
      const [{ data: sitiosData, error: sitiosError }, { data: rutaData, error: rutaError }, { data: baseData, error: baseError }] = await Promise.all([
        supabase.from('reforzados_sitios').select('*'),
        supabase.from('reforzados_rutas_mes').select('*').eq('estado', 'activo').maybeSingle(),
        supabase.from('reforzados_base_suministro').select('*').eq('fecha', fecha).gt('total', 0),
      ])
      if (!active) return
      setErrorMsg(sitiosError || rutaError || baseError ? 'No se pudo cargar la información de interventoría.' : '')
      setSitios(sitiosData || [])
      setRutaActiva(rutaData || null)
      setBaseRows(baseData || [])
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
      const { data } = await supabase
        .from('reforzados_ruta_asignaciones')
        .select('*, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
        .eq('ruta_mes_id', rutaActiva.id)
      if (!active) return
      setAsignaciones(data || [])
      setAsigLoading(false)
    }
    fetchAsignaciones()
    return () => { active = false }
  }, [rutaActiva])

  const rutaAplica = useMemo(() => {
    if (!rutaActiva) return false
    const [y, m] = fecha.split('-').map(Number)
    return rutaActiva.mes === m && rutaActiva.año === y
  }, [rutaActiva, fecha])

  const sitiosById = useMemo(() => new Map(sitios.map(s => [s.id_sitio_entrega, s])), [sitios])

  const interventorias = useMemo(() => {
    const asignacionBySitio = rutaAplica ? new Map(asignaciones.map(a => [a.id_sitio_entrega, a])) : new Map()
    return buildInterventorias(baseRows, sitiosById, asignacionBySitio)
  }, [baseRows, sitiosById, asignaciones, rutaAplica])

  const loading = loadingInicial || asigLoading

  if (loading) return <div className="empty-state"><p>Cargando información...</p></div>
  if (errorMsg) return <div className="form-error-banner">{errorMsg}</div>

  if (interventorias.length === 0) {
    return <div className="empty-state"><p>No hay interventorías registradas para esta fecha.</p></div>
  }

  return (
    <div className="card interv-card">
      {!rutaAplica && (
        <div className="ciclo-status-badge ciclo-status-warn interv-warning">
          ⚠️ Falta la ruta activa para saber quién es el conductor de estos sitios.
        </div>
      )}
      {interventorias.map(b => (
        <div key={b.idSitio} className="interv-block">
          <div className="interv-block-title">
            {b.sinAsignar && '⚠️ '}
            {b.tipo
              ? `Interventoria Tipo ${b.tipo} - Conductor ${b.conductor}`
              : `Interventoría - Conductor ${b.conductor}`}
          </div>
          <div className="interv-block-detail">COLEGIO {b.nombreInstitucion}</div>
          <div className="interv-block-detail">CONDUCTOR: {b.conductor}</div>
          <div className="interv-block-detail">AUXILIAR: {b.auxiliar}</div>
          <div className="interv-block-detail">VEHICULO: {b.placa}</div>
          {b.suministrosAdicionales?.map((s, i) => (
            <div key={i} className="interv-block-detail interv-block-suministro">
              HACER ENTREGA DE {s.cantidad} SUMINISTRO{s.cantidad === 1 ? '' : 'S'} PARA INTERVENTORIA
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
