'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFechaLarga, buildFilasTabla } from '../lib/tablaWhatsappUtils'

export default function MenuDelDia({ fecha, onStatus }) {
  const [productos, setProductos] = useState([])
  const [activeCiclo, setActiveCiclo] = useState(null)
  const [cicloDia, setCicloDia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    async function fetchData() {
      setLoading(true)
      const [{ data: prodData, error: prodError }, { data: cicloData, error: cicloError }, { data: diaData, error: diaError }] = await Promise.all([
        supabase.from('reforzados_productos').select('*'),
        supabase.from('reforzados_ciclos').select('*').eq('estado', 'activo').maybeSingle(),
        supabase
          .from('reforzados_ciclo_dias')
          .select('*, ciclo:reforzados_ciclos(id, nombre_mes, estado)')
          .eq('fecha', fecha)
          .limit(1)
          .maybeSingle(),
      ])
      if (!active) return
      setErrorMsg(prodError || cicloError || diaError ? 'No se pudo cargar la información del menú.' : '')
      setProductos(prodData || [])
      setActiveCiclo(cicloData || null)
      setCicloDia(diaData || null)
      setLoading(false)
    }
    fetchData()
    return () => { active = false }
  }, [fecha])

  const fechaDisplay = useMemo(() => formatFechaLarga(fecha), [fecha])

  const filas = useMemo(() => {
    if (!cicloDia || cicloDia.festivo) return []
    return buildFilasTabla(cicloDia, productos)
  }, [cicloDia, productos])

  useEffect(() => {
    if (loading) return
    onStatus?.({ cicloActivo: !!activeCiclo })
  }, [loading, activeCiclo, onStatus])

  if (loading) return <div className="empty-state"><p>Cargando información...</p></div>
  if (errorMsg) return <div className="form-error-banner">{errorMsg}</div>

  if (cicloDia?.festivo) {
    return (
      <div className="festivo-card">
        <div className="festivo-emoji">🎉</div>
        <div className="festivo-text">FESTIVO — No hay entrega este día</div>
      </div>
    )
  }

  if (!cicloDia) {
    return <div className="empty-state"><p>No hay información de ciclo para esta fecha</p></div>
  }

  return (
    <div className="whatsapp-table-wrap">
      <table className="whatsapp-table">
        <tbody>
          <tr>
            <td colSpan={3} className="wt-header">PROVEEDOR ALINNOVA</td>
          </tr>
          <tr>
            <td className="wt-subtitle">{fechaDisplay}</td>
            <td className="wt-subtitle">MENU {cicloDia.menu_numero ?? '-'}</td>
            <td className="wt-subtitle">Embalaje por Componente</td>
          </tr>
          {filas.map(fila => (
            <tr key={fila.key}>
              <td className="wt-componente">{fila.label}</td>
              <td className="wt-producto">{fila.nombreDisplay}</td>
              <td className="wt-empaque">
                {fila.empaqueLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
