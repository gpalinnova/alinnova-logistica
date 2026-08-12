function siNo(v) {
  return v ? 'Sí' : 'No'
}

function metodoConteoLabel(metodo) {
  return metodo === 'uno_a_uno' ? 'Uno a uno' : 'Aleatorio'
}

// Cada helper arma una línea del mensaje por-colegio o devuelve null si
// el/los campo(s) de los que depende están vacíos (para poder omitir la línea).
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
  const etiquetaId = colegio.idsSitioEntrega.length > 1 ? 'Ids' : 'Id'
  lines.push(`${etiquetaId} ${colegio.idsSitioEntrega.join(', ')} · ${colegio.localidad || '-'}`)
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
