'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import LogisticaDespachoEditModal from '../../../../components/LogisticaDespachoEditModal'
import Toast from '../../../../components/Toast'
import { supabase } from '../../../../lib/supabase'
import { fmtN } from '../../../../lib/logisticaWizardCalc'
import { fmtDateCorta } from '../../../../lib/logisticaWizardExcel'

const LINEA_LABEL = { panaderia: 'Panadería', gastronomia: 'Gastronomía' }
const TIPO_EMPAQUE_LABEL = { parafinado: 'Parafinado', parafinado_bolsa: 'Parafinado + bolsa' }

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function haceUnMesISO() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function descargarCsv(filas) {
  const encabezados = ['Fecha despacho', 'Fecha consumo', 'Línea', 'Empaque', 'Ruta', 'Conductor', 'Placa', 'Total sitios', 'Total unidades', 'Total canastillas']
  const lineas = [encabezados.join(',')]
  filas.forEach(f => {
    lineas.push([
      f.fecha_despacho || '',
      f.fecha_consumo || '',
      LINEA_LABEL[f.linea] || f.linea,
      f.tipo_empaque ? (TIPO_EMPAQUE_LABEL[f.tipo_empaque] || f.tipo_empaque) : '',
      f.nombre_ruta,
      f.conductor_nombre || '',
      f.placa || '',
      f.total_sitios,
      f.total_unidades,
      f.total_canastillas,
    ].map(csvEscape).join(','))
  })
  const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `historial_ruteros_${hoyISO()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function HistorialRuterosPage() {
  const [despachos, setDespachos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)

  const [fechaDesde, setFechaDesde] = useState(haceUnMesISO())
  const [fechaHasta, setFechaHasta] = useState(hoyISO())
  const [filtroLinea, setFiltroLinea] = useState('todas')
  const [filtroConductor, setFiltroConductor] = useState('todos')
  const [textoLibre, setTextoLibre] = useState('')

  const [editando, setEditando] = useState(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [borrandoId, setBorrandoId] = useState(null)

  useEffect(() => { fetchDespachos() }, [fechaDesde, fechaHasta])

  async function fetchDespachos() {
    setLoading(true)
    let query = supabase.from('logistica_despachos').select('*').order('fecha_despacho', { ascending: false })
    if (fechaDesde) query = query.gte('fecha_despacho', fechaDesde)
    if (fechaHasta) query = query.lte('fecha_despacho', fechaHasta)
    const { data, error } = await query
    if (error) {
      setErrorMsg('No se pudo cargar el historial de ruteros.')
    } else {
      setDespachos(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const conductoresUnicos = useMemo(
    () => Array.from(new Set(despachos.map(d => d.conductor_nombre).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [despachos]
  )

  const filtrados = useMemo(() => {
    const term = textoLibre.trim().toLowerCase()
    return despachos.filter(d => {
      if (filtroLinea !== 'todas' && d.linea !== filtroLinea) return false
      if (filtroConductor !== 'todos' && d.conductor_nombre !== filtroConductor) return false
      if (!term) return true
      return [d.nombre_ruta, d.conductor_nombre, d.placa].some(v => v != null && String(v).toLowerCase().includes(term))
    })
  }, [despachos, filtroLinea, filtroConductor, textoLibre])

  const totales = useMemo(() => ({
    sitios: filtrados.reduce((s, d) => s + (d.total_sitios || 0), 0),
    unidades: filtrados.reduce((s, d) => s + (d.total_unidades || 0), 0),
    canastillas: filtrados.reduce((s, d) => s + (d.total_canastillas || 0), 0),
  }), [filtrados])

  async function handleBorrar(despacho) {
    if (!window.confirm(`¿Borrar el despacho "${despacho.nombre_ruta}" del ${fmtDateCorta(despacho.fecha_despacho)}? Esta acción no se puede deshacer.`)) return
    setBorrandoId(despacho.id)
    const { error } = await supabase.from('logistica_despachos').delete().eq('id', despacho.id)
    setBorrandoId(null)
    if (error) {
      setToast({ message: 'No se pudo borrar el despacho.', type: 'error' })
    } else {
      setDespachos(prev => prev.filter(d => d.id !== despacho.id))
      setToast({ message: 'Despacho borrado.', type: 'success' })
    }
  }

  async function handleGuardarEdicion(payload) {
    setGuardandoEdicion(true)
    const { data, error } = await supabase.from('logistica_despachos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', editando.id)
      .select()
      .single()
    setGuardandoEdicion(false)
    if (error) {
      setToast({ message: error.code === '23505' ? 'Ya existe un despacho con esa fecha, ruta y línea.' : 'No se pudo guardar el despacho.', type: 'error' })
      return
    }
    setDespachos(prev => prev.map(d => (d.id === editando.id ? data : d)))
    setEditando(null)
    setToast({ message: 'Despacho actualizado.', type: 'success' })
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/operaciones"
          backLabel="Volver"
          title="📋 Historial de ruteros"
          subtitle="Registro persistente de rutas despachadas por día"
        />
        <div className="page-content">
          <div className="rem-stats-row">
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : filtrados.length}</div>
              <div className="rem-stat-label">Ruteros en el filtro</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : fmtN(totales.sitios)}</div>
              <div className="rem-stat-label">Total sitios</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : fmtN(totales.unidades)}</div>
              <div className="rem-stat-label">Total unidades</div>
            </div>
            <div className="rem-stat-card">
              <div className="rem-stat-num">{loading ? '…' : fmtN(totales.canastillas)}</div>
              <div className="rem-stat-label">Total canastillas</div>
            </div>
          </div>

          <div className="page-toolbar spread">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 11 }}>Desde</label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 11 }}>Hasta</label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
              </div>
              <select value={filtroLinea} onChange={e => setFiltroLinea(e.target.value)}>
                <option value="todas">Todas las líneas</option>
                <option value="panaderia">Panadería</option>
                <option value="gastronomia">Gastronomía</option>
              </select>
              <select value={filtroConductor} onChange={e => setFiltroConductor(e.target.value)}>
                <option value="todos">Todos los conductores</option>
                {conductoresUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="text"
                value={textoLibre}
                onChange={e => setTextoLibre(e.target.value)}
                placeholder="🔎 Buscar por ruta, conductor o placa..."
                style={{ minWidth: 240 }}
              />
            </div>
            <button className="btn-secondary" disabled={!filtrados.length} onClick={() => descargarCsv(filtrados)}>⬇ Exportar CSV</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando historial...</p></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><p>No hay ruteros registrados en este filtro.</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha despacho</th>
                    <th>Fecha consumo</th>
                    <th>Línea</th>
                    <th>Empaque</th>
                    <th>Ruta</th>
                    <th>Conductor</th>
                    <th>Placa</th>
                    <th>Sitios</th>
                    <th>Und</th>
                    <th>Canast</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(d => (
                    <tr key={d.id}>
                      <td>{fmtDateCorta(d.fecha_despacho)}</td>
                      <td>{d.fecha_consumo ? fmtDateCorta(d.fecha_consumo) : <span className="logistica-muted">—</span>}</td>
                      <td>{LINEA_LABEL[d.linea] || d.linea}</td>
                      <td>{d.tipo_empaque ? (TIPO_EMPAQUE_LABEL[d.tipo_empaque] || d.tipo_empaque) : <span className="logistica-muted">—</span>}</td>
                      <td>{d.nombre_ruta}</td>
                      <td>{d.conductor_nombre || <span className="logistica-muted">—</span>}</td>
                      <td className="logistica-mono">{d.placa || <span className="logistica-muted">—</span>}</td>
                      <td style={{ textAlign: 'center' }}>{fmtN(d.total_sitios)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtN(d.total_unidades)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtN(d.total_canastillas)}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-secondary" onClick={() => setEditando(d)}>✏️ Editar</button>
                        <button className="btn-danger" disabled={borrandoId === d.id} onClick={() => handleBorrar(d)}>
                          {borrandoId === d.id ? 'Borrando...' : '🗑 Borrar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editando && (
        <LogisticaDespachoEditModal
          despacho={editando}
          saving={guardandoEdicion}
          onClose={() => setEditando(null)}
          onGuardar={handleGuardarEdicion}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
