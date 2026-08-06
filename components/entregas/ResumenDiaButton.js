'use client'

import { construirResumenDiaMensaje } from '../../lib/entregasMensaje'

export default function ResumenDiaButton({ colegios, conductor, fecha }) {
  function handleClick() {
    const mensaje = construirResumenDiaMensaje(colegios, conductor, fecha)
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  return (
    <button type="button" className="btn-primary entregas-form-btn-wide" onClick={handleClick}>
      📤 Enviar resumen del día al grupo
    </button>
  )
}
