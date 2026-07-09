import AreaPage from '../../components/AreaPage'

const ITEMS = [
  { icon: '📤', title: 'Subir Archivo' },
  { icon: '📝', title: 'Nueva Remisión' },
  { icon: '🔄', title: 'Ciclo de Entrega' },
  { icon: '🗂️', title: 'Historial' },
  { icon: '💬', title: 'Tabla WhatsApp', href: '/reforzados/tabla-whatsapp', accent: 'accent-whatsapp' },
]

export default function ReforzadosPage() {
  return (
    <AreaPage
      backHref="/"
      backLabel="Inicio"
      title="Reforzados"
      subtitle="Control Logística"
      items={ITEMS}
    />
  )
}
