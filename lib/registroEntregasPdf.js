import { jsPDF } from 'jspdf'
import { drawCell, fmtFechaCorta } from './ruteroPdf'

const PAGE_W = 279.4
const PAGE_H = 215.9
const MARGIN = 8
const CONTENT_W = PAGE_W - MARGIN * 2

const BODY_FONT = 7.6
const LINE_H = BODY_FONT * 0.42
const ROW_PAD = 2.2
const MIN_ROW_H = 6.5
const HEADER_ROW_H = 8
const FOOTER_RESERVE = 20

const COLS = [
  { key: 'num', label: '#', w: 8 },
  { key: 'colegio', label: 'COLEGIO', w: 43 },
  { key: 'hLlegada', label: 'H. LLEGADA', w: 14 },
  { key: 'hRecibido', label: 'H. RECIBIDO', w: 14 },
  { key: 'hSalida', label: 'H. SALIDA', w: 14 },
  { key: 'temperatura', label: 'TEMPERATURA', w: 20 },
  { key: 'quienRecibe', label: 'QUIEN RECIBE', w: 26 },
  { key: 'cargo', label: 'CARGO', w: 20 },
  { key: 'planillas', label: 'PLANILLAS', w: 16 },
  { key: 'interventoria', label: 'INTERVENTORÍA', w: 26 },
  { key: 'canastillas', label: 'CANASTILLAS', w: 28 },
  { key: 'observaciones', label: 'OBSERVACIONES', w: 34.4 },
]

function drawHeader(doc, y, fechaStr) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('ALINNOVA', MARGIN, y + 6)

  doc.setFontSize(13)
  doc.text('REPORTE DE ENTREGAS DIARIO', MARGIN + CONTENT_W / 2, y + 6, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Fecha: ${fechaStr}`, MARGIN + CONTENT_W / 2, y + 12, { align: 'center' })

  const bottomY = y + 17
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, bottomY, MARGIN + CONTENT_W, bottomY)
  return bottomY + 3
}

function drawTableHeader(doc, y) {
  let x = MARGIN
  for (const c of COLS) {
    drawCell(doc, x, y, c.w, HEADER_ROW_H, c.label, { bold: true, fontSize: 6.6, fill: [225, 225, 225] })
    x += c.w
  }
  return y + HEADER_ROW_H
}

function countLines(doc, text, w) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(BODY_FONT)
  const lines = doc.splitTextToSize(String(text || ''), w - 1.6)
  return lines.length
}

function computeRowHeight(doc, fila) {
  const colegioW = COLS.find(c => c.key === 'colegio').w
  const obsW = COLS.find(c => c.key === 'observaciones').w
  const interventoriaW = COLS.find(c => c.key === 'interventoria').w
  const canastillasW = COLS.find(c => c.key === 'canastillas').w
  const maxLines = Math.max(
    countLines(doc, fila.nombreInstitucion, colegioW),
    countLines(doc, fila.observacion || '—', obsW),
    countLines(doc, fila.interventoriaTexto, interventoriaW),
    countLines(doc, fila.canastillasTexto, canastillasW),
    1
  )
  return Math.max(MIN_ROW_H, maxLines * LINE_H + ROW_PAD)
}

function drawDataRow(doc, y, rowH, num, fila) {
  let x = MARGIN
  const values = {
    num: String(num),
    colegio: fila.nombreInstitucion,
    hLlegada: fila.horaLlegada || '—',
    hRecibido: fila.horaRecibido || '—',
    hSalida: fila.horaSalida || '—',
    temperatura: fila.temperaturaTexto,
    quienRecibe: fila.quienRecibe,
    cargo: fila.cargo,
    planillas: fila.planillasTexto,
    interventoria: fila.interventoriaTexto,
    canastillas: fila.canastillasTexto,
    observaciones: fila.observacion || '—',
  }
  for (const c of COLS) {
    drawCell(doc, x, y, c.w, rowH, values[c.key], { fontSize: BODY_FONT })
    x += c.w
  }
  return y + rowH
}

function drawFooter(doc, y, total) {
  const now = new Date()
  const fechaStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const horaStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let fy = y
  if (fy + 14 > PAGE_H - MARGIN) {
    doc.addPage([PAGE_W, PAGE_H], 'landscape')
    fy = MARGIN
  } else {
    fy += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Total de entregas: ${total}`, MARGIN, fy)
  fy += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Generado por Control Logística Alinnova · ${fechaStr} ${horaStr}`, MARGIN, fy)
}

// conductores: [{ conductor, filas: [...] }] ya agrupados y ordenados
// (ver lib/registroEntregasCalc.js buildRegistroEntregasConductores).
export function generateRegistroEntregasPDF(conductores, { fechaISO }) {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'landscape', compress: true })
  const fechaStr = fmtFechaCorta(fechaISO)
  const filas = conductores.flatMap(c => c.filas)

  let y = MARGIN
  y = drawHeader(doc, y, fechaStr)
  y = drawTableHeader(doc, y)

  let num = 0
  for (const fila of filas) {
    num++
    const rowH = computeRowHeight(doc, fila)
    if (y + rowH > PAGE_H - FOOTER_RESERVE) {
      doc.addPage([PAGE_W, PAGE_H], 'landscape')
      y = MARGIN
      y = drawHeader(doc, y, fechaStr)
      y = drawTableHeader(doc, y)
    }
    y = drawDataRow(doc, y, rowH, num, fila)
  }

  drawFooter(doc, y, filas.length)

  return { doc }
}
