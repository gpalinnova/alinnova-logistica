import { jsPDF } from 'jspdf'
import { fmtFechaCorta } from './logisticaRemisionPdf'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const MAX_VISUAL_ROWS = 20

const SITE_COL_W = { id_sitio: 13, institucion: 37, direccion: 33 }
const SITE_FIXED_W = SITE_COL_W.id_sitio + SITE_COL_W.institucion + SITE_COL_W.direccion

function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

// canastillas_base = cuantas canastillas llenas caben; unidades_sueltas = resto
export function calcularCanastillas(unidades, capacidad) {
  const u = unidades || 0
  const cap = capacidad || 0
  if (cap <= 0) return { canastillas_base: 0, unidades_sueltas: u }
  return { canastillas_base: Math.floor(u / cap), unidades_sueltas: u % cap }
}

// NOTA CRITICA: se suma por sitio individual (producto x sitio), no sobre un
// agregado pre-redondeado. Cada sitio es una entrega física separada, así que
// las unidades sueltas de un sitio no se pueden combinar con las de otro sitio
// en una misma canastilla — por eso se suma 1 canastilla extra POR SITIO con
// sueltas>0, igual que en Reforzados (lib/ruteroPdf.js).
//
// sitios: [{ ..., cantidades: { [producto_id]: unidades } }]
// productos: [{ id, nombre_corto, nombre, capacidad_canastilla }]
export function calcularTotalCanastillasFamilia(sitios, productos) {
  const porProducto = {}
  let total_unidades = 0
  let total_canastillas = 0

  for (const producto of productos || []) {
    const capacidad = producto.capacidad_canastilla
    let p_unidades = 0
    let p_canastillas_base = 0
    let p_unidades_sueltas = 0
    let p_canastillas = 0

    for (const sitio of sitios || []) {
      const unidades = sitio.cantidades?.[producto.id] || 0
      const { canastillas_base, unidades_sueltas } = calcularCanastillas(unidades, capacidad)
      p_unidades += unidades
      p_canastillas_base += canastillas_base
      p_unidades_sueltas += unidades_sueltas
      p_canastillas += canastillas_base + (unidades_sueltas > 0 ? 1 : 0)
    }

    porProducto[producto.id] = {
      total_unidades: p_unidades,
      total_canastillas_base: p_canastillas_base,
      total_unidades_sueltas: p_unidades_sueltas,
      total_canastillas: p_canastillas,
    }
    total_unidades += p_unidades
    total_canastillas += p_canastillas
  }

  return { porProducto, total_unidades, total_canastillas }
}

// Ancho por variante bajo REFERENCIA (1 col) y EMBALAJE (2 col: CANASTILLA/UND).
// Se reparte el espacio restante entre las N variantes; a más variantes, más
// angosto y con fuente más pequeña, igual que hace ruteroPdf.js con componentes.
function calcularLayoutVariantes(numVariantes) {
  const disponible = CONTENT_W - SITE_FIXED_W
  const n = Math.max(1, numVariantes)
  const variantW = disponible / n
  const referenciaW = variantW * (1.3 / 3.3)
  const canastillaW = variantW * (1 / 3.3)
  const undW = variantW - referenciaW - canastillaW
  const fontSize = n <= 3 ? 6.4 : n <= 5 ? 5.6 : 5
  return { referenciaW, canastillaW, undW, embalajeW: canastillaW + undW, fontSize }
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

function drawHeaderBlock(doc, y, { familia, fecha }) {
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
  const titulo = `RUTERO SUMINISTRO ${(familia || '').toUpperCase()}`
  const lines = doc.splitTextToSize(titulo, midW)
  const startY = y + 9 - (lines.length - 1) * 2.5
  lines.forEach((line, i) => doc.text(line, midX + midW / 2, startY + i * 5, { align: 'center' }))

  const rx = MARGIN + CONTENT_W - rightW
  doc.setFontSize(7.6)
  doc.setFont('helvetica', 'bold')
  doc.text('CODIGO:', rx, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text('RF-FO-002-PD', rx + 18, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.text('VERSION:', rx, y + 8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('1', rx + 18, y + 8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('F. ELABORACION:', rx, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text('18/04/2024', rx + 28, y + 13)
  doc.setFont('helvetica', 'bold')
  doc.text('FECHA:', rx, y + 17.5)
  doc.setFont('helvetica', 'normal')
  doc.text(fecha || '-', rx + 18, y + 17.5)

  const bottomY = y + 21
  doc.setLineWidth(0.6)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 3
}

function drawRutaLine(doc, y, { ruta }) {
  const h = 7
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)
  const colW = CONTENT_W / 4
  const items = [
    ['RUTA:', ruta?.nombre],
    ['CONDUCTOR:', ruta?.conductor],
    ['PLACA:', ruta?.placa_vehiculo],
    ['AUXILIAR:', ruta?.auxiliar],
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

function drawTablaHeader(doc, y, productos, layout) {
  const { referenciaW, canastillaW, undW, embalajeW, fontSize } = layout
  const h1 = 5
  const h2 = 5
  const h3 = 8
  const h4 = 5
  const totalH = h1 + h2 + h3 + h4

  let x = MARGIN
  const siteLabels = [
    ['id_sitio', 'ID SITIO ENTREGA'],
    ['institucion', 'NOMBRE INSTITUCION EDUCATIVA'],
    ['direccion', 'DIRRECION DE ENTREGA'],
  ]
  for (const [key, label] of siteLabels) {
    drawCell(doc, x, y, SITE_COL_W[key], totalH, label, { bold: true, fontSize: 5.4 })
    x += SITE_COL_W[key]
  }

  const referenciaX0 = x
  const referenciaTotalW = referenciaW * productos.length
  drawCell(doc, referenciaX0, y, referenciaTotalW, h1, 'REFERENCIA', { bold: true, fontSize: 6 })
  drawCell(doc, referenciaX0, y + h1, referenciaTotalW, h2, 'PRODUCTO', { bold: true, fontSize: 5.6 })
  let rx = referenciaX0
  for (const p of productos) {
    drawCell(doc, rx, y + h1 + h2, referenciaW, h3 + h4, p.nombre_corto || p.nombre, { fontSize: 4.6 })
    rx += referenciaW
  }

  const embalajeX0 = referenciaX0 + referenciaTotalW
  const embalajeTotalW = embalajeW * productos.length
  drawCell(doc, embalajeX0, y, embalajeTotalW, h1, 'EMBALAJE POR REFERENCIA', { bold: true, fontSize: 5.6 })
  drawCell(doc, embalajeX0, y + h1, embalajeTotalW, h2, 'PRODUCTO', { bold: true, fontSize: 5.6 })
  // h3+h4 se subdividen en 3 filas: nombre corto de variante, capacidad, CANASTILLA/UND
  const hNombre = 5
  const hCap = 3.5
  const hLabels = h3 + h4 - hNombre - hCap
  let ex = embalajeX0
  for (const p of productos) {
    drawCell(doc, ex, y + h1 + h2, embalajeW, hNombre, p.nombre_corto || p.nombre, { fontSize: 4.6 })
    drawCell(doc, ex, y + h1 + h2 + hNombre, embalajeW, hCap, String(p.capacidad_canastilla ?? '-'), { bold: true, fontSize })
    drawCell(doc, ex, y + h1 + h2 + hNombre + hCap, canastillaW, hLabels, 'CANASTILLA', { bold: true, fontSize: 4.4 })
    drawCell(doc, ex + canastillaW, y + h1 + h2 + hNombre + hCap, undW, hLabels, 'UND', { bold: true, fontSize: 4.4 })
    ex += embalajeW
  }

  return y + totalH
}

function drawSitioRow(doc, y, rowH, sitio, productos, layout) {
  const { referenciaW, canastillaW, undW, fontSize } = layout
  let x = MARGIN
  const siteValues = { id_sitio: sitio.punto_wms, institucion: sitio.nombre_institucion, direccion: sitio.direccion }
  for (const key of ['id_sitio', 'institucion', 'direccion']) {
    drawCell(doc, x, y, SITE_COL_W[key], rowH, siteValues[key], { fontSize: 6, align: key === 'id_sitio' ? 'center' : 'left' })
    x += SITE_COL_W[key]
  }

  for (const p of productos) {
    const unidades = sitio.cantidades?.[p.id] || 0
    drawCell(doc, x, y, referenciaW, rowH, unidades > 0 ? fmtN(unidades) : '', { fontSize })
    x += referenciaW
    const { canastillas_base, unidades_sueltas } = calcularCanastillas(unidades, p.capacidad_canastilla)
    drawCell(doc, x, y, canastillaW, rowH, canastillas_base > 0 ? fmtN(canastillas_base) : '', { fontSize })
    x += canastillaW
    drawCell(doc, x, y, undW, rowH, unidades_sueltas > 0 ? fmtN(unidades_sueltas) : '', { fontSize })
    x += undW
  }

  return y + rowH
}

function drawEmptyRow(doc, y, rowH, productos, layout) {
  const { referenciaW, canastillaW, undW } = layout
  let x = MARGIN
  for (const key of ['id_sitio', 'institucion', 'direccion']) {
    drawCell(doc, x, y, SITE_COL_W[key], rowH, '')
    x += SITE_COL_W[key]
  }
  for (const p of productos) {
    void p
    drawCell(doc, x, y, referenciaW, rowH, '')
    x += referenciaW
    drawCell(doc, x, y, canastillaW, rowH, '')
    x += canastillaW
    drawCell(doc, x, y, undW, rowH, '')
    x += undW
  }
  return y + rowH
}

function drawTotalRow(doc, y, productos, layout, totales) {
  const { referenciaW, canastillaW, undW } = layout
  const rowH = 7
  const fill = [235, 235, 235]
  let x = MARGIN
  drawCell(doc, x, y, SITE_FIXED_W, rowH, 'TOTAL', { bold: true, fontSize: 8, fill })
  x += SITE_FIXED_W

  for (const p of productos) {
    const t = totales.porProducto[p.id] || { total_unidades: 0, total_canastillas_base: 0, total_unidades_sueltas: 0 }
    drawCell(doc, x, y, referenciaW, rowH, fmtN(t.total_unidades), { bold: true, fontSize: 6.4, fill })
    x += referenciaW
    drawCell(doc, x, y, canastillaW, rowH, fmtN(t.total_canastillas_base), { bold: true, fontSize: 6.4, fill })
    x += canastillaW
    drawCell(doc, x, y, undW, rowH, fmtN(t.total_unidades_sueltas), { bold: true, fontSize: 6.4, fill })
    x += undW
  }

  return y + rowH + 3
}

function drawRecuadroTotales(doc, y, totales) {
  const h = 12
  const w = (CONTENT_W - 4) / 2
  doc.setDrawColor(0)
  doc.setLineWidth(0.4)

  doc.setFillColor(20, 83, 45)
  doc.rect(MARGIN, y, w, h, 'FD')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('TOTAL UNIDADES', MARGIN + w / 2, y + 4.5, { align: 'center' })
  doc.setFontSize(11)
  doc.text(fmtN(totales.total_unidades), MARGIN + w / 2, y + 10, { align: 'center' })

  const x2 = MARGIN + w + 4
  doc.setFillColor(20, 83, 45)
  doc.rect(x2, y, w, h, 'FD')
  doc.setFontSize(7)
  doc.text('TOTAL CANASTILLAS', x2 + w / 2, y + 4.5, { align: 'center' })
  doc.setFontSize(11)
  doc.text(fmtN(totales.total_canastillas), x2 + w / 2, y + 10, { align: 'center' })

  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  return y + h + 4
}

function drawFirmasBlock(doc, y, { ruta, fechaEntrega }) {
  const h = 20
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

function drawLoteBlock(doc, y, productos, lotesVenc) {
  const headerH = 6
  const rowH = 6.5
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
  let ry = y + headerH
  for (const p of productos) {
    x = MARGIN
    const info = lotesVenc?.[p.id] || {}
    const nombreProducto = p.nombre_corto || p.nombre || ''
    const valores = [nombreProducto, info.fecha_vencimiento ? fmtFechaCorta(info.fecha_vencimiento) : '-', info.lote || '-']
    cols.forEach((c, i) => {
      drawCell(doc, x, ry, c.w, rowH, valores[i], { fontSize: 6.6 })
      x += c.w
    })
    ry += rowH
  }
  return ry
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

function drawPagina(doc, { familia, ruta, fechaEntrega, sitios, productos_variantes, lotes_venc }) {
  const productos = productos_variantes || []
  const layout = calcularLayoutVariantes(productos.length)
  const totales = calcularTotalCanastillasFamilia(sitios, productos)

  let y = MARGIN
  y = drawHeaderBlock(doc, y, { familia, fecha: fechaEntrega })
  y = drawRutaLine(doc, y, { ruta })
  y = drawTablaHeader(doc, y, productos, layout)

  const rowH = 6.4
  const maxBottom = PAGE_H - 78
  const filas = sitios || []
  let i = 0
  while (i < filas.length) {
    if (y + rowH > maxBottom) {
      doc.addPage('a4', 'p')
      y = MARGIN
      y = drawHeaderBlock(doc, y, { familia, fecha: fechaEntrega })
      y = drawRutaLine(doc, y, { ruta })
      y = drawTablaHeader(doc, y, productos, layout)
    }
    y = drawSitioRow(doc, y, rowH, filas[i], productos, layout)
    i += 1
  }

  const filasFaltantes = Math.max(0, MAX_VISUAL_ROWS - filas.length)
  for (let j = 0; j < filasFaltantes; j++) {
    if (y + rowH > maxBottom) break
    y = drawEmptyRow(doc, y, rowH, productos, layout)
  }

  y = drawTotalRow(doc, y, productos, layout, totales)
  y = drawRecuadroTotales(doc, y, totales)
  y = drawFirmasBlock(doc, y, { ruta, fechaEntrega })
  y = drawLoteBlock(doc, y, productos, lotes_venc)
  drawAdicionalesBlock(doc, y)
}

export function construirHtmlRutero(doc, rutero) {
  drawPagina(doc, rutero)
}

// Concatena todos los ruteros seleccionados en UN SOLO PDF multipágina
// (una página por rutero; si un rutero necesita más de una hoja por
// cantidad de sitios, drawPagina sigue paginando internamente como antes).
export function generarPdfRuteros(ruteros) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  ruteros.forEach((r, i) => {
    if (i > 0) doc.addPage('a4', 'p')
    construirHtmlRutero(doc, r)
  })
  return doc.output('blob')
}

export { fmtFechaCorta }
