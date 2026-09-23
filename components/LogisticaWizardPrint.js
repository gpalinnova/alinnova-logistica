'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { canastillasDe, fmtN, fmtP } from '../lib/logisticaWizardCalc'
import { fmtDateCorta, normalizarFecha } from '../lib/logisticaWizardExcel'
import { filasNoAmPm, separarAmPmPorHorno } from '../lib/logisticaEmpaqueAmpm'
import { RuteroPageAmPmSinHorno, RuteroPageAmPmConHorno } from './RuteroPageAmPm'

const COL_FALLBACK = { nombre: '?', direccion: '—', localidad: '—', sedeEducativa: '—', sitioEntrega: '?' }

const LINEA_LABEL = { panaderia: 'Panadería', am_pm: 'AM-PM', gastronomia: 'Gastronomía' }

// Proveedor fijo del resumen de OC: siempre Alinnova, sin importar la OC de
// origen — no viene del Excel del cliente.
const PROVEEDOR_FIJO = '4000026226'
const NOMBRE_PROVEEDOR_FIJO = 'ALINNOVA SAS'

// La OC llega con líneas mezcladas, así que la línea de producción del
// rutero/remisión se calcula a partir de los productos que realmente
// contiene esa ruta/entrega, no de una pantalla fija.
function lineaLabelDeFilas(filas) {
  const set = new Set()
  filas.forEach(f => { if (f.producto?.linea) set.add(LINEA_LABEL[f.producto.linea] || f.producto.linea) })
  if (!set.size) return 'Sin clasificar'
  return Array.from(set).join(' / ')
}

function construirRutero(ruta, filas, colegios) {
  const productosPorSap = new Map()
  filas.forEach(f => { if (!productosPorSap.has(f.sap)) productosPorSap.set(f.sap, f.producto) })
  const productos = Array.from(productosPorSap.keys()).sort().map(sap => productosPorSap.get(sap))

  const puntos = []
  const vistos = new Set()
  filas.forEach(f => { if (!vistos.has(f.punto)) { vistos.add(f.punto); puntos.push(f.punto) } })

  const matriz = {}
  puntos.forEach(p => { matriz[p] = {} })
  filas.forEach(f => { matriz[f.punto][f.sap] = (matriz[f.punto][f.sap] || 0) + f.cantidad })

  const filasRender = puntos.map(punto => {
    const col = colegios[punto] || { ...COL_FALLBACK, punto }
    const rowData = productos.map(prod => {
      const cant = matriz[punto][prod.sap] || 0
      const { base, sueltas } = canastillasDe(cant, prod.embalaje)
      return { cant, canast: base, sueltas }
    })
    return { col, rowData }
  })

  const totales = productos.map((prod, pi) => {
    let totCant = 0
    filasRender.forEach(f => { totCant += f.rowData[pi].cant })
    const { base, sueltas, total } = canastillasDe(totCant, prod.embalaje)
    return { cant: totCant, canast: base, sueltas, canastTotal: total }
  })

  const totalUnidades = totales.reduce((s, t) => s + t.cant, 0)
  const totalCanastillas = totales.reduce((s, t) => s + t.canastTotal, 0)

  return { productos, filasRender, totales, totalUnidades, totalCanastillas }
}

function shortName(producto) {
  return producto.nombre || producto.nombreCompleto || producto.sap
}

// Arma el resumen de OC: una fila por artículo distinto, agrupado por
// Proveedor (fijo) + Fecha_Entrega normalizada + Artículo + Fecha de
// consumo normalizada — NO por Numero OC. El mismo artículo/entrega/consumo
// puede venir repartido bajo distintos números de OC en el Excel del
// cliente (o con la fecha de consumo escrita en formatos distintos, p.ej.
// "25/09/2026" vs "25-09-26"), y el resumen debe mostrar un solo renglón
// para eso. normalizarFecha() hace que ambos formatos caigan en la misma
// llave; cuando una fecha no se puede normalizar, se agrupa por su texto
// crudo (mejor que perder la fila). Las unidades se suman en crudo al
// fusionar renglones. Se ordena por fecha de consumo normalizada para que
// el rowSpan de Fechas_consumo agrupe filas contiguas correctamente.
export function buildResumenOC(datos) {
  const grupos = new Map()
  datos.forEach(({ filas: filasRuta }) => {
    filasRuta.forEach(f => {
      const entregaNorm = normalizarFecha(f.fecha_entrega) || f.fecha_entrega || ''
      const consumoNorm = normalizarFecha(f.fecha_consumo_texto) || normalizarFecha(f.fecha_consumo)
      const consumoKey = consumoNorm || f.fecha_consumo_texto || ''
      const key = `${PROVEEDOR_FIJO}|${entregaNorm}|${f.sap}|${consumoKey}`
      if (!grupos.has(key)) {
        grupos.set(key, {
          oc: f.oc,
          sap: f.sap,
          nombre: f.producto?.nombreCompleto || f.producto?.nombre || f.sap,
          fecha_consumo_norm: consumoNorm,
          fecha_consumo_texto: f.fecha_consumo_texto || '',
          cantidad: 0,
        })
      }
      grupos.get(key).cantidad += f.cantidad || 0
    })
  })
  const filas = Array.from(grupos.values())
  filas.sort((a, b) => (a.fecha_consumo_norm || a.fecha_consumo_texto || '').localeCompare(b.fecha_consumo_norm || b.fecha_consumo_texto || ''))
  return filas
}

// fecha_consumo_norm ya viene normalizada (dd/mm/yy, dd-mm-yy, dd.mm.yyyy,
// serial de Excel, etc. — todo cae en el mismo formato dd/mm/yyyy acá);
// cuando es texto libre (p.ej. "21 Y 22 SEPTIEMBRE 2026") no se pudo
// interpretar como fecha y se muestra tal cual vino, sin romper la tabla.
function fmtFechaConsumo(f) {
  if (f.fecha_consumo_norm) return fmtDateCorta(f.fecha_consumo_norm)
  return f.fecha_consumo_texto || '—'
}

// Sugerido por defecto para la Fecha_Entrega editable de ResumenOC: hoy + 1
// día en hora LOCAL. new Date().toISOString() queda prohibido a propósito:
// después de las 7pm en Bogotá (UTC-5) ya cruzó medianoche UTC y daría
// pasado mañana.
function mañanaLocalISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Calcula, para cada fila, cuántas filas consecutivas comparten el mismo
// valor (según getValue) a partir de ahí: spans[i] > 0 → esa fila abre un
// rowSpan de ese tamaño; spans[i] === 0 → la fila queda cubierta por el
// rowSpan de una fila anterior y no debe renderizar celda en esa columna.
function computeRowSpans(filas, getValue) {
  const spans = new Array(filas.length).fill(0)
  let i = 0
  while (i < filas.length) {
    const val = getValue(filas[i])
    let j = i + 1
    while (j < filas.length && getValue(filas[j]) === val) j++
    spans[i] = j - i
    i = j
  }
  return spans
}

// Tabla de resumen de OC (Proveedor · Nombre_Proveedor · Fecha_Entrega ·
// Artículo · Nombre · Fechas_consumo), en el formato oficial que espera el
// cliente. Se usa solo en pantalla (Paso 7), para captura. La Fecha_Entrega
// ya no sale del Excel: es editable acá, sugerida en mañana por defecto, y
// vive en un useState local (no se persiste; al recargar vuelve a mañana).
export function ResumenOC({ datos }) {
  const filas = buildResumenOC(datos)
  const [fechaEntrega, setFechaEntrega] = useState(mañanaLocalISO)
  const [editandoFecha, setEditandoFecha] = useState(false)

  if (!filas.length) return null

  const spansConsumo = computeRowSpans(filas, f => f.fecha_consumo_norm || f.fecha_consumo_texto || '')

  return (
    <>
      <div className="wp-resumen-title">RESUMEN DE PRODUCTOS DESPACHADOS</div>
      <table className="resumen-oc-tabla">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Nombre_Proveedor</th>
            <th>Fecha_Entrega</th>
            <th>Artículo</th>
            <th>Nombre</th>
            <th>Fechas_consumo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${f.oc}-${f.sap}-${i}`} className={i % 2 === 1 ? 'resumen-oc-alt' : undefined}>
              {i === 0 && <td rowSpan={filas.length} className="resumen-oc-c">{PROVEEDOR_FIJO}</td>}
              {i === 0 && <td rowSpan={filas.length} className="resumen-oc-c">{NOMBRE_PROVEEDOR_FIJO}</td>}
              {i === 0 && (
                <td rowSpan={filas.length} className="resumen-oc-c">
                  {editandoFecha ? (
                    <input
                      type="date"
                      className="resumen-oc-fecha-input"
                      value={fechaEntrega}
                      autoFocus
                      onChange={e => {
                        if (!e.target.value) return
                        setFechaEntrega(e.target.value)
                        setEditandoFecha(false)
                      }}
                      onBlur={() => setEditandoFecha(false)}
                    />
                  ) : (
                    <span className="resumen-oc-fecha-editable" onClick={() => setEditandoFecha(true)}>
                      {fmtDateCorta(fechaEntrega)}
                      <span
                        className="resumen-oc-fecha-icon"
                        title="Editar fecha de entrega"
                        onClick={e => { e.stopPropagation(); setEditandoFecha(true) }}
                      >
                        {' '}✏️
                      </span>
                    </span>
                  )}
                </td>
              )}
              <td className="resumen-oc-c">{f.sap}</td>
              <td className="resumen-oc-l">{f.nombre}</td>
              {spansConsumo[i] > 0 && (
                <td rowSpan={spansConsumo[i]} className="resumen-oc-c">
                  {fmtFechaConsumo(f)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function RuteroPage({ ruta, filas, colegios, fechaEntrega, tituloOverride, nombreRutaOverride }) {
  const { productos, filasRender, totales, totalUnidades, totalCanastillas } = construirRutero(ruta, filas, colegios)
  const numProd = productos.length
  const lineaLabel = lineaLabelDeFilas(filas)
  const consolidada = Boolean(ruta.esConsolidada)
  const titulo = tituloOverride || `RUTERO SUMINISTRO ${lineaLabel.toUpperCase()}`
  const nombreRutaMostrar = nombreRutaOverride || ruta.nombre

  if (!filas.length) {
    return (
      <div className="wizard-print-page landscape">
        <h2>Ruta {ruta.nombre}</h2>
        <p>Sin colegios asignados.</p>
      </div>
    )
  }

  const colegiosCount = new Set(filas.map(f => f.punto)).size

  return (
    <div className="wizard-print-page landscape">
      <div className="wp-rut-head">
        <div className="wp-rut-head-logo"><div className="wp-logo-box">ALINNOVA</div></div>
        <div className="wp-rut-head-title">{titulo}</div>
        <div className="wp-rut-head-code">
          <div className="wp-code-row"><div className="wp-code-lbl">CÓDIGO</div><div className="wp-code-val">RF-FO-002-PD</div></div>
          <div className="wp-code-row"><div className="wp-code-lbl">VERSIÓN</div><div className="wp-code-val">1</div></div>
          <div className="wp-code-row"><div className="wp-code-lbl">F. ELABORACIÓN</div><div className="wp-code-val">18/04/2024</div></div>
        </div>
      </div>

      <div className="wp-rut-info">
        <div className="wp-ri"><b>RUTA:</b> <span className="wp-val">{consolidada ? `${nombreRutaMostrar} → ${ruta.destinoFijo}` : nombreRutaMostrar}</span></div>
        <div className="wp-ri"><b>CONDUCTOR:</b> <span className="wp-val">{ruta.conductor || '________________'}</span></div>
        <div className="wp-ri"><b>PLACA:</b> <span className="wp-val">{ruta.placa || '__________'}</span></div>
      </div>

      <table className="wp-rut-table">
        <thead>
          <tr>
            <th rowSpan={3} style={{ width: 55 }}>ID SITIO<br />ENTREGA</th>
            <th rowSpan={3} style={{ width: 155 }}>NOMBRE INSTITUCIÓN<br />EDUCATIVA</th>
            <th rowSpan={3} style={{ width: 135 }}>DIRECCIÓN DE ENTREGA</th>
            <th colSpan={numProd} className="wp-h-group">REFERENCIA</th>
            <th colSpan={numProd * 2} className="wp-h-group">EMBALAJE POR REFERENCIA</th>
          </tr>
          <tr>
            {productos.map(p => <th key={`r-${p.sap}`} rowSpan={2} style={{ width: 55, fontSize: '7pt' }}>{shortName(p)}</th>)}
            {productos.map(p => (
              <th key={`e-${p.sap}`} colSpan={2} className="wp-h-group" style={{ fontSize: '7pt' }}>
                {shortName(p)}<br /><span style={{ fontSize: '6pt', fontWeight: 400 }}>{p.embalaje || 0} UND</span>
              </th>
            ))}
          </tr>
          <tr>
            {productos.map(p => [
              <th key={`c-${p.sap}`} style={{ width: 32, fontSize: '6.5pt' }}>CANAST</th>,
              <th key={`u-${p.sap}`} style={{ width: 28, fontSize: '6.5pt' }}>UND</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {consolidada ? (
            <tr>
              <td className="wp-mono">—</td>
              <td className="wp-tdl" colSpan={2}><b>{ruta.destinoFijo}</b> — {colegiosCount} colegio(s) consolidados</td>
              {totales.map((t, i) => <td key={`c${i}`} className="wp-tdr">{fmtN(t.cant)}</td>)}
              {totales.map((t, i) => [
                <td key={`ca${i}`}>{t.canast}</td>,
                <td key={`s${i}`}>{t.sueltas}</td>,
              ])}
            </tr>
          ) : (
            <>
              {filasRender.map(f => (
                <tr key={f.col.punto}>
                  <td className="wp-mono">{f.col.punto}</td>
                  <td className="wp-tdl">{f.col.nombre}</td>
                  <td className="wp-tdl" style={{ fontSize: '7pt' }}>{f.col.direccion || '—'}</td>
                  {f.rowData.map((rd, i) => <td key={`c${i}`} className="wp-tdr">{rd.cant || ''}</td>)}
                  {f.rowData.map((rd, i) => [
                    <td key={`ca${i}`}>{rd.canast || 0}</td>,
                    <td key={`s${i}`}>{rd.sueltas || 0}</td>,
                  ])}
                </tr>
              ))}
              <tr className="wp-total-row">
                <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
                {totales.map((t, i) => <td key={`tc${i}`}>{fmtN(t.cant)}</td>)}
                {totales.map((t, i) => [
                  <td key={`tca${i}`}>{t.canast}</td>,
                  <td key={`ts${i}`}>{t.sueltas}</td>,
                ])}
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div className="wp-rut-foot">
        <div className="wp-foot-signs">
          <div className="wp-sign-row">
            <div className="wp-sf"><b>CONDUCTOR:</b> <span className="wp-sign-line" style={{ minWidth: 200 }}>{ruta.conductor || ''}</span></div>
            <div className="wp-sf"><b>FIRMA:</b> <span className="wp-sign-line" style={{ minWidth: 180 }}>&nbsp;</span></div>
          </div>
          <div className="wp-sign-row">
            <div className="wp-sf"><b>FECHA:</b> <span className="wp-sign-line" style={{ minWidth: 120 }}>{fmtDateCorta(fechaEntrega)}</span></div>
          </div>
        </div>
        <div className="wp-foot-totals">
          <table>
            <tbody>
              <tr><td className="wp-lbl">TOTAL UNIDADES</td><td className="wp-lbl">TOTAL CANASTILLAS</td></tr>
              <tr><td className="wp-val-big">{fmtN(totalUnidades)}</td><td className="wp-val-big">{totalCanastillas}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="wp-rut-lote">
        <table>
          <thead>
            <tr><th style={{ width: '40%' }}>PRODUCTOS</th><th style={{ width: '30%' }}>FECHA DE VENCIMIENTO</th><th>LOTE</th></tr>
          </thead>
          <tbody>
            {productos.map(p => <tr key={p.sap}><td className="wp-tdl">{p.nombreCompleto || p.nombre}</td><td></td><td></td></tr>)}
            <tr><td className="wp-tdl"><b>UNIDADES ADICIONALES</b></td><td colSpan={2} style={{ textAlign: 'left' }}><b>CANTIDAD:</b></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RemisionPage({ ruta, punto, filasCol, nro, fechaEmision, fechaEntrega, colegios }) {
  const col = colegios[punto] || { ...COL_FALLBACK, punto }
  const oc = filasCol[0]?.oc
  const lineaLabel = lineaLabelDeFilas(filasCol)

  const itemsMap = new Map()
  filasCol.forEach(f => {
    if (!itemsMap.has(f.sap)) itemsMap.set(f.sap, { sap: f.sap, producto: f.producto, cant: 0 })
    itemsMap.get(f.sap).cant += f.cantidad
  })
  const itemsArr = Array.from(itemsMap.values()).map(it => {
    const precio = it.producto?.precio || 0
    return { ...it, nombre: it.producto?.nombreCompleto || it.producto?.nombre || it.sap, precio, total: precio * it.cant }
  })
  const totCant = itemsArr.reduce((s, i) => s + i.cant, 0)
  const totVal = itemsArr.reduce((s, i) => s + i.total, 0)

  return (
    <div className="wizard-print-page wp-rem-page">
      <div className="wp-rem-hdr">
        <div className="wp-rem-hdr-logo"><div className="wp-logo-box">ALINNOVA</div></div>
        <div className="wp-rem-hdr-empresa">
          <div className="wp-he-line"><b>Razón Social:</b> ALINNOVA S.A.S &nbsp;&nbsp; <b>NIT:</b> 901.015.983-9</div>
          <div className="wp-he-line"><b>Dirección:</b> Cra. 69B 77 - 44 &nbsp;&nbsp; <b>TEL:</b> 310 309 50 96</div>
          <div className="wp-he-line"><b>Línea de Producción:</b> {lineaLabel}</div>
        </div>
        <div className="wp-rem-hdr-num">
          <div className="wp-hn-titulo">REMISIÓN</div>
          <div className="wp-hn-line"><b>Nro</b> {nro}</div>
          <div className="wp-hn-line"><b>FECHA</b> {fmtDateCorta(fechaEmision)}</div>
          <div className="wp-hn-line"><b>OC</b> {oc || '—'}</div>
          <div className="wp-hn-copia">COPIA VALORIZADA</div>
        </div>
      </div>

      <div className="wp-rem-inst">
        <div><b>Institución:</b> {col.nombre}</div>
        <div><b>Sitio de Entrega:</b> {col.sitioEntrega || col.nombre}</div>
        <div><b>Dirección:</b> {col.direccion || '—'}</div>
        <div className="wp-rem-inst-row">
          <span><b>Id Punto Entrega:</b> {col.punto}</span>
          <span><b>Zona de Entrega:</b> {col.localidad}</span>
          <span><b>Sede Educativa:</b> {col.sedeEducativa || '—'}</span>
        </div>
        <div><b>Fecha de Entrega:</b> {fmtDateCorta(fechaEntrega)}</div>
        <div><b>Ruta:</b> {ruta.nombre} &nbsp;·&nbsp; <b>Conductor:</b> {ruta.conductor || '—'} &nbsp;·&nbsp; <b>Placa:</b> {ruta.placa || '—'}</div>
      </div>

      <table className="wp-rem-tabla">
        <thead>
          <tr>
            <th style={{ width: 34 }}>ITEM</th>
            <th>PRODUCTO</th>
            <th style={{ width: 80 }}>CANTIDAD<br />SOLICITADA</th>
            <th style={{ width: 80 }}>VALOR UNIT.</th>
            <th style={{ width: 95 }}>VALOR TOTAL</th>
            <th style={{ width: 70 }}>OBSERV.</th>
          </tr>
        </thead>
        <tbody>
          {itemsArr.map((it, i) => (
            <tr key={it.sap}>
              <td className="wp-c-item">{i + 1}</td>
              <td>{it.nombre}</td>
              <td className="wp-c-cant">{fmtN(it.cant)}</td>
              <td className="wp-c-vu">{it.precio ? fmtP(it.precio) : ''}</td>
              <td className="wp-c-vt">{it.total ? fmtP(it.total) : ''}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="wp-tot-lbl" colSpan={2}><b>TOTAL</b></td>
            <td className="wp-tot-cant"><b>{fmtN(totCant)}</b></td>
            <td></td>
            <td className="wp-tot-vt"><b>{fmtP(totVal)}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className="wp-rem-recibi">
        <div className="wp-rr-titulo"><u>RECIBI CONFORME</u></div>
        <div className="wp-rr-metodo">
          Indique método de validación: <span className="wp-chk"></span> conteo por unidad
          &nbsp;&nbsp; <span className="wp-chk"></span> conteo aleatorio
        </div>
        <div className="wp-rr-firmas">
          <div className="wp-rr-fcell"><div className="wp-rr-line"></div><div className="wp-rr-lbl">NOMBRE Y APELLIDO</div></div>
          <div className="wp-rr-fcell"><div className="wp-rr-line"></div><div className="wp-rr-lbl">CARGO</div></div>
          <div className="wp-rr-fcell"><div className="wp-rr-line"></div><div className="wp-rr-lbl">TIPO Y No DOCUMENTO</div></div>
          <div className="wp-rr-fcell"><div className="wp-rr-line"></div><div className="wp-rr-lbl">FIRMA</div></div>
        </div>
        <div className="wp-rr-legal">Con la firma de la presente remisión certifico haber recibido las cantidades aquí estipuladas y los productos en óptimas condiciones.</div>
      </div>

      <div className="wp-rem-trans">
        <div className="wp-rt-title">DATOS DEL TRANSPORTADOR</div>
        <div className="wp-rt-grid">
          <div className="wp-rt-field"><label>Nombre:</label><div className="wp-rt-line">{ruta.conductor || ''}</div></div>
          <div className="wp-rt-field"><label>Hora llegada:</label><div className="wp-rt-line"></div></div>
          <div className="wp-rt-field"><label>Identificación:</label><div className="wp-rt-line"></div></div>
          <div className="wp-rt-field"><label>Hora de salida:</label><div className="wp-rt-line"></div></div>
          <div className="wp-rt-field"><label>Placa:</label><div className="wp-rt-line">{ruta.placa || ''}</div></div>
          <div className="wp-rt-field"><label>Fecha de entrega:</label><div className="wp-rt-line">{fmtDateCorta(fechaEntrega)}</div></div>
        </div>
      </div>

      <div className="wp-rem-obs">
        <div className="wp-obs-left">
          <b>Observaciones:</b>
          <div className="wp-obs-note">CANASTILLAS QUE INGRESAN: ___________ &nbsp;&nbsp;&nbsp; CANASTILLAS QUE SE RETIRAN: ___________</div>
        </div>
        <div className="wp-obs-sign">
          <div className="wp-sl"></div>
          FIRMA
        </div>
      </div>
    </div>
  )
}

// datos: [{ ruta, filas }] — filas ya incluyen .producto resuelto
// rutasIndex: Map ruta.id -> índice en la lista completa de rutas (numeración de remisión)
export default function LogisticaWizardPrint({ titulo, datos, colegios, config, rutasIndex, onBeforePrint, onClose }) {
  const [mounted, setMounted] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const nroInicio = parseInt(config.nroInicio, 10) || 1

  async function handleImprimir() {
    if (onBeforePrint) {
      setImprimiendo(true)
      try { await onBeforePrint() } catch (err) { console.error('onBeforePrint falló:', err) }
      setImprimiendo(false)
    }
    window.print()
  }

  return createPortal(
    <div className="wizard-print-root">
      <div className="wp-toolbar no-print">
        <div className="wp-toolbar-title">{titulo}</div>
        <div className="wp-toolbar-actions">
          <button className="btn-secondary" onClick={onClose}>← Volver</button>
          <button className="btn-primary" disabled={imprimiendo} onClick={handleImprimir}>🖨 {imprimiendo ? 'Guardando...' : 'Imprimir'}</button>
        </div>
      </div>
      <div className="wp-preview-mount">
        {datos.map(({ ruta, filas }) => {
          const rutaIdx = rutasIndex.get(ruta.id) || 0
          const puntosOrden = []
          const vistos = new Set()
          filas.forEach(f => { if (!vistos.has(f.punto)) { vistos.add(f.punto); puntosOrden.push(f.punto) } })
          const fechaRuta = ruta.fechaDespacho || config.fechaEntrega
          const filasSinAmPm = filasNoAmPm(filas)
          const { conHorno, sinHorno } = separarAmPmPorHorno(filas, colegios)
          const mostrarNoAmPm = filasSinAmPm.length > 0 || (!sinHorno.length && !conHorno.length)
          const mostrarSinHorno = sinHorno.some(f => f.cantidad > 0)
          const mostrarConHorno = conHorno.some(f => f.cantidad > 0)
          return (
            <div key={ruta.id}>
              {mostrarNoAmPm && <RuteroPage ruta={ruta} filas={filasSinAmPm} colegios={colegios} fechaEntrega={fechaRuta} />}
              {mostrarSinHorno && <RuteroPageAmPmSinHorno ruta={ruta} filas={filas} colegios={colegios} fechaEntrega={fechaRuta} />}
              {mostrarConHorno && <RuteroPageAmPmConHorno ruta={ruta} filas={filas} colegios={colegios} fechaEntrega={fechaRuta} />}
              {puntosOrden.map((punto, idx) => {
                const filasCol = filas.filter(f => f.punto === punto)
                const nro = nroInicio + idx + rutaIdx * 100
                return (
                  <RemisionPage
                    key={punto}
                    ruta={ruta}
                    punto={punto}
                    filasCol={filasCol}
                    nro={nro}
                    fechaEmision={config.fechaEmision}
                    fechaEntrega={config.fechaEntrega}
                    colegios={colegios}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
