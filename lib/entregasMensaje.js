import { formatFechaLargaSinComa } from './tablaWhatsappUtils'

const NUM_EMOJIS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

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

// Arma el mensaje de cierre de ruta (resumen del día) cuando el 100% de las
// entregas del conductor quedaron registradas. `entregas` son los colegios
// con su `registro` adjunto, en el mismo formato que arma getColegiosDelDia
// en app/entregas/[token]/page.js (incluye `orden`).
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
    const marcador = n <= 10 ? NUM_EMOJIS[n] : `${n}. `
    const registro = colegio.registro || {}

    lines.push(`${marcador} *${colegio.nombreInstitucion}*`)

    if (!registro.hora_llegada || !registro.hora_salida) {
      lines.push('   ⏰ Sin registro de horas')
    } else {
      lines.push(`   ⏰ ${registro.hora_llegada.slice(0, 5)} → ${registro.hora_salida.slice(0, 5)}`)
    }

    const cargo = registro.cargo_recibe ? ` (${registro.cargo_recibe})` : ''
    lines.push(`   👤 ${registro.quien_recibe || '—'}${cargo}`)
    lines.push('')
  })

  lines.push('— Enviado desde Control Logística Alinnova')

  return lines.join('\n')
}
