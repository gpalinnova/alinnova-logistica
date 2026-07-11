import { jsPDF } from 'jspdf'

export const PRECIOS_REFRIGERIO = {
  tipo_a: 6405,
  tipo_b: 6405,
  tipo_c: 7560,
  tipo_d: 7560,
  muestra_tipo_1: 6405,
  muestra_tipo_2: 7560,
}

const TIPOS_REMISION = [
  { key: 'tipo_a', label: 'REFRIGERIO TIPO A' },
  { key: 'tipo_b', label: 'REFRIGERIO TIPO B' },
  { key: 'tipo_c', label: 'REFRIGERIO TIPO C' },
  { key: 'tipo_d', label: 'REFRIGERIO TIPO D' },
  { key: 'muestra_tipo_1', label: 'MUESTRA TIPO 1' },
  { key: 'muestra_tipo_2', label: 'MUESTRA TIPO 2' },
]

const MAX_ITEM_ROWS = 6

const PAGE_W = 215.9
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

function fmtP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
}

export function fmtFechaCorta(fechaISO) {
  if (!fechaISO) return ''
  const [y, m, d] = fechaISO.split('-')
  return `${d}/${m}/${y}`
}

export function buildItemsSitio(sitio) {
  const items = TIPOS_REMISION
    .map(t => ({ label: t.label, qty: sitio[t.key] || 0, unit: PRECIOS_REFRIGERIO[t.key] }))
    .filter(i => i.qty > 0)
    .map(i => ({ ...i, total: i.qty * i.unit }))
  const totalUnidades = items.reduce((s, i) => s + i.qty, 0)
  const totalValor = items.reduce((s, i) => s + i.total, 0)
  return { items, totalUnidades, totalValor }
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

function drawHeader(doc, y, { nro, fechaEmisionStr, valorizada }) {
  const logoW = 40
  const rightW = 52
  const midX = MARGIN + logoW + 4
  const midW = CONTENT_W - logoW - 4 - rightW - 4

  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.rect(MARGIN, y, logoW, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('A L I N N O V A', MARGIN + logoW / 2, y + 10.5, { align: 'center' })

  let ly = y + 4
  doc.setFontSize(8.2)
  textRowInline(doc, midX, ly, midW, 'Razón Social:', 'ALINNOVA S.A.S      NIT: 901.015.983-9', { fontSize: 8.2, lineHeight: 5 })
  ly += 5
  textRowInline(doc, midX, ly, midW, 'Dirección:', 'Cra. 69B 77 - 44      TEL: 310 309 50 96', { fontSize: 8.2, lineHeight: 5 })
  ly += 5
  textRowInline(doc, midX, ly, midW, 'Linea de Producción:', 'Refrigerios Reforzados', { fontSize: 8.2, lineHeight: 5 })

  const rx = MARGIN + CONTENT_W - rightW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('REMISION', rx + rightW, y + 5, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`Nro ${nro}`, rx + rightW, y + 10, { align: 'right' })
  doc.text(`FECHA ${fechaEmisionStr}`, rx + rightW, y + 14.5, { align: 'right' })
  doc.setFontSize(7.5)
  if (valorizada) {
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(85)
    doc.text('COPIA VALORIZADA', rx + rightW, y + 18.5, { align: 'right' })
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(192, 57, 43)
    doc.text('COPIA SIN VALORIZAR', rx + rightW, y + 18.5, { align: 'right' })
  }
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  const bottomY = y + 21
  doc.setLineWidth(0.6)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 4
}

function drawInfoBlock(doc, y, sitio, fechaEntregaStr) {
  const padX = 4
  const padTop = 5
  const x = MARGIN + padX
  const w = CONTENT_W - padX * 2

  let cy = y + padTop
  cy = textRowInline(doc, x, cy, w, 'Nombre Institución Educativa:', sitio.nombre_institucion)
  cy = textRowInline(doc, x, cy, w, 'Nombre y/o Descripción Sitio de Entrega:', sitio.nombre_descripcion || sitio.nombre_institucion)
  cy = textRowInline(doc, x, cy, w, 'Dirección de Entrega:', sitio.direccion)
  cy = textRowInline(doc, x, cy, w, 'Barrio:', sitio.barrio)
  cy += 1.5
  cy = metaRowInline(doc, x, cy, w, [
    ['Id Sitio Entrega:', sitio.id_sitio_entrega],
    ['Sede Educativa:', sitio.sede_educativa],
    ['Sitio de Entrega:', sitio.sitio_entrega],
    ['Localidad:', sitio.localidad],
  ])
  cy += 1
  cy = metaRowInline(doc, x, cy, w, [
    ['Jornada:', sitio.jornada],
    ['Horario de Entrega:', sitio.horario_sugerido],
    ['Fecha de Entrega:', fechaEntregaStr],
  ])

  const obsRaw = sitio.observacion && String(sitio.observacion).trim()
  const obs = obsRaw && obsRaw.toUpperCase() !== 'NA' ? obsRaw : ''
  if (obs) {
    cy += 1.5
    doc.setTextColor(192, 57, 43)
    cy = textRowInline(doc, x, cy, w, 'Observación:', obs, { fontSize: 8.5 })
    doc.setTextColor(0)
  }

  const bottom = cy + padTop - 2
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, y, CONTENT_W, bottom - y)
  return bottom + 4
}

function drawItemsTable(doc, y, sitio, valorizada) {
  const cols = [
    { key: 'item', label: 'ITEM', w: 12, align: 'center' },
    { key: 'producto', label: 'PRODUCTO', w: 56, align: 'left' },
    { key: 'cantidad', label: 'CANTIDAD', w: 24, align: 'center' },
    { key: 'unit', label: 'VALOR UNIT.', w: 30, align: 'right' },
    { key: 'total', label: 'VALOR TOTAL', w: 32, align: 'right' },
    { key: 'obs', label: 'OBSERVACIONES', w: CONTENT_W - (12 + 56 + 24 + 30 + 32), align: 'center' },
  ]
  const headerH = 7
  const rowH = 6.4
  const totalH = 7.2

  doc.setFillColor(0, 0, 0)
  doc.rect(MARGIN, y, CONTENT_W, headerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.6)
  let x = MARGIN
  cols.forEach(c => {
    doc.text(c.label, x + c.w / 2, y + headerH / 2 + 1.3, { align: 'center' })
    x += c.w
  })
  doc.setTextColor(0)

  const { items, totalUnidades, totalValor } = buildItemsSitio(sitio)
  let ry = y + headerH
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)

  for (let i = 0; i < MAX_ITEM_ROWS; i++) {
    const item = items[i]
    x = MARGIN
    cols.forEach(c => {
      doc.rect(x, ry, c.w, rowH)
      let text = ''
      if (c.key === 'item') text = String(i + 1)
      else if (item) {
        if (c.key === 'producto') text = item.label
        else if (c.key === 'cantidad') text = fmtN(item.qty)
        else if (c.key === 'unit') text = valorizada ? fmtP(item.unit) : ''
        else if (c.key === 'total') text = valorizada ? fmtP(item.total) : ''
      } else if (c.key === 'cantidad') {
        text = '-'
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
  doc.text(fmtN(totalUnidades), MARGIN + cols[0].w + cols[1].w + cols[2].w / 2, ry + totalH / 2 + 1.3, { align: 'center' })
  if (valorizada) {
    const totalX = MARGIN + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 2
    doc.text(fmtP(totalValor), totalX, ry + totalH / 2 + 1.3, { align: 'right' })
  }
  doc.setFont('helvetica', 'normal')

  return ry + totalH + 5
}

function drawRecibiBlock(doc, y) {
  const padX = 4
  const h = 48
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, y, CONTENT_W, h)

  let cy = y + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.6)
  doc.text('ESPACIO EXCLUSIVO PARA QUIEN RECIBE', MARGIN + CONTENT_W / 2, cy, { align: 'center' })
  const titleW = doc.getTextWidth('ESPACIO EXCLUSIVO PARA QUIEN RECIBE')
  doc.setLineWidth(0.25)
  doc.line(MARGIN + CONTENT_W / 2 - titleW / 2, cy + 0.8, MARGIN + CONTENT_W / 2 + titleW / 2, cy + 0.8)

  cy += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.text('Indique el método de validación de producto recibido:', MARGIN + padX, cy)
  let cx = MARGIN + padX + doc.getTextWidth('Indique el método de validación de producto recibido:  ')
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(cx, cy - 3, 3, 3)
  doc.text('conteo por unidad', cx + 5, cy)
  cx += 5 + doc.getTextWidth('conteo por unidad  ')
  doc.rect(cx, cy - 3, 3, 3)
  doc.text('conteo aleatorio', cx + 5, cy)

  cy += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.2)
  doc.text('RECIBI CONFORME:', MARGIN + padX, cy)

  cy += 13
  const colW = (CONTENT_W - padX * 2) / 3
  const labels = ['FECHA DE RECIBIDO', 'NOMBRE Y APELLIDO', 'FIRMA']
  labels.forEach((label, i) => {
    const lx = MARGIN + padX + i * colW
    doc.setLineWidth(0.3)
    doc.line(lx, cy, lx + colW - 6, cy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    doc.setTextColor(70)
    doc.text(label, lx + (colW - 6) / 2, cy + 3.5, { align: 'center' })
    doc.setTextColor(0)
  })

  cy += 9
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.8)
  doc.setTextColor(85)
  const legal = 'Con la firma de la presente remisión certifico haber recibido las cantidades aquí estipuladas y los productos en óptimas condiciones.'
  const legalLines = doc.splitTextToSize(legal, CONTENT_W - padX * 2)
  legalLines.forEach((line, i) => doc.text(line, MARGIN + padX, cy + i * 3.4))
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  return y + h + 5
}

function drawTransportadorBlock(doc, y) {
  const padX = 4
  const h = 50
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
    ['Auxiliar:', 'Fecha de entrega:'],
    ['Canastillas que ingresan:', 'Canastillas que se retiran:'],
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

  cy += 1.5
  doc.setFont('helvetica', 'bold')
  doc.text('Observaciones:', MARGIN + padX, cy)
  const obsLabelW = doc.getTextWidth('Observaciones: ')
  doc.line(MARGIN + padX + obsLabelW, cy + 0.6, MARGIN + CONTENT_W - padX, cy + 0.6)

  cy += 7
  doc.text('Firma:', MARGIN + padX, cy)
  const firmaLabelW = doc.getTextWidth('Firma: ')
  doc.line(MARGIN + padX + firmaLabelW, cy + 0.6, MARGIN + padX + 70, cy + 0.6)
  doc.setFont('helvetica', 'normal')

  return y + h
}

function renderRemisionPage(doc, { sitio, nro, fechaEmisionStr, fechaEntregaStr, valorizada }) {
  let y = MARGIN
  y = drawHeader(doc, y, { nro, fechaEmisionStr, valorizada })
  y = drawInfoBlock(doc, y, sitio, fechaEntregaStr)
  y = drawItemsTable(doc, y, sitio, valorizada)
  y = drawRecibiBlock(doc, y)
  drawTransportadorBlock(doc, y)
}

export function generateRemisionesPDF(sitiosOrdenados, { numeroInicial, fechaEmisionISO, fechaEntregaISO }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true })
  const fechaEmisionStr = fmtFechaCorta(fechaEmisionISO)
  const fechaEntregaStr = fmtFechaCorta(fechaEntregaISO)

  let totalUnidades = 0
  let totalValor = 0

  sitiosOrdenados.forEach((sitio, i) => {
    const nro = numeroInicial + i
    const { totalUnidades: u, totalValor: v } = buildItemsSitio(sitio)
    totalUnidades += u
    totalValor += v

    if (i > 0) doc.addPage('letter', 'p')
    renderRemisionPage(doc, { sitio, nro, fechaEmisionStr, fechaEntregaStr, valorizada: true })

    doc.addPage('letter', 'p')
    renderRemisionPage(doc, { sitio, nro, fechaEmisionStr, fechaEntregaStr, valorizada: false })
  })

  const numeroFinal = numeroInicial + sitiosOrdenados.length - 1

  return { doc, numeroFinal, cantidad: sitiosOrdenados.length, totalUnidades, totalValor }
}
