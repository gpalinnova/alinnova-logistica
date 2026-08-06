function siNo(v) {
  return v ? 'Sí' : 'No'
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

  const horas = []
  if (valores.hora_llegada) horas.push(`Llegada: *${valores.hora_llegada}*`)
  if (valores.hora_recibido) horas.push(`Recibido: *${valores.hora_recibido}*`)
  if (valores.hora_salida) horas.push(`Salida: *${valores.hora_salida}*`)
  if (horas.length) lines.push(`⏰ ${horas.join(' · ')}`)

  const temperaturas = []
  if (valores.temperatura_transporte) temperaturas.push(`T ${valores.temperatura_transporte}`)
  if (valores.temperatura_producto) temperaturas.push(`P ${valores.temperatura_producto}`)
  if (temperaturas.length) lines.push(`🌡️ Temperatura: *${temperaturas.join(' / ')}*`)

  if (valores.quien_recibe) {
    const cargo = valores.cargo_recibe ? ` (${valores.cargo_recibe})` : ''
    lines.push(`👤 Recibe: *${valores.quien_recibe}*${cargo}`)
  }

  lines.push(`✍️ Firma planillas: *${siNo(valores.firma_planillas)}*`)
  lines.push(`🔍 Interventoría: *${siNo(valores.interventoria)}*`)
  lines.push(`📊 Método conteo: *${valores.metodo_conteo === 'uno_a_uno' ? 'Uno a uno' : 'Aleatorio'}*`)

  const canastillas = []
  if (valores.canastillas_presentan != null) canastillas.push(`presentan *${valores.canastillas_presentan}*`)
  if (valores.canastillas_retiran != null) canastillas.push(`retiran *${valores.canastillas_retiran}*`)
  if (canastillas.length) lines.push(`🧺 Canastillas: ${canastillas.join(' / ')}`)

  if (valores.observacion) {
    lines.push('')
    lines.push(`📝 ${valores.observacion}`)
  }

  return lines.join('\n')
}
