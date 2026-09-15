'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { canastillasDe, fmtN, fmtP } from '../lib/logisticaWizardCalc'
import { fmtDateCorta } from '../lib/logisticaWizardExcel'

const COL_FALLBACK = { nombre: '?', direccion: '—', localidad: '—', sedeEducativa: '—', sitioEntrega: '?' }

const LINEA_LABEL = { panaderia: 'Panadería', am_pm: 'AM-PM', gastronomia: 'Gastronomía' }

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
    let totCant = 0, totCanast = 0, totSueltas = 0
    filasRender.forEach(f => {
      totCant += f.rowData[pi].cant
      totCanast += f.rowData[pi].canast
      totSueltas += f.rowData[pi].sueltas
    })
    return { cant: totCant, canast: totCanast + (totSueltas > 0 ? 1 : 0), sueltas: totSueltas }
  })

  const totalUnidades = totales.reduce((s, t) => s + t.cant, 0)
  const totalCanastillas = totales.reduce((s, t) => s + t.canast, 0)

  return { productos, filasRender, totales, totalUnidades, totalCanastillas }
}

function shortName(producto) {
  return producto.nombre || producto.nombreCompleto || producto.sap
}

function RuteroPage({ ruta, filas, colegios, fechaEntrega }) {
  const { productos, filasRender, totales, totalUnidades, totalCanastillas } = construirRutero(ruta, filas, colegios)
  const numProd = productos.length
  const lineaLabel = lineaLabelDeFilas(filas)

  if (!filas.length) {
    return (
      <div className="wizard-print-page landscape">
        <h2>Ruta {ruta.nombre}</h2>
        <p>Sin colegios asignados.</p>
      </div>
    )
  }

  return (
    <div className="wizard-print-page landscape">
      <div className="wp-rut-head">
        <div className="wp-rut-head-logo"><div className="wp-logo-box">ALINNOVA</div></div>
        <div className="wp-rut-head-title">RUTERO SUMINISTRO {lineaLabel.toUpperCase()}</div>
        <div className="wp-rut-head-code">
          <div className="wp-code-row"><div className="wp-code-lbl">CÓDIGO</div><div className="wp-code-val">RF-FO-002-PD</div></div>
          <div className="wp-code-row"><div className="wp-code-lbl">VERSIÓN</div><div className="wp-code-val">1</div></div>
          <div className="wp-code-row"><div className="wp-code-lbl">F. ELABORACIÓN</div><div className="wp-code-val">18/04/2024</div></div>
        </div>
      </div>

      <div className="wp-rut-info">
        <div className="wp-ri"><b>RUTA:</b> <span className="wp-val">{ruta.nombre}</span></div>
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
export default function LogisticaWizardPrint({ titulo, datos, colegios, config, rutasIndex, onClose }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const nroInicio = parseInt(config.nroInicio, 10) || 1

  return createPortal(
    <div className="wizard-print-root">
      <div className="wp-toolbar no-print">
        <div className="wp-toolbar-title">{titulo}</div>
        <div className="wp-toolbar-actions">
          <button className="btn-secondary" onClick={onClose}>← Volver</button>
          <button className="btn-primary" onClick={() => window.print()}>🖨 Imprimir</button>
        </div>
      </div>
      <div className="wp-preview-mount">
        {datos.map(({ ruta, filas }) => {
          const rutaIdx = rutasIndex.get(ruta.id) || 0
          const puntosOrden = []
          const vistos = new Set()
          filas.forEach(f => { if (!vistos.has(f.punto)) { vistos.add(f.punto); puntosOrden.push(f.punto) } })
          return (
            <div key={ruta.id}>
              <RuteroPage ruta={ruta} filas={filas} colegios={colegios} fechaEntrega={ruta.fechaDespacho || config.fechaEntrega} />
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
