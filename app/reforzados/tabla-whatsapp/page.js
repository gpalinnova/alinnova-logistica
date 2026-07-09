import AreaPage from '../../../components/AreaPage'

const ITEMS = [
  { icon: '📅', title: 'Ciclo del Mes' },
  { icon: '📋', title: 'Generar Tabla del Día' },
  { icon: '📦', title: 'Catálogo de Empaques' },
]

export default function TablaWhatsappPage() {
  return (
    <AreaPage
      backHref="/reforzados"
      backLabel="Reforzados"
      title="Tabla WhatsApp"
      subtitle="Reforzados"
      items={ITEMS}
    />
  )
}
