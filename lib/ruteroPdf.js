import { jsPDF } from 'jspdf'

const PAGE_W = 279.4
const PAGE_H = 215.9
const MARGIN = 8
const CONTENT_W = PAGE_W - MARGIN * 2

const COMPONENTES = [
  { key: 'bebida', label: 'BEBIDA' },
  { key: 'cereal1', label: 'CEREAL TIPO 1 "PEQUEÑO"' },
  { key: 'cereal2', label: 'CEREAL TIPO 2 "GRANDE"' },
  { key: 'fruta', label: 'FRUTA' },
  { key: 'postre', label: 'POSTRE' },
  { key: 'agua', label: 'N/A' },
]

const SITE_COLS = [
  { key: 'idSitio', label: 'ID SITIO ENTREGA', w: 10 },
  { key: 'institucion', label: 'NOMBRE INSTITUCIÓN EDUCATIVA', w: 27 },
  { key: 'descripcion', label: 'NOMBRE Y/O DESCRIPCIÓN SITIO DE ENTREGA', w: 25 },
  { key: 'sede', label: 'SEDE EDUCATIVA', w: 13 },
  { key: 'sitioEntrega', label: 'SITIO DE ENTREGA', w: 13 },
  { key: 'direccion', label: 'DIRECCIÓN DE ENTREGA', w: 35 },
]

const TIPO_COLS = [
  { key: 'tipoA', label: 'A', w: 7 },
  { key: 'tipoB', label: 'B', w: 7 },
  { key: 'tipoC', label: 'C', w: 7 },
  { key: 'tipoD', label: 'D', w: 7 },
  { key: 'muestra1', label: 'MUESTRA TIPO 1', w: 9 },
  { key: 'muestra2', label: 'MUESTRA TIPO 2', w: 9 },
  { key: 'total', label: 'TOTAL', w: 10 },
]

const COMPONENTE_COL_W = 7 // ancho de cada subcolumna CAN/UND

function fmtN(n) {
  return new Intl.NumberFormat('es-CO').format(n || 0)
}

export function fmtFechaCorta(fechaISO) {
  if (!fechaISO) return ''
  const [y, m, d] = fechaISO.split('-')
  return `${d}/${m}/${y}`
}

function empaqueTexto(producto) {
  return producto?.unidades_por_canastilla ? `${producto.unidades_por_canastilla} UND / CAN` : '-'
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
  doc.setFontSize(opts.fontSize || 6.4)
  const lineH = opts.lineHeight || (opts.fontSize ? opts.fontSize * 0.42 : 2.7)
  const lines = doc.splitTextToSize(String(text), w - 1.6)
  const totalH = lines.length * lineH
  let ty = y + h / 2 - totalH / 2 + lineH * 0.78
  lines.forEach(line => {
    doc.text(line, x + w / 2, ty, { align: 'center' })
    ty += lineH
  })
}

function drawTopHeader(doc, y, { fechaStr }) {
  const logoW = 38
  const rightW = 55
  const midX = MARGIN + logoW + 4
  const midW = CONTENT_W - logoW - 4 - rightW - 4

  doc.setDrawColor(0)
  doc.setLineWidth(0.4)
  doc.rect(MARGIN, y, logoW, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('A L I N N O V A', MARGIN + logoW / 2, y + 10.5, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('PROGRAMA DE REFRIGERIOS', midX + midW / 2, y + 8, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('REMISIÓN REFRIGERIOS', midX + midW / 2, y + 14.5, { align: 'center' })

  const rx = MARGIN + CONTENT_W - rightW
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Código:', rx, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text('RF-FO - 001', rx + 16, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.text('Versión:', rx, y + 8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('2', rx + 16, y + 8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('F. Elaboración:', rx, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.text('04/04/2024', rx + 24, y + 13)
  doc.setFont('helvetica', 'bold')
  doc.text('Fecha:', rx, y + 17.5)
  doc.setFont('helvetica', 'normal')
  doc.text(fechaStr, rx + 16, y + 17.5)

  const bottomY = y + 21
  doc.setLineWidth(0.6)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 3
}

function drawRutaRow(doc, y, { ruta, conductor, placa, menu }) {
  const h = 7
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)
  doc.setFontSize(8.5)
  const colW = CONTENT_W / 4
  const items = [
    ['RUTA:', ruta],
    ['CONDUCTOR:', conductor],
    ['PLACA:', placa],
    ['MENU:', menu != null ? String(menu) : '-'],
  ]
  items.forEach(([label, value], i) => {
    const x = MARGIN + i * colW
    doc.line(x, y, x, y + h)
    doc.setFont('helvetica', 'bold')
    doc.text(label, x + 2, y + h / 2 + 1.2)
    const labelW = doc.getTextWidth(`${label} `)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value || '-'), x + 2 + labelW, y + h / 2 + 1.2)
  })
  doc.rect(MARGIN, y, CONTENT_W, h)
  return y + h + 2
}

function drawTableHeader(doc, y, menuDelDia) {
  const rowH = 5.6
  const headerH = rowH * 5
  let x = MARGIN

  // Columnas de sitio: una sola celda que ocupa todo el alto del header
  for (const c of SITE_COLS) {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 5.4 })
    x += c.w
  }

  // TIPO 1 / TIPO 2 (fila 1) + A/B/C/D (resto del alto)
  const tipoStartX = x
  drawCell(doc, x, y, TIPO_COLS[0].w + TIPO_COLS[1].w, rowH, 'TIPO 1', { bold: true, fontSize: 5.6 })
  drawCell(doc, x + TIPO_COLS[0].w + TIPO_COLS[1].w, y, TIPO_COLS[2].w + TIPO_COLS[3].w, rowH, 'TIPO 2', { bold: true, fontSize: 5.6 })
  for (let i = 0; i < 4; i++) {
    drawCell(doc, x, y + rowH, TIPO_COLS[i].w, headerH - rowH, TIPO_COLS[i].label, { bold: true, fontSize: 6 })
    x += TIPO_COLS[i].w
  }
  // MUESTRA TIPO 1/2 y TOTAL: una celda de todo el alto
  for (let i = 4; i < TIPO_COLS.length; i++) {
    drawCell(doc, x, y, TIPO_COLS[i].w, headerH, TIPO_COLS[i].label, { bold: true, fontSize: 5.2 })
    x += TIPO_COLS[i].w
  }
  void tipoStartX

  // MENU: fila 1 = "MENU"; fila 2 = componente; fila 3 = producto; fila 4 = empaque; fila 5 = CAN/UND
  const menuStartX = x
  const menuW = COMPONENTES.length * COMPONENTE_COL_W * 2
  drawCell(doc, menuStartX, y, menuW, rowH, 'MENU', { bold: true, fontSize: 6 })

  for (const comp of COMPONENTES) {
    const producto = menuDelDia?.[comp.key]
    const w2 = COMPONENTE_COL_W * 2
    drawCell(doc, x, y + rowH, w2, rowH, comp.label, { bold: true, fontSize: 5 })
    drawCell(doc, x, y + rowH * 2, w2, rowH, producto?.nombre || '-', { fontSize: 4.8 })
    drawCell(doc, x, y + rowH * 3, w2, rowH, empaqueTexto(producto), { bold: true, fontSize: 4.8 })
    drawCell(doc, x, y + rowH * 4, COMPONENTE_COL_W, rowH, 'CAN', { bold: true, fontSize: 4.6 })
    drawCell(doc, x + COMPONENTE_COL_W, y + rowH * 4, COMPONENTE_COL_W, rowH, 'UND', { bold: true, fontSize: 4.6 })
    x += w2
  }

  return y + headerH
}

function drawSiteRow(doc, y, fila, rowH) {
  let x = MARGIN
  const siteValues = {
    idSitio: fila.idSitio,
    institucion: fila.nombreInstitucion,
    descripcion: fila.nombreDescripcion,
    sede: fila.sedeEducativa,
    sitioEntrega: fila.sitioEntrega,
    direccion: fila.direccion,
  }
  for (const c of SITE_COLS) {
    drawCell(doc, x, y, c.w, rowH, siteValues[c.key], { fontSize: 6 })
    x += c.w
  }

  const tipoValues = {
    tipoA: fila.tipoA, tipoB: fila.tipoB, tipoC: fila.tipoC, tipoD: fila.tipoD,
    muestra1: fila.muestra1, muestra2: fila.muestra2, total: fila.total,
  }
  for (const c of TIPO_COLS) {
    const v = tipoValues[c.key]
    drawCell(doc, x, y, c.w, rowH, v > 0 ? fmtN(v) : '-', { fontSize: 6.4, bold: c.key === 'total' })
    x += c.w
  }

  for (const comp of COMPONENTES) {
    const { canastillas, unidades } = fila.componentes[comp.key]
    const hasValue = canastillas > 0 || unidades > 0
    drawCell(doc, x, y, COMPONENTE_COL_W, rowH, hasValue ? fmtN(canastillas) : '-', { fontSize: 6.4 })
    x += COMPONENTE_COL_W
    drawCell(doc, x, y, COMPONENTE_COL_W, rowH, hasValue ? fmtN(unidades) : '-', { fontSize: 6.4 })
    x += COMPONENTE_COL_W
  }

  return y + rowH
}

function drawTotalRow(doc, y, totales) {
  const rowH = 6.5
  const fill = [235, 235, 235]
  let x = MARGIN

  const labelW = SITE_COLS.reduce((s, c) => s + c.w, 0)
  drawCell(doc, x, y, labelW, rowH, 'TOTAL', { bold: true, fontSize: 7.5, fill })
  x += labelW

  const tipoValues = {
    tipoA: totales.tipoA, tipoB: totales.tipoB, tipoC: totales.tipoC, tipoD: totales.tipoD,
    muestra1: totales.muestra1, muestra2: totales.muestra2, total: totales.total,
  }
  for (const c of TIPO_COLS) {
    drawCell(doc, x, y, c.w, rowH, fmtN(tipoValues[c.key]), { bold: true, fontSize: 6.6, fill })
    x += c.w
  }

  for (const comp of COMPONENTES) {
    drawCell(doc, x, y, COMPONENTE_COL_W, rowH, fmtN(totales.canastillas[comp.key]), { bold: true, fontSize: 6.6, fill })
    x += COMPONENTE_COL_W
    drawCell(doc, x, y, COMPONENTE_COL_W, rowH, '', { fill })
    x += COMPONENTE_COL_W
  }

  return y + rowH + 3
}

function drawFirmasBlock(doc, y, { conductor, auxiliar, fechaStr, totalCanastas }) {
  const h = 30
  doc.setDrawColor(0)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)

  const padX = 4
  const rowH = h / 3
  const rows = [
    [['CONDUCTOR:', conductor], ['IDENTIFICACIÓN:', ''], ['FIRMA:', '']],
    [['AUXILIAR:', auxiliar], ['IDENTIFICACIÓN:', ''], ['FIRMA:', '']],
    [['FECHA:', fechaStr], ['HORA LLEGADA:', ''], ['HORA DE SALIDA:', ''], ['TOTAL CANASTAS:', fmtN(totalCanastas)]],
  ]

  rows.forEach((cells, ri) => {
    const cy = y + ri * rowH + rowH / 2 + 1.5
    const colW = (CONTENT_W - padX * 2) / cells.length
    doc.setFontSize(7.6)
    cells.forEach(([label, value], ci) => {
      const cx = MARGIN + padX + ci * colW
      doc.setFont('helvetica', 'bold')
      doc.text(label, cx, cy)
      const labelW = doc.getTextWidth(`${label} `)
      doc.setFont('helvetica', 'normal')
      doc.setLineWidth(0.2)
      doc.line(cx + labelW, cy + 0.6, cx + colW - 3, cy + 0.6)
      if (value) doc.text(String(value), cx + labelW, cy)
    })
    if (ri < rows.length - 1) doc.line(MARGIN, y + (ri + 1) * rowH, MARGIN + CONTENT_W, y + (ri + 1) * rowH)
  })

  return y + h + 3
}

function drawProductosLoteBlock(doc, y, w) {
  const rowH = 4.6
  const headerH = 5
  const cols = [
    { label: 'PRODUCTO', w: w * 0.55 },
    { label: 'LOTE', w: w * 0.22 },
    { label: 'F. VENCIMIENTO', w: w * 0.23 },
  ]
  let x = MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.4)
  cols.forEach(c => {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 6, fill: [235, 235, 235] })
    x += c.w
  })
  let ry = y + headerH
  for (let i = 0; i < 5; i++) {
    x = MARGIN
    cols.forEach(c => {
      drawCell(doc, x, ry, c.w, rowH, '')
      x += c.w
    })
    ry += rowH
  }
  return ry
}

function drawLimpiezaBlock(doc, y, x0, w) {
  const headerH = 5
  const rowH = 6
  const cols = [
    { label: 'CUMPLE', w: w * 0.14 },
    { label: 'NO CUMPLE', w: w * 0.14 },
    { label: 'ENTREGA', w: w * 0.24 },
    { label: 'RECIBE', w: w * 0.24 },
    { label: 'OBSERVACIONES', w: w * 0.24 },
  ]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.6)
  doc.text('LIMPIEZA CANASTILLAS', x0, y - 1.2)
  let x = x0
  cols.forEach(c => {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 5.6, fill: [235, 235, 235] })
    x += c.w
  })
  x = x0
  cols.forEach(c => {
    drawCell(doc, x, y + headerH, c.w, rowH, '')
    x += c.w
  })
  return y + headerH + rowH
}

function drawAdicionalesBlock(doc, y, x0, w) {
  const headerH = 5
  const rowH = 6
  const cols = [
    { label: 'UNIDADES ADICIONALES', w: w * 0.5 },
    { label: 'REFRIGERIOS COMPLETOS', w: w * 0.3 },
    { label: 'CANTIDAD', w: w * 0.2 },
  ]
  let x = x0
  cols.forEach(c => {
    drawCell(doc, x, y, c.w, headerH, c.label, { bold: true, fontSize: 5.6, fill: [235, 235, 235] })
    x += c.w
  })
  x = x0
  cols.forEach(c => {
    drawCell(doc, x, y + headerH, c.w, rowH, '')
    x += c.w
  })
  return y + headerH + rowH
}

function drawObservacionesBlock(doc, y, w) {
  const h = 16
  doc.setDrawColor(0)
  doc.setLineWidth(0.25)
  doc.rect(MARGIN, y, w, h)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.4)
  doc.text('OBSERVACIONES:', MARGIN + 2, y + 4.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.6)
  doc.text('FIRMA:', MARGIN + w - 40, y + h - 3)
  doc.setLineWidth(0.2)
  doc.line(MARGIN + w - 32, y + h - 3, MARGIN + w - 3, y + h - 3)
  return y + h
}

export function generateRuteroPDF(conductores, { fechaISO, menuDelDia }) {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'landscape', compress: true })
  const fechaStr = fmtFechaCorta(fechaISO)

  conductores.forEach((c, i) => {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')

    let y = MARGIN
    y = drawTopHeader(doc, y, { fechaStr })
    y = drawRutaRow(doc, y, { ruta: 'RUTA', conductor: c.conductor, placa: c.placa, menu: menuDelDia?.menuNumero })
    y = drawTableHeader(doc, y, menuDelDia)

    const rowH = 8
    for (const fila of c.filas) {
      if (y + rowH > PAGE_H - 75) {
        doc.addPage([PAGE_W, PAGE_H], 'landscape')
        y = MARGIN
        y = drawTopHeader(doc, y, { fechaStr })
        y = drawRutaRow(doc, y, { ruta: 'RUTA', conductor: c.conductor, placa: c.placa, menu: menuDelDia?.menuNumero })
        y = drawTableHeader(doc, y, menuDelDia)
      }
      y = drawSiteRow(doc, y, fila, rowH)
    }

    y = drawTotalRow(doc, y, c.totales)
    y = drawFirmasBlock(doc, y, { conductor: c.conductor, auxiliar: c.auxiliar, fechaStr, totalCanastas: c.totales.totalCanastas })

    const colGap = 4
    const leftW = CONTENT_W * 0.42
    const rightX = MARGIN + leftW + colGap
    const rightW = CONTENT_W - leftW - colGap

    const productosBottom = drawProductosLoteBlock(doc, y, leftW)
    let ry = y
    ry = drawLimpiezaBlock(doc, ry, rightX, rightW) + 3
    ry = drawAdicionalesBlock(doc, ry, rightX, rightW)

    const blockBottom = Math.max(productosBottom, ry) + 3
    drawObservacionesBlock(doc, blockBottom, CONTENT_W)
  })

  return { doc }
}
