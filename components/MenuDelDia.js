'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatFechaLarga, buildFilasTabla } from '../lib/tablaWhatsappUtils'
import EmbalajeDiaEditor from './EmbalajeDiaEditor'

export default function MenuDelDia({ fecha, onStatus }) {
  const [productos, setProductos] = useState([])
  const [activeCiclo, setActiveCiclo] = useState(null)
  const [cicloDia, setCicloDia] = useState(null)
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    async function fetchData() {
      setLoading(true)
      const [
        { data: prodData, error: prodError },
        { data: cicloData, error: cicloError },
        { data: diaData, error: diaError },
        { data: overridesData, error: overridesError },
      ] = await Promise.all([
        supabase.from('reforzados_productos').select('*'),
        supabase.from('reforzados_ciclos').select('*').eq('estado', 'activo').maybeSingle(),
        supabase
          .from('reforzados_ciclo_dias')
          .select('*, ciclo:reforzados_ciclos(id, nombre_mes, estado)')
          .eq('fecha', fecha)
          .limit(1)
          .maybeSingle(),
        supabase.from('reforzados_override_embalaje_dia').select('*').eq('fecha', fecha),
      ])
      if (!active) return
      setErrorMsg(prodError || cicloError || diaError || overridesError ? 'No se pudo cargar la información del menú.' : '')
      setProductos(prodData || [])
      setActiveCiclo(cicloData || null)
      setCicloDia(diaData || null)
      setOverrides(overridesData || [])
      setLoading(false)
    }
    fetchData()
    return () => { active = false }
  }, [fecha])

  const fechaDisplay = useMemo(() => formatFechaLarga(fecha), [fecha])

  const overridesByProductoId = useMemo(
    () => new Map(overrides.map(o => [o.embalaje_ref, o.unidades_por_canastilla])),
    [overrides]
  )

  const filas = useMemo(() => {
    if (!cicloDia || cicloDia.festivo) return []
    return buildFilasTabla(cicloDia, productos, overridesByProductoId)
  }, [cicloDia, productos, overridesByProductoId])

  const handleOverrideSaved = useCallback((productoId, unidades) => {
    setOverrides(prev => [
      ...prev.filter(o => o.embalaje_ref !== productoId),
      { embalaje_ref: productoId, unidades_por_canastilla: unidades },
    ])
  }, [])

  const handleOverrideRestored = useCallback((productoId) => {
    setOverrides(prev => prev.filter(o => o.embalaje_ref !== productoId))
  }, [])

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
    <div className="menu-dia-layout">
      <div className="menu-dia-left">
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
      </div>
      <div className="menu-dia-right">
        <EmbalajeDiaEditor
          fecha={fecha}
          filas={filas}
          onOverrideSaved={handleOverrideSaved}
          onOverrideRestored={handleOverrideRestored}
        />
      </div>
    </div>
  )
}
