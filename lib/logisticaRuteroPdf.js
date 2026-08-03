import { jsPDF } from 'jspdf'
import { fmtFechaCorta } from './logisticaRemisionPdf'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const MAX_VISUAL_ROWS = 24

const COLS = [
  { key: 'id_sitio', label: 'ID SITIO ENTREGA', w: 16, align: 'center' },
  { key: 'institucion', label: 'NOMBRE INSTITUCION EDUCATIVA', w: 60, align: 'left' },
  { key: 'direccion', label: 'DIRECCION DE ENTREGA', w: 54, align: 'left' },
  { key: 'cantidad', label: 'CANTIDAD A ENTREGAR', w: 20, align: 'center' },
  { key: 'canastilla', label: 'CANASTILLA', w: 16, align: 'center' },
  { key: 'und', label: 'UND', w: 16, align: 'center' },
]

function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

export function calcularCanastillasProductoSitio(unidades, capacidad) {
  const u = unidades || 0
  const cap = capacidad || 0
  if (cap <= 0) return { canastillas_base: 0, unidades_sueltas: u }
  return { canastillas_base: Math.floor(u / cap), unidades_sueltas: u % cap }
}

// NOTA CRITICA: se suma por sitio individual (producto x sitio), no sobre un
// agregado pre-redondeado. Cada sitio es una entrega física separada, así que
// las unidades sueltas de un sitio no se pueden combinar con las de otro sitio
// en una misma canastilla — por eso se suma 1 canastilla extra POR SITIO con
// sueltas>0, igual que en Reforzados (lib/ruteroCalc.js).
export function calcularTotalCanastillas(productos) {
  let total_unidades = 0
  let total_canastillas_base = 0
  let total_unidades_sueltas = 0
  let total_canastillas = 0
  for (const p of productos || []) {
    const { canastillas_base, unidades_sueltas } = calcularCanastillasProductoSitio(p.unidades, p.capacidad)
    total_unidades += p.unidades || 0
    total_canastillas_base += canastillas_base
    total_unidades_sueltas += unidades_sueltas
    total_canastillas += canastillas_base + (unidades_sueltas > 0 ? 1 : 0)
  }
  return { total_unidades, total_canastillas_base, total_unidades_sueltas, total_canastillas }
}

function drawCell(doc, x, y, w, h, text, opts = {}) {
  doc.setDrawColor(0)
  doc.setLineWidth(opts.lineWidth || 0.25)
  if (opts.fill) {
    doc.setFillColor(...opts.fill)
    doc.rect(x, y, w, h, 'FD')
  } else {
    doc.rect(x, y, w, h)
  }
  if (!text) return
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
  doc.setFontSize(opts.fontSize || 7)
  const align = opts.align || 'center'
  const lineH = opts.lineHeight || (opts.fontSize ? opts.fontSize * 0.42 : 3)
  const lines = doc.splitTextToSize(String(text), w - 2)
  const totalH = lines.length * lineH
  let ty = y + h / 2 - totalH / 2 + lineH * 0.78
  const tx = align === 'left' ? x + 1.5 : align === 'right' ? x + w - 1.5 : x + w / 2
  lines.forEach(line => {
    doc.text(line, tx, ty, { align })
    ty += lineH
  })
}

function drawHeaderBlock(doc, y, { producto, fechaGeneracion }) {
  const logoW = 40
  const rightW = 60
  const midX = MARGIN + logoW + 4
  const midW = CONTENT_W - logoW - 4 - rightW - 4

  doc.setDrawColor(0)
  doc.setLineWidth(0.7)
  doc.rect(MARGIN, y, logoW, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('A L I N N O V A', MARGIN + logoW / 2, y + 10.5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const nombreProducto = producto?.nombre_corto || producto?.nombre || ''
  const lines = doc.splitTextToSize(nombreProducto.toUpperCase(), midW)
  const startY = y + 9 - (lines.length - 1) * 2.5
  lines.forEach((line, i) => doc.text(line, midX + midW / 2, startY + i * 5, { align: 'center' }))
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('RUTERO DE ENTREGA', midX + midW / 2, y + 16.5, { align: 'center' })

  const rx = MARGIN + CONTENT_W - rightW
  doc.setFontSize(7.6)
  doc.setFont('helvetica', 'bold')
  doc.text('CODIGO:', rx, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text('RF-FO-001-GP', rx + 18, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.text('VERSION:', rx, y + 8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('1', rx + 18, y + 8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('F. ELABORACION:', rx, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text('28/02/2023', rx + 28, y + 13)
  doc.setFont('helvetica', 'bold')
  doc.text('FECHA:', rx, y + 17.5)
  doc.setFont('helvetica', 'normal')
  doc.text(fechaGeneracion || '-', rx + 18, y + 17.5)

  const bottomY = y + 21
  doc.setLineWidth(0.6)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 3
}

function drawRutaLine(doc, y, { ruta }) {
  const h = 7
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)
  const colW = CONTENT_W / 3
  const items = [
    ['RUTA:', ruta?.nombre],
    ['CONDUCTOR:', ruta?.conductor],
    ['PLACA:', ruta?.placa_vehiculo],
  ]
  items.forEach(([label, value], i) => {
    const x = MARGIN + i * colW
    if (i > 0) doc.line(x, y, x, y + h)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(label, x + 2, y + h / 2 + 1.2)
    const labelW = doc.getTextWidth(`${label} `)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value || '-'), x + 2 + labelW, y + h / 2 + 1.2)
  })
  return y + h + 2
}

function drawTablaHeader(doc, y, { producto, capacidad }) {
  const h1 = 7
  const h2 = 6
  let x = MARGIN
  for (let i = 0; i < 4; i++) {
    const c = COLS[i]
    drawCell(doc, x, y, c.w, h1 + h2, c.label, { bold: true, fontSize: 6.2 })
    x += c.w
  }
  const prodW = COLS[4].w + COLS[5].w
  const nombreProducto = producto?.nombre_corto || producto?.nombre || ''
  drawCell(doc, x, y, prodW, h1, `PRODUCTO: ${nombreProducto} (CANASTILLA X ${capacidad || '-'})`, { bold: true, fontSize: 5.6 })
  drawCell(doc, x, y + h1, COLS[4].w, h2, 'CANASTILLA', { bold: true, fontSize: 6 })
  drawCell(doc, x + COLS[4].w, y + h1, COLS[5].w, h2, 'UND', { bold: true, fontSize: 6 })
  return y + h1 + h2
}

function drawSitioRow(doc, y, rowH, sitio, capacidad) {
  const { canastillas_base, unidades_sueltas } = calcularCanastillasProductoSitio(sitio.unidades, capacidad)
  let x = MARGIN
  const values = {
    id_sitio: sitio.punto_wms,
    institucion: sitio.nombre_institucion,
    direccion: sitio.direccion,
    cantidad: fmtN(sitio.unidades),
    canastilla: canastillas_base > 0 ? fmtN(canastillas_base) : '-',
    und: unidades_sueltas > 0 ? fmtN(unidades_sueltas) : '-',
  }
  for (const c of COLS) {
    drawCell(doc, x, y, c.w, rowH, values[c.key], { fontSize: 6.6, align: c.align })
    x += c.w
  }
  return y + rowH
}

function drawEmptyRow(doc, y, rowH) {
  let x = MARGIN
  for (const c of COLS) {
    drawCell(doc, x, y, c.w, rowH, '')
    x += c.w
  }
  return y + rowH
}

function drawTotalRow(doc, y, sitios, capacidad) {
  const rowH = 7.5
  const fill = [235, 235, 235]
  const totales = calcularTotalCanastillas((sitios || []).map(s => ({ unidades: s.unidades, capacidad })))
  let x = MARGIN
  const labelW = COLS[0].w + COLS[1].w + COLS[2].w
  drawCell(doc, x, y, labelW, rowH, 'TOTAL', { bold: true, fontSize: 8, fill })
  x += labelW
  drawCell(doc, x, y, COLS[3].w, rowH, fmtN(totales.total_unidades), { bold: true, fontSize: 7.4, fill })
  x += COLS[3].w
  drawCell(doc, x, y, COLS[4].w, rowH, fmtN(totales.total_canastillas_base), { bold: true, fontSize: 7.4, fill })
  x += COLS[4].w
  drawCell(doc, x, y, COLS[5].w, rowH, fmtN(totales.total_unidades_sueltas), { bold: true, fontSize: 7.4, fill })

  const y2 = y + rowH + 3
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.setFillColor(20, 83, 45)
  doc.rect(MARGIN, y2, CONTENT_W, 8, 'FD')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`TOTAL CANASTILLAS: ${fmtN(totales.total_canastillas)}`, MARGIN + CONTENT_W / 2, y2 + 5.5, { align: 'center' })
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  return y2 + 8 + 4
}

function drawFirmasBlock(doc, y, { ruta, fechaEntrega }) {
  const h = 22
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)
  const colW = CONTENT_W / 3
  const items = [
    ['CONDUCTOR:', ruta?.conductor],
    ['FECHA:', fechaEntrega],
    ['FIRMA:', ''],
  ]
  const cy = y + h / 2 + 1
  items.forEach(([label, value], i) => {
    const x = MARGIN + i * colW
    if (i > 0) doc.line(x, y, x, y + h)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, x + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    if (value) {
      doc.text(String(value), x + 3, cy + 2)
    } else {
      doc.setLineWidth(0.25)
      doc.line(x + 3, y + h - 5, x + colW - 3, y + h - 5)
    }
  })
  return y + h + 4
}

function drawLoteBlock(doc, y, { producto, lote, fecha_vencimiento }) {
  const headerH = 6
  const rowH = 7
  const cols = [
    { label: 'PRODUCTOS', w: CONTENT_W * 0.4 },
    { label: 'FECHA DE VENCIMIENTO', w: CONTENT_W * 0.3 },
    { label: 'LOTE', w: CONTENT_W * 0.3 },
  ]
  let x = MARGIN
  cols.forEach(c => {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 6.6, fill: [235, 235, 235] })
    x += c.w
  })
  x = MARGIN
  const nombreProducto = producto?.nombre_corto || producto?.nombre || ''
  const valores = [nombreProducto, fecha_vencimiento ? fmtFechaCorta(fecha_vencimiento) : '-', lote || '-']
  cols.forEach((c, i) => {
    drawCell(doc, x, y + headerH, c.w, rowH, valores[i], { fontSize: 6.8 })
    x += c.w
  })
  return y + headerH + rowH
}

function drawAdicionalesBlock(doc, y) {
  const headerH = 6
  const rowH = 7
  const cols = [
    { label: 'UNIDADES ADICIONALES', w: CONTENT_W * 0.7 },
    { label: 'CANTIDAD', w: CONTENT_W * 0.3 },
  ]
  let x = MARGIN
  cols.forEach(c => {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 6.6, fill: [235, 235, 235] })
    x += c.w
  })
  x = MARGIN
  cols.forEach(c => {
    drawCell(doc, x, y + headerH, c.w, rowH, '')
    x += c.w
  })
  return y + headerH + rowH
}

function drawPagina(doc, { producto, ruta, fechaEntrega, fechaGeneracion, sitios, lote, fecha_vencimiento, capacidad }) {
  let y = MARGIN
  y = drawHeaderBlock(doc, y, { producto, fechaGeneracion })
  y = drawRutaLine(doc, y, { ruta })
  y = drawTablaHeader(doc, y, { producto, capacidad })

  const rowH = 6.4
  const maxBottom = PAGE_H - 70
  let filas = sitios || []
  let i = 0
  while (i < filas.length) {
    if (y + rowH > maxBottom) {
      doc.addPage('a4', 'p')
      y = MARGIN
      y = drawHeaderBlock(doc, y, { producto, fechaGeneracion })
      y = drawRutaLine(doc, y, { ruta })
      y = drawTablaHeader(doc, y, { producto, capacidad })
    }
    y = drawSitioRow(doc, y, rowH, filas[i], capacidad)
    i += 1
  }

  const filasFaltantes = Math.max(0, MAX_VISUAL_ROWS - filas.length)
  for (let j = 0; j < filasFaltantes; j++) {
    if (y + rowH > maxBottom) break
    y = drawEmptyRow(doc, y, rowH)
  }

  y = drawTotalRow(doc, y, filas, capacidad)
  y = drawFirmasBlock(doc, y, { ruta, fechaEntrega })
  y = drawLoteBlock(doc, y, { producto, lote, fecha_vencimiento })
  drawAdicionalesBlock(doc, y)
}

export function construirHtmlRutero(doc, rutero) {
  drawPagina(doc, rutero)
}

export function generarPdfRuteros(ruteros, modo) {
  if (modo === 'agrupado_por_ruta') {
    const porRuta = new Map()
    for (const r of ruteros) {
      const key = r.ruta?.id || r.ruta_id
      if (!porRuta.has(key)) porRuta.set(key, [])
      porRuta.get(key).push(r)
    }
    return Array.from(porRuta.values()).map(grupo => {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
      grupo.forEach((r, i) => {
        if (i > 0) doc.addPage('a4', 'p')
        construirHtmlRutero(doc, r)
      })
      return { ruta: grupo[0].ruta, blob: doc.output('blob') }
    })
  }

  return ruteros.map(r => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    construirHtmlRutero(doc, r)
    return { ruta: r.ruta, producto: r.producto, blob: doc.output('blob') }
  })
}

export { fmtFechaCorta }
