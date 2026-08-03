import { jsPDF } from 'jspdf'

const PAGE_W = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

const MAX_ITEM_ROWS = 5

export function MODALIDAD_A_LINEA_PRODUCCION(modalidad) {
  if (modalidad === 'panaderia') return 'Panadería'
  if (modalidad === 'am_pm') return 'AM-PM'
  if (modalidad === 'gastronomia') return 'Granos'
  return modalidad || ''
}

export function fmtFechaCorta(fechaISO) {
  if (!fechaISO) return ''
  const [y, m, d] = fechaISO.split('-')
  return `${d}/${m}/${y}`
}

function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

function fmtP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
}

function textRowInline(doc, x, y, maxWidth, label, value, opts = {}) {
  const fontSize = opts.fontSize || 8.5
  const lineHeight = opts.lineHeight || 4.6
  doc.setFontSize(fontSize)
  doc.setFont('helvetica', 'bold')
  const labelText = `${label} `
  doc.text(labelText, x, y)
  const labelW = doc.getTextWidth(labelText)
  doc.setFont('helvetica', 'normal')
  const valueText = value != null && String(value).trim() ? String(value) : '-'
  const lines = doc.splitTextToSize(valueText, Math.max(maxWidth - labelW, 20))
  lines.forEach((line, i) => doc.text(line, x + labelW, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function metaRowInline(doc, x, y, maxWidth, pairs, opts = {}) {
  const fontSize = opts.fontSize || 8
  const lineHeight = opts.lineHeight || 4.6
  const gap = 8
  doc.setFontSize(fontSize)
  let cx = x
  let cy = y
  pairs.forEach(([label, value]) => {
    const labelText = `${label} `
    const valueText = value != null && String(value).trim() ? String(value) : '-'
    doc.setFont('helvetica', 'bold')
    const labelW = doc.getTextWidth(labelText)
    doc.setFont('helvetica', 'normal')
    const valueW = doc.getTextWidth(`${valueText}  `)
    const totalW = labelW + valueW
    if (cx !== x && cx + totalW > x + maxWidth) {
      cy += lineHeight
      cx = x
    }
    doc.setFont('helvetica', 'bold')
    doc.text(labelText, cx, cy)
    doc.setFont('helvetica', 'normal')
    doc.text(valueText, cx + labelW, cy)
    cx += totalW + gap
  })
  return cy + lineHeight
}

function formatOc(oc) {
  const lista = Array.isArray(oc) ? oc : String(oc || '').split(' / ')
  const limpia = lista.map(o => String(o || '').trim()).filter(Boolean)
  return limpia.length ? limpia.join(' / ') : ''
}

function drawHeader(doc, y, { nro, fechaEmision, oc, modalidad }) {
  const logoW = 40
  const rightW = 52
  const midX = MARGIN + logoW + 4
  const midW = CONTENT_W - logoW - 4 - rightW - 4

  doc.setDrawColor(0)
  doc.setLineWidth(0.7)
  doc.rect(MARGIN, y, logoW, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('A L I N N O V A', MARGIN + logoW / 2, y + 10.5, { align: 'center' })

  let ly = y + 4
  textRowInline(doc, midX, ly, midW, 'Razón Social:', 'ALINNOVA S.A.S      NIT: 901.015.983-9', { fontSize: 8.2, lineHeight: 5 })
  ly += 5
  textRowInline(doc, midX, ly, midW, 'Dirección:', 'Cra. 69B 77 - 44      TEL: 310 309 50 96', { fontSize: 8.2, lineHeight: 5 })
  ly += 5
  textRowInline(doc, midX, ly, midW, 'Línea de Producción:', MODALIDAD_A_LINEA_PRODUCCION(modalidad), { fontSize: 8.2, lineHeight: 5 })

  const rx = MARGIN + CONTENT_W - rightW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('REMISION', rx + rightW, y + 5, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`Nro ${nro}`, rx + rightW, y + 10, { align: 'right' })
  doc.text(`FECHA ${fechaEmision}`, rx + rightW, y + 14.5, { align: 'right' })
  doc.text(`OC ${formatOc(oc) || '—'}`, rx + rightW, y + 19, { align: 'right' })
  doc.setFontSize(7.2)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(85)
  doc.text('COPIA VALORIZADA', rx + rightW, y + 22.8, { align: 'right' })
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  const bottomY = y + 25.5
  doc.setLineWidth(0.6)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 4
}

function drawInfoBlock(doc, y, { sitio, fechaEntrega }) {
  const padX = 4
  const padTop = 5
  const x = MARGIN + padX
  const w = CONTENT_W - padX * 2

  let cy = y + padTop
  cy = textRowInline(doc, x, cy, w, 'Institución:', sitio.nombre_institucion)
  cy = textRowInline(doc, x, cy, w, 'Sitio de Entrega:', sitio.nombre_sitio || sitio.nombre_institucion)
  cy = textRowInline(doc, x, cy, w, 'Dirección:', sitio.direccion)
  cy += 1.5
  cy = metaRowInline(doc, x, cy, w, [
    ['Id Punto Entrega:', sitio.punto_wms],
    ['Zona de Entrega:', sitio.localidad],
    ['Sede Educativa:', sitio.sede_educativa],
  ])
  cy += 1
  cy = metaRowInline(doc, x, cy, w, [
    ['Fecha de Entrega:', fechaEntrega],
  ])

  const bottom = cy + padTop - 2
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, y, CONTENT_W, bottom - y)
  return bottom + 4
}

function drawItemsTable(doc, y, { productos, totalUnd, totalVal }) {
  const cols = [
    { key: 'item', label: 'ITEM', w: 10, align: 'center' },
    { key: 'producto', label: 'PRODUCTO', w: 56, align: 'left' },
    { key: 'cantidad', label: 'CANTIDAD\nSOLICITADA', w: 24, align: 'center' },
    { key: 'unit', label: 'VALOR UNIT', w: 30, align: 'right' },
    { key: 'total', label: 'VALOR TOTAL', w: 32, align: 'right' },
    { key: 'obs', label: 'OBSERVACIONES', w: CONTENT_W - (10 + 56 + 24 + 30 + 32), align: 'center' },
  ]
  const headerH = 9
  const rowH = 6.4
  const totalH = 7.2

  doc.setFillColor(0, 0, 0)
  doc.rect(MARGIN, y, CONTENT_W, headerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2)
  let x = MARGIN
  cols.forEach(c => {
    const lines = c.label.split('\n')
    lines.forEach((line, i) => {
      doc.text(line, x + c.w / 2, y + headerH / 2 + 1.3 - (lines.length - 1) * 1.6 + i * 3.2, { align: 'center' })
    })
    x += c.w
  })
  doc.setTextColor(0)

  let ry = y + headerH
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  for (let i = 0; i < MAX_ITEM_ROWS; i++) {
    const item = productos[i]
    x = MARGIN
    cols.forEach(c => {
      doc.rect(x, ry, c.w, rowH)
      let text = ''
      if (c.key === 'item') text = String(i + 1)
      else if (item) {
        if (c.key === 'producto') text = item.nombre_corto || item.nombre
        else if (c.key === 'cantidad') text = fmtN(item.cantidad)
        else if (c.key === 'unit') text = fmtP(item.valor_unitario)
        else if (c.key === 'total') text = fmtP(item.valor_total)
      }
      if (text) {
        const tx = c.align === 'left' ? x + 2 : c.align === 'right' ? x + c.w - 2 : x + c.w / 2
        doc.text(text, tx, ry + rowH / 2 + 1.2, { align: c.align })
      }
      x += c.w
    })
    ry += rowH
  }

  doc.setFillColor(240, 240, 240)
  doc.rect(MARGIN, ry, CONTENT_W, totalH, 'F')
  x = MARGIN
  cols.forEach(c => {
    doc.rect(x, ry, c.w, totalH)
    x += c.w
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.4)
  doc.text('TOTAL', MARGIN + cols[0].w + cols[1].w / 2, ry + totalH / 2 + 1.3, { align: 'center' })
  doc.text(fmtN(totalUnd), MARGIN + cols[0].w + cols[1].w + cols[2].w / 2, ry + totalH / 2 + 1.3, { align: 'center' })
  const totalX = MARGIN + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 2
  doc.text(fmtP(totalVal), totalX, ry + totalH / 2 + 1.3, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  return ry + totalH + 5
}

function drawRecibiBlock(doc, y) {
  const padX = 4
  const h = 46
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, y, CONTENT_W, h)

  let cy = y + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.6)
  doc.text('RECIBI CONFORME', MARGIN + CONTENT_W / 2, cy, { align: 'center' })
  const titleW = doc.getTextWidth('RECIBI CONFORME')
  doc.setLineWidth(0.25)
  doc.line(MARGIN + CONTENT_W / 2 - titleW / 2, cy + 0.8, MARGIN + CONTENT_W / 2 + titleW / 2, cy + 0.8)

  cy += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.text('Indique método de validación:', MARGIN + padX, cy)
  let cx = MARGIN + padX + doc.getTextWidth('Indique método de validación:  ')
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(cx, cy - 3, 3, 3)
  doc.text('conteo por unidad', cx + 5, cy)
  cx += 5 + doc.getTextWidth('conteo por unidad  ')
  doc.rect(cx, cy - 3, 3, 3)
  doc.text('conteo aleatorio', cx + 5, cy)

  cy += 10
  const colW = (CONTENT_W - padX * 2) / 4
  const labels = ['NOMBRE Y APELLIDO', 'CARGO', 'TIPO Y No DOCUMENTO', 'FIRMA']
  labels.forEach((label, i) => {
    const lx = MARGIN + padX + i * colW
    doc.setLineWidth(0.3)
    doc.line(lx, cy, lx + colW - 6, cy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(70)
    doc.text(label, lx + (colW - 6) / 2, cy + 3.5, { align: 'center' })
    doc.setTextColor(0)
  })

  cy += 14
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.6)
  doc.setTextColor(85)
  const legal = 'Con la firma de la presente remisión certifico haber recibido las cantidades aquí estipuladas y los productos en óptimas condiciones.'
  const legalLines = doc.splitTextToSize(legal, CONTENT_W - padX * 2)
  legalLines.forEach((line, i) => doc.text(line, MARGIN + padX, cy + i * 3.2))
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  return y + h + 5
}

function drawTransportadorBlock(doc, y) {
  const padX = 4
  const h = 38
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, y, CONTENT_W, h)

  let cy = y + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.6)
  doc.text('DATOS DEL TRANSPORTADOR', MARGIN + CONTENT_W / 2, cy, { align: 'center' })
  const titleW = doc.getTextWidth('DATOS DEL TRANSPORTADOR')
  doc.setLineWidth(0.25)
  doc.line(MARGIN + CONTENT_W / 2 - titleW / 2, cy + 0.8, MARGIN + CONTENT_W / 2 + titleW / 2, cy + 0.8)

  cy += 7
  const colW = (CONTENT_W - padX * 2) / 2
  const rows = [
    ['Nombre:', 'Hora llegada:'],
    ['Identificación:', 'Hora de salida:'],
    ['Auxiliar:', 'Fecha entrega:'],
  ]
  doc.setFontSize(7.6)
  rows.forEach(([left, right]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(left, MARGIN + padX, cy)
    const leftLabelW = doc.getTextWidth(`${left} `)
    doc.setLineWidth(0.25)
    doc.line(MARGIN + padX + leftLabelW, cy + 0.6, MARGIN + padX + colW - 4, cy + 0.6)

    doc.text(right, MARGIN + padX + colW, cy)
    const rightLabelW = doc.getTextWidth(`${right} `)
    doc.line(MARGIN + padX + colW + rightLabelW, cy + 0.6, MARGIN + CONTENT_W - padX, cy + 0.6)
    cy += 6.2
  })

  cy += 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.text('SALDO CANASTILLAS: _____ EN COLEGIO', MARGIN + padX, cy)

  return y + h
}

export function construirHtmlRemision(doc, { nro, fechaEmision, fechaEntrega, sitio, oc, numeros_oc, modalidad, productos, totalUnd, totalVal }) {
  let y = MARGIN
  y = drawHeader(doc, y, { nro, fechaEmision, oc: numeros_oc || oc, modalidad })
  y = drawInfoBlock(doc, y, { sitio, fechaEntrega })
  y = drawItemsTable(doc, y, { productos, totalUnd, totalVal })
  y = drawRecibiBlock(doc, y)
  drawTransportadorBlock(doc, y)
}

export function generarPdfRemisiones(remisiones) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  remisiones.forEach((r, i) => {
    if (i > 0) doc.addPage('a4', 'p')
    construirHtmlRemision(doc, r)
  })
  return doc.output('blob')
}
