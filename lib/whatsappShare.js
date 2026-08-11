// Envía un mensaje por WhatsApp evitando el bug de wa.me que corrompe los
// bytes UTF-8 de los emojis en Android. Prioriza Web Share API (respeta el
// encoding del sistema); si no está disponible, cae a api.whatsapp.com/send.
export async function enviarPorWhatsApp(mensaje) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text: mensaje })
      return { success: true, method: 'share' }
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, method: 'cancelled' }
    }
  }
  const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(mensaje)
  window.open(url, '_blank', 'noopener,noreferrer')
  return { success: true, method: 'url' }
}
