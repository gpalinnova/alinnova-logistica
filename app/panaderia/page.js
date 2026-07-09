import AreaPage from '../../components/AreaPage'

const ITEMS = [
  { icon: '📤', title: 'Subir Archivo' },
  { icon: '📝', title: 'Nueva Remisión' },
  { icon: '🔄', title: 'Ciclo de Entrega' },
  { icon: '🗂️', title: 'Historial' },
]

export default function PanaderiaPage() {
  return (
    <AreaPage
      backHref="/"
      backLabel="Inicio"
      title="Panadería"
      subtitle="Control Logística"
      items={ITEMS}
    />
  )
}
