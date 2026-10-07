'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import { fmtN } from '../lib/logisticaWizardCalc'
import { fmtFechaHora } from '../lib/logisticaDespachosGuardados'

// Panel de novedades de un despacho guardado (cancelaciones y adiciones que
// Compensar manda después de la OC). Cada línea del despacho se identifica
// por Punto + Preorden + Nombre (producto del Excel). El panel arma una
// lista de pendientes, la cruza con las líneas, muestra la vista previa y
// entrega los cambios al wizard con onAplicar; no toca el estado directo.

const TIPOS = {
  cancelacion: { label: 'Cancelación', campo: 'Descontar', signo: -1 },
  adicion: { label: 'Adición', campo: 'Agregar', signo: 1 },
}

export function normTexto(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

function normPreorden(s) {
  return String(s || '').trim().replace(/^0+(?=\d)/, '')
}

function parseCantidad(s) {
  const n = parseInt(String(s || '').replace(/[.,\s]/g, ''), 10)
  return isNaN(n) ? null : n
}

let pendSeq = 0
function nuevoPendiente(campos) {
  pendSeq += 1
  return { id: `p${pendSeq}`, lineaIdx: null, crear: null, ...campos }
}

// Filas pegadas desde la tabla del correo: PUNTO, COLEGIO, PRODUCTO,
// CANTIDAD, PROVEEDOR, PREORDEN, FECHA — separadas por tabulador o por 2+
// espacios. Se ignoran encabezados, filas vacías y filas sin punto/cantidad.
export function parsearTextoNovedades(texto) {
  const filas = []
  let ignoradas = 0
  String(texto || '').split(/\r?\n/).forEach(linea => {
    if (!linea.trim()) return
    const cols = (linea.includes('\t') ? linea.split('\t') : linea.trim().split(/ {2,}/)).map(c => c.trim())
    const punto = cols[0] || ''
    const cantidad = parseCantidad(cols[3])
    if (!/^\d+$/.test(punto) || cantidad == null || cols.length < 6) {
      if (!/punto/i.test(linea)) ignoradas += 1
      return
    }
    filas.push({ punto, colegioTexto: cols[1] || '', productoTexto: cols[2] || '', cantidad, preorden: cols[5] || '' })
  })
  return { filas, ignoradas }
}

// Cruce de una fila pendiente con las líneas del despacho.
// Devuelve { estado: 'ok' | 'nueva' | 'rojo', linea?, motivo? }.
function resolver(p, tipo, lineas, puntosNuevos, colegios) {
  if (p.lineaIdx != null) {
    const linea = lineas.find(l => l.idx === p.lineaIdx)
    return linea ? { estado: 'ok', linea } : { estado: 'rojo', motivo: 'Línea no encontrada' }
  }
  if (p.crear) {
    if (tipo !== 'adicion') return { estado: 'rojo', motivo: 'Solo una adición puede crear líneas' }
    if (!p.crear.sap) return { estado: 'rojo', motivo: 'Escoge el producto' }
    if (!p.crear.oc) return { estado: 'rojo', motivo: 'Falta el número de OC' }
    if (!normPreorden(p.preorden)) return { estado: 'rojo', motivo: 'Falta la preorden' }
    if (!colegios[p.punto]) {
      const pn = puntosNuevos[p.punto]
      if (!pn || !pn.nombre?.trim()) return { estado: 'rojo', motivo: 'Falta el nombre del colegio' }
      if (!pn.rutaId) return { estado: 'rojo', motivo: 'Escoge la ruta del colegio' }
    }
    return { estado: 'nueva' }
  }
  const pre = normPreorden(p.preorden)
  const cands = lineas.filter(l => l.punto === p.punto && normPreorden(l.preorden) === pre)
  if (!cands.length) {
    return { estado: 'rojo', motivo: lineas.some(l => l.punto === p.punto) ? 'Preorden no encontrada en el punto' : 'Punto no está en el despacho' }
  }
  const txt = normTexto(p.productoTexto)
  const exactas = cands.filter(l => normTexto(l.nombre) === txt)
  if (exactas.length === 1) return { estado: 'ok', linea: exactas[0] }
  const parciales = txt ? cands.filter(l => normTexto(l.nombre).startsWith(txt) || normTexto(l.nombre).includes(txt)) : []
  if (parciales.length === 1) return { estado: 'ok', linea: parciales[0] }
  return { estado: 'rojo', motivo: parciales.length > 1 ? 'Varias líneas coinciden' : 'Producto no encontrado' }
}

export default function LogisticaNovedadesPanel({
  lineas, colegios, rutas, directorio, productosMaestra, productosDespacho, ocs, novedades, onAplicar, onClose,
}) {
  const [tipo, setTipo] = useState('cancelacion')
  const [pendientes, setPendientes] = useState({ cancelacion: [], adicion: [] })
  const [puntoInput, setPuntoInput] = useState('')
  const [puntoActual, setPuntoActual] = useState('')
  const [valores, setValores] = useState({})
  const [nuevoProd, setNuevoProd] = useState({ preorden: '', sap: '', oc: '', cantidad: '' })
  const [puntosNuevos, setPuntosNuevos] = useState({})
  const [texto, setTexto] = useState('')
  const [textoMsg, setTextoMsg] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const puntoRef = useRef(null)

  const info = TIPOS[tipo]
  const lista = pendientes[tipo]
  const rutaNombre = useMemo(() => new Map(rutas.map(r => [r.id, r.nombre])), [rutas])
  const ocsSeleccionadas = useMemo(() => new Set(ocs.filter(o => o.selected).map(o => o.numero)), [ocs])
  const ocsNoSeleccionadas = useMemo(() => new Set(ocs.filter(o => !o.selected).map(o => o.numero)), [ocs])

  // Productos que se pueden agregar como línea nueva: los de la Data
  // Maestra de las líneas del despacho, salvo los que el despacho dejó por
  // fuera en el paso 3 (si no, se colarían todas sus líneas).
  const productosElegibles = useMemo(() => {
    const lineasNegocio = new Set(productosDespacho.filter(p => p.selected && p.linea).map(p => p.linea))
    const excluidos = new Set(productosDespacho.filter(p => !p.selected).map(p => p.sap))
    return Array.from(productosMaestra.values())
      .filter(m => !excluidos.has(String(m.codigo_articulo)) && (!lineasNegocio.size || lineasNegocio.has(m.modalidad)))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
  }, [productosMaestra, productosDespacho])

  function setLista(fn) { setPendientes(prev => ({ ...prev, [tipo]: fn(prev[tipo]) })) }

  function ocDePreorden(preorden) {
    const pre = normPreorden(preorden)
    return pre ? (lineas.find(l => normPreorden(l.preorden) === pre)?.oc || '') : ''
  }

  function rutaDePunto(punto) {
    const conRuta = lineas.find(l => l.punto === punto && l.rutaId)
    if (conRuta) return conRuta.rutaId
    return puntosNuevos[punto]?.rutaId || null
  }

  function colegioNombre(punto) {
    return colegios[punto]?.nombre || puntosNuevos[punto]?.nombre || ''
  }

  // ---------- Ingreso por punto ----------
  function buscarPunto() {
    const p = puntoInput.trim()
    if (!p) return
    setPuntoActual(p)
    setValores({})
    setNuevoProd({ preorden: '', sap: '', oc: '', cantidad: '' })
    if (!colegios[p] && !puntosNuevos[p]) {
      const dir = directorio.get(p)
      setPuntosNuevos(prev => ({
        ...prev,
        [p]: {
          nombre: dir ? dir.nombre_institucion : '',
          sitioEntrega: dir ? (dir.nombre_sitio || dir.nombre_institucion) : '',
          direccion: dir ? dir.direccion : '',
          localidad: dir ? dir.localidad : '',
          sedeEducativa: dir ? dir.sede_educativa : null,
          tiene_horno: dir ? Boolean(dir.tiene_horno) : false,
          enDirectorio: Boolean(dir),
          rutaId: '',
        },
      }))
    }
  }

  const lineasPunto = useMemo(() => lineas.filter(l => l.punto === puntoActual), [lineas, puntoActual])
  const preordenesPunto = useMemo(() => {
    const m = new Map()
    lineasPunto.forEach(l => {
      const k = l.preorden || '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(l)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
  }, [lineasPunto])

  function agregarDesdePunto() {
    const nuevos = []
    lineasPunto.forEach(l => {
      const cant = parseCantidad(valores[l.idx])
      if (cant && cant > 0) {
        nuevos.push(nuevoPendiente({
          punto: l.punto, preorden: l.preorden, productoTexto: l.nombre, cantidad: cant,
          colegioTexto: colegioNombre(l.punto), lineaIdx: l.idx,
        }))
      }
    })
    const cantNuevo = parseCantidad(nuevoProd.cantidad)
    if (tipo === 'adicion' && nuevoProd.sap && cantNuevo > 0) {
      const m = productosMaestra.get(nuevoProd.sap)
      nuevos.push(nuevoPendiente({
        punto: puntoActual, preorden: nuevoProd.preorden.trim(), productoTexto: m?.nombre || nuevoProd.sap,
        cantidad: cantNuevo, colegioTexto: colegioNombre(puntoActual),
        crear: { sap: nuevoProd.sap, oc: nuevoProd.oc.trim() || ocDePreorden(nuevoProd.preorden) },
      }))
    }
    if (!nuevos.length) return
    setLista(prev => [...prev, ...nuevos])
    setValores({})
    setNuevoProd({ preorden: '', sap: '', oc: '', cantidad: '' })
    setPuntoInput('')
    setPuntoActual('')
    puntoRef.current?.focus()
  }

  function onEnterAgregar(e) {
    if (e.key === 'Enter') { e.preventDefault(); agregarDesdePunto() }
  }

  // ---------- Pegar texto ----------
  function leerTexto() {
    const { filas, ignoradas } = parsearTextoNovedades(texto)
    if (!filas.length) {
      setTextoMsg('No se encontró ninguna fila válida (PUNTO, COLEGIO, PRODUCTO, CANTIDAD, PROVEEDOR, PREORDEN, FECHA).')
      return
    }
    setLista(prev => [...prev, ...filas.map(f => nuevoPendiente(f))])
    setTexto('')
    setTextoMsg(`${filas.length} fila(s) agregadas a la lista${ignoradas ? ` · ${ignoradas} fila(s) no se pudieron leer` : ''}.`)
  }

  // ---------- Resolución y vista previa ----------
  function setPendiente(id, patch) { setLista(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p)) }
  function quitarPendiente(id) { setLista(prev => prev.filter(p => p.id !== id)) }

  function elegirLinea(p, valor) {
    if (valor === '') setPendiente(p.id, { lineaIdx: null, crear: null })
    else if (valor === 'crear') setPendiente(p.id, { lineaIdx: null, crear: { sap: '', oc: ocDePreorden(p.preorden) } })
    else setPendiente(p.id, { lineaIdx: Number(valor), crear: null })
  }

  // Simula los cambios en orden (varias filas pueden tocar la misma línea).
  const vista = useMemo(() => {
    const actual = new Map()
    return lista.map(p => {
      const res = resolver(p, tipo, lineas, puntosNuevos, colegios)
      const cambio = info.signo * (p.cantidad || 0)
      let antes = null, despues = null, error = ''
      let clave = null, producto = p.productoTexto, preorden = p.preorden, rutaId = null
      if (res.estado === 'ok') {
        clave = `l${res.linea.idx}`
        antes = actual.has(clave) ? actual.get(clave) : res.linea.cantidad
        producto = res.linea.nombre
        preorden = res.linea.preorden
        rutaId = res.linea.rutaId
      } else if (res.estado === 'nueva') {
        clave = `n|${p.punto}|${normPreorden(p.preorden)}|${p.crear.sap}`
        antes = actual.has(clave) ? actual.get(clave) : 0
        producto = productosMaestra.get(p.crear.sap)?.nombre || p.crear.sap
        rutaId = rutaDePunto(p.punto)
        if (ocsNoSeleccionadas.has(p.crear.oc)) error = `La OC ${p.crear.oc} no está seleccionada en este despacho`
      }
      if (clave) {
        despues = antes + cambio
        actual.set(clave, despues)
        if (!p.cantidad || p.cantidad <= 0) error = 'La cantidad debe ser mayor que 0'
        else if (despues < 0) error = 'La cantidad nueva queda negativa'
      }
      return { p, res, antes, cambio, despues, error, producto, preorden, rutaId }
    })
  }, [lista, tipo, lineas, puntosNuevos, colegios, info.signo, productosMaestra, ocsNoSeleccionadas])

  const hayBloqueo = vista.some(v => v.res.estado === 'rojo' || v.error)
  const puedeAplicar = vista.length > 0 && !hayBloqueo && !aplicando

  async function aplicar() {
    if (!puedeAplicar) return
    setAplicando(true)
    try {
      const filas = vista.map(v => ({
        lineaIdx: v.res.estado === 'ok' ? v.res.linea.idx : null,
        crear: v.res.estado === 'nueva' ? { ...v.p.crear, preorden: v.p.preorden.trim(), punto: v.p.punto } : null,
        punto: v.p.punto,
        colegio: colegioNombre(v.p.punto) || v.p.colegioTexto,
        preorden: v.preorden,
        producto: v.producto,
        antes: v.antes,
        cambio: v.cambio,
        despues: v.despues,
        rutaId: v.rutaId,
        ruta: rutaNombre.get(v.rutaId) || '',
      }))
      const usados = {}
      filas.forEach(f => { if (f.crear && !colegios[f.punto] && puntosNuevos[f.punto]) usados[f.punto] = puntosNuevos[f.punto] })
      await onAplicar(tipo, filas, usados)
      setPendientes(prev => ({ ...prev, [tipo]: [] }))
    } finally {
      setAplicando(false)
    }
  }

  const puntoNuevoActual = puntoActual && !colegios[puntoActual] ? puntosNuevos[puntoActual] : null
  const historial = [...(novedades || [])].reverse()

  return (
    <div className="modal-overlay" onClick={aplicando ? undefined : onClose}>
      <div className="modal-box modal-box-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📝 Aplicar novedades</div>

        <div className="logistica-filter-tabs">
          {Object.entries(TIPOS).map(([k, t]) => (
            <button key={k} className={`logistica-filter-tab ${tipo === k ? 'active' : ''}`} onClick={() => setTipo(k)}>
              {t.label}{pendientes[k].length ? ` (${pendientes[k].length})` : ''}
            </button>
          ))}
        </div>

        <h4 style={{ margin: '12px 0 6px' }}>🔎 Ingreso por punto</h4>
        <div className="wizard-config-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Punto</label>
            <input
              ref={puntoRef}
              autoFocus
              type="text"
              value={puntoInput}
              placeholder="Ej. 2110"
              onChange={e => setPuntoInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarPunto() } }}
            />
          </div>
          <button className="btn-secondary" onClick={buscarPunto}>Buscar</button>
        </div>

        {puntoActual && (
          <div className="wizard-config-card" style={{ marginTop: 10 }}>
            {colegios[puntoActual] ? (
              <div className="modal-hint">
                <b>{puntoActual}</b> — {colegios[puntoActual].nombre} · Ruta: <b>{rutaNombre.get(rutaDePunto(puntoActual)) || 'sin ruta'}</b>
              </div>
            ) : tipo === 'cancelacion' ? (
              <div className="form-error-banner">El punto {puntoActual} no está en este despacho.</div>
            ) : puntoNuevoActual && (
              <div>
                <div className="modal-hint modal-hint-warning">
                  El punto {puntoActual} no está en el despacho.{puntoNuevoActual.enDirectorio ? ' Datos tomados del Directorio de colegios.' : ' No está en el Directorio: escribe nombre y dirección.'} Escoge la ruta.
                </div>
                <div className="wizard-config-row">
                  <div className="form-group">
                    <label>Nombre del colegio</label>
                    <input type="text" value={puntoNuevoActual.nombre} onChange={e => setPuntosNuevos(prev => ({ ...prev, [puntoActual]: { ...prev[puntoActual], nombre: e.target.value, sitioEntrega: prev[puntoActual].sitioEntrega || e.target.value } }))} />
                  </div>
                  <div className="form-group">
                    <label>Dirección</label>
                    <input type="text" value={puntoNuevoActual.direccion || ''} onChange={e => setPuntosNuevos(prev => ({ ...prev, [puntoActual]: { ...prev[puntoActual], direccion: e.target.value } }))} />
                  </div>
                  <div className="form-group">
                    <label>Ruta</label>
                    <select value={puntoNuevoActual.rutaId} onChange={e => setPuntosNuevos(prev => ({ ...prev, [puntoActual]: { ...prev[puntoActual], rutaId: e.target.value } }))}>
                      <option value="">— Escoge la ruta —</option>
                      {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {preordenesPunto.length > 0 && (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Preorden</th><th>Producto</th><th>Cantidad actual</th><th style={{ width: 120 }}>{info.campo}</th></tr>
                  </thead>
                  <tbody>
                    {preordenesPunto.map(([pre, ls]) => ls.map((l, i) => (
                      <tr key={l.idx}>
                        {i === 0 && <td rowSpan={ls.length} className="logistica-mono">{pre}</td>}
                        <td>{l.nombre}</td>
                        <td>{fmtN(l.cantidad)}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={valores[l.idx] ?? ''}
                            onChange={e => setValores(v => ({ ...v, [l.idx]: e.target.value }))}
                            onKeyDown={onEnterAgregar}
                            style={{ width: 100 }}
                          />
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}

            {tipo === 'adicion' && (colegios[puntoActual] || puntoNuevoActual) && (
              <div style={{ marginTop: 10 }}>
                <div className="logistica-muted" style={{ marginBottom: 6 }}>➕ Producto nuevo en este punto (desde Data Maestra)</div>
                <div className="wizard-config-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label>Preorden</label>
                    <input type="text" value={nuevoProd.preorden} onChange={e => setNuevoProd(n => ({ ...n, preorden: e.target.value, oc: ocDePreorden(e.target.value) || n.oc }))} />
                  </div>
                  <div className="form-group" style={{ minWidth: 260 }}>
                    <label>Producto</label>
                    <select value={nuevoProd.sap} onChange={e => setNuevoProd(n => ({ ...n, sap: e.target.value }))}>
                      <option value="">— Escoge el producto —</option>
                      {productosElegibles.map(m => <option key={m.codigo_articulo} value={String(m.codigo_articulo)}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Numero OC</label>
                    <input type="text" value={nuevoProd.oc} placeholder={ocDePreorden(nuevoProd.preorden) ? '' : 'Escribe la OC'} onChange={e => setNuevoProd(n => ({ ...n, oc: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Agregar</label>
                    <input type="number" min="0" value={nuevoProd.cantidad} onChange={e => setNuevoProd(n => ({ ...n, cantidad: e.target.value }))} onKeyDown={onEnterAgregar} style={{ width: 100 }} />
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn-primary" onClick={agregarDesdePunto}>➕ Agregar a la lista</button>
            </div>
          </div>
        )}

        <details className="bs-mapeo-details" style={{ marginTop: 12 }}>
          <summary className="bs-mapeo-summary">📋 Pegar texto del correo</summary>
          <div className="bs-mapeo-body">
            <div className="modal-hint">Pega las filas en el orden de la tabla: PUNTO · NOMBRE COLEGIO · PRODUCTO · CANTIDAD · NOMBRE PROVEEDOR · No. PREORDEN · FECHA ENTREGA (separadas por tabulador o por 2 o más espacios).</div>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} />
            <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn-secondary" onClick={leerTexto} disabled={!texto.trim()}>➕ Pasar a la lista</button>
              {textoMsg && <span className="logistica-muted">{textoMsg}</span>}
            </div>
          </div>
        </details>

        <h4 style={{ margin: '16px 0 6px' }}>👁 Vista previa — {info.label}</h4>
        {!vista.length ? (
          <div className="empty-state"><p>No hay filas pendientes.</p></div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Punto</th><th>Colegio</th><th>Preorden</th><th>Producto</th><th>Ruta</th>
                  <th>Cantidad actual</th><th>Cambio</th><th>Cantidad nueva</th><th></th>
                </tr>
              </thead>
              <tbody>
                {vista.map(v => {
                  const rojo = v.res.estado === 'rojo' || Boolean(v.error)
                  const opcionesLinea = lineas.filter(l => l.punto === v.p.punto)
                  return (
                    <Fragment key={v.p.id}>
                      <tr className={rojo ? 'logistica-row-highlight' : ''}>
                        <td className="logistica-mono">{v.p.punto}</td>
                        <td>{colegioNombre(v.p.punto) || v.p.colegioTexto}</td>
                        <td className="logistica-mono">{v.preorden}</td>
                        <td>
                          {v.producto}
                          {v.res.estado === 'nueva' && <div className="wizard-sugerida-hint">➕ Línea nueva · OC {v.p.crear.oc}</div>}
                        </td>
                        <td>{rutaNombre.get(v.rutaId) || '—'}</td>
                        <td>{v.antes == null ? '—' : fmtN(v.antes)}</td>
                        <td><b>{v.cambio > 0 ? `+${fmtN(v.cambio)}` : `-${fmtN(-v.cambio)}`}</b></td>
                        <td>
                          {v.despues == null ? '—' : fmtN(v.despues)}
                          {v.despues === 0 && !v.error && <div style={{ fontSize: 10, color: '#c0392b' }}>Cancelación total de la línea</div>}
                        </td>
                        <td><button className="btn-secondary" onClick={() => quitarPendiente(v.p.id)} title="Quitar de la lista">✕</button></td>
                      </tr>
                      {rojo && (
                        <tr className="logistica-row-highlight">
                          <td colSpan={9}>
                            <span style={{ color: '#c0392b', fontWeight: 600 }}>⚠ {v.error || v.res.motivo}</span>
                            {!v.error || v.res.estado === 'rojo' ? (
                              <span style={{ marginLeft: 10 }}>
                                <select value={v.p.crear ? 'crear' : (v.p.lineaIdx ?? '')} onChange={e => elegirLinea(v.p, e.target.value)}>
                                  <option value="">— Escoge la línea —</option>
                                  {opcionesLinea.map(l => (
                                    <option key={l.idx} value={l.idx}>Preorden {l.preorden || '—'} · {l.nombre} ({fmtN(l.cantidad)})</option>
                                  ))}
                                  {tipo === 'adicion' && <option value="crear">➕ Crear línea nueva…</option>}
                                </select>
                                {v.p.crear && (
                                  <>
                                    {' '}
                                    <input type="text" value={v.p.preorden} placeholder="Preorden" style={{ width: 90 }} onChange={e => setPendiente(v.p.id, { preorden: e.target.value, crear: { ...v.p.crear, oc: v.p.crear.oc || ocDePreorden(e.target.value) } })} />
                                    {' '}
                                    <select value={v.p.crear.sap} onChange={e => setPendiente(v.p.id, { crear: { ...v.p.crear, sap: e.target.value } })}>
                                      <option value="">— Producto —</option>
                                      {productosElegibles.map(m => <option key={m.codigo_articulo} value={String(m.codigo_articulo)}>{m.nombre}</option>)}
                                    </select>
                                    {' '}
                                    <input type="text" value={v.p.crear.oc} placeholder="Numero OC" style={{ width: 110 }} onChange={e => setPendiente(v.p.id, { crear: { ...v.p.crear, oc: e.target.value.trim() } })} />
                                    {!colegios[v.p.punto] && <span className="logistica-muted"> · Completa el colegio y la ruta buscando el punto {v.p.punto} arriba.</span>}
                                  </>
                                )}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn-secondary" onClick={onClose} disabled={aplicando}>Cerrar</button>
          <button className="btn-primary" disabled={!puedeAplicar} onClick={aplicar}>
            {aplicando ? 'Aplicando...' : `✅ Aplicar ${info.label.toLowerCase()} (${vista.length})`}
          </button>
        </div>

        <h4 style={{ margin: '20px 0 6px' }}>🕑 Historial de novedades</h4>
        {!historial.length ? (
          <div className="empty-state"><p>Este despacho no tiene novedades aplicadas.</p></div>
        ) : historial.map((n, i) => (
          <details key={`${n.fecha}-${i}`} className="bs-mapeo-details" style={{ marginBottom: 6 }}>
            <summary className="bs-mapeo-summary">
              {fmtFechaHora(n.fecha)} · {TIPOS[n.tipo]?.label || n.tipo} · {n.filas?.length || 0} fila(s)
            </summary>
            <div className="bs-mapeo-body">
              <table className="data-table">
                <thead>
                  <tr><th>Punto</th><th>Preorden</th><th>Producto</th><th>Ruta</th><th>Antes</th><th>Cambio</th><th>Después</th></tr>
                </thead>
                <tbody>
                  {(n.filas || []).map((f, j) => (
                    <tr key={j}>
                      <td className="logistica-mono">{f.punto}</td>
                      <td className="logistica-mono">{f.preorden}</td>
                      <td>{f.producto}</td>
                      <td>{f.ruta || '—'}</td>
                      <td>{fmtN(f.antes)}</td>
                      <td>{f.cambio > 0 ? `+${fmtN(f.cambio)}` : `-${fmtN(-f.cambio)}`}</td>
                      <td>{fmtN(f.despues)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
