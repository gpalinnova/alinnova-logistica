import { formatFechaLargaSinComa } from './tablaWhatsappUtils'

const SEPARADOR = '━'.repeat(16)

function siNo(v) {
  return v ? 'Sí' : 'No'
}

function horaCorta(hora) {
  return hora ? hora.slice(0, 5) : ''
}

function metodoConteoLabel(metodo) {
  return metodo === 'uno_a_uno' ? 'Uno a uno' : 'Aleatorio'
}

// Helpers de formato compartidos entre el mensaje por-colegio y el resumen
// de cierre de ruta: cada uno arma una línea o devuelve null si el/los
// campo(s) de los que depende están vacíos (para poder omitir la línea).
function formatLineaHoras({ hora_llegada, hora_recibido, hora_salida }) {
  const partes = []
  if (hora_llegada) partes.push(`Llegada: *${hora_llegada}*`)
  if (hora_recibido) partes.push(`Recibido: *${hora_recibido}*`)
  if (hora_salida) partes.push(`Salida: *${hora_salida}*`)
  if (!partes.length) return null
  return `⏰ ${partes.join(' · ')}`
}

function formatLineaTemperatura(temperatura_transporte, temperatura_producto) {
  const partes = []
  if (temperatura_transporte) partes.push(`T ${temperatura_transporte}`)
  if (temperatura_producto) partes.push(`P ${temperatura_producto}`)
  if (!partes.length) return null
  return `🌡️ Temperatura: *${partes.join(' / ')}*`
}

function formatLineaRecibe(quien_recibe, cargo_recibe) {
  if (!quien_recibe) return null
  const cargo = cargo_recibe ? ` (${cargo_recibe})` : ''
  return `👤 Recibe: *${quien_recibe}*${cargo}`
}

function formatLineaCanastillas(canastillas_presentan, canastillas_retiran) {
  const partes = []
  if (canastillas_presentan != null) partes.push(`presentan *${canastillas_presentan}*`)
  if (canastillas_retiran != null) partes.push(`retiran *${canastillas_retiran}*`)
  if (!partes.length) return null
  return `🧺 Canastillas: ${partes.join(' / ')}`
}

// Arma el mensaje de WhatsApp de una entrega confirmada. Cada segmento
// opcional se omite por completo si el campo está vacío (sin "N/A" ni
// líneas en blanco), según el formato acordado con el usuario.
export function buildMensajeWhatsappEntrega({ conductor, colegio, valores }) {
  const lines = []
  lines.push(`🚚 *Entrega confirmada — Ruta ${conductor}*`)
  lines.push('')
  lines.push(`🏫 *${colegio.nombreInstitucion}*`)
  lines.push(`Id ${colegio.idSitioEntrega} · ${colegio.localidad || '-'}`)
  lines.push('')

  const lineaHoras = formatLineaHoras(valores)
  if (lineaHoras) lines.push(lineaHoras)

  const lineaTemperatura = formatLineaTemperatura(valores.temperatura_transporte, valores.temperatura_producto)
  if (lineaTemperatura) lines.push(lineaTemperatura)

  const lineaRecibe = formatLineaRecibe(valores.quien_recibe, valores.cargo_recibe)
  if (lineaRecibe) lines.push(lineaRecibe)

  lines.push(`✍️ Firma planillas: *${siNo(valores.firma_planillas)}*`)
  lines.push(`🔍 Interventoría: *${siNo(valores.interventoria)}*`)
  lines.push(`📊 Método conteo: *${metodoConteoLabel(valores.metodo_conteo)}*`)

  const lineaCanastillas = formatLineaCanastillas(valores.canastillas_presentan, valores.canastillas_retiran)
  if (lineaCanastillas) lines.push(lineaCanastillas)

  if (valores.observacion) {
    lines.push('')
    lines.push(`📝 ${valores.observacion}`)
  }

  return lines.join('\n')
}

// Arma el mensaje de cierre de ruta (resumen del día) cuando el 100% de las
// entregas del conductor quedaron registradas. `entregas` son los colegios
// con su `registro` adjunto, en el mismo formato que arma getColegiosDelDia
// en app/entregas/[token]/page.js (incluye `orden`). Incluye el detalle
// completo de cada entrega (mismas líneas y reglas de omisión que el
// mensaje por-colegio) para servir como reporte para el cliente.
export function construirResumenDiaMensaje(entregas, conductor, fecha) {
  const ordenadas = [...entregas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const total = ordenadas.length

  const lines = []
  lines.push(`📋 *Cierre de ruta — ${conductor}*`)
  lines.push(`📅 ${formatFechaLargaSinComa(fecha)}`)
  lines.push('')
  lines.push(`✅ *${total} de ${total} entregas completadas*`)
  lines.push('')

  ordenadas.forEach((colegio, idx) => {
    const n = idx + 1
    const registro = colegio.registro || {}

    lines.push(SEPARADOR)
    lines.push(`*${n}. ${colegio.nombreInstitucion}*`)
    lines.push(`Id ${colegio.idSitioEntrega} · ${colegio.localidad || '-'}`)
    lines.push('')

    const lineaHoras = formatLineaHoras({
      hora_llegada: horaCorta(registro.hora_llegada),
      hora_recibido: horaCorta(registro.hora_recibido),
      hora_salida: horaCorta(registro.hora_salida),
    })
    if (lineaHoras) lines.push(lineaHoras)

    const lineaTemperatura = formatLineaTemperatura(registro.temperatura_transporte, registro.temperatura_producto)
    if (lineaTemperatura) lines.push(lineaTemperatura)

    const lineaRecibe = formatLineaRecibe(registro.quien_recibe, registro.cargo_recibe)
    if (lineaRecibe) lines.push(lineaRecibe)

    lines.push(`✍️ Firma planillas: *${siNo(registro.firma_planillas)}*`)
    lines.push(`🔍 Interventoría: *${siNo(registro.interventoria)}*`)
    lines.push(`📊 Método conteo: *${metodoConteoLabel(registro.metodo_conteo)}*`)

    const lineaCanastillas = formatLineaCanastillas(registro.canastillas_presentan, registro.canastillas_retiran)
    if (lineaCanastillas) lines.push(lineaCanastillas)

    if (registro.observacion) lines.push(`📝 ${registro.observacion}`)

    lines.push('')
  })

  lines.push('— Enviado desde Control Logística Alinnova')

  return lines.join('\n')
}
