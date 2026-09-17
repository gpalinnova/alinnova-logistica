import Link from 'next/link'
import PageHeader from '../../../components/PageHeader'

const ITEMS = [
  { href: '/logistica/data-maestra/productos', icon: '🥐', title: 'Productos', desc: 'Productos del módulo Logística', accent: 'accent-blue' },
  { href: '/logistica/data-maestra/directorio', icon: '📚', title: 'Directorio de colegios', desc: 'Cargar directorio maestro desde Excel', accent: 'accent-cyan' },
  { href: '/logistica/data-maestra/grupos-ruteo', icon: '🗺️', title: 'Grupos de Ruteo', desc: 'Localidades, prefijos y umbrales de partición', accent: 'accent-orange' },
  { href: '/logistica/data-maestra/subzonas', icon: '📍', title: 'Subzonas', desc: 'Subzonas dentro de cada grupo de ruteo', accent: 'accent-green' },
]

function NavCard({ href, icon, title, desc, accent }) {
  return (
    <Link href={href} className={`nav-card ${accent}`}>
      <div className="nav-card-icon">{icon}</div>
      <div className="nav-card-title">{title}</div>
      <div className="nav-card-desc">{desc}</div>
    </Link>
  )
}

export default function DataMaestraPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica" backLabel="Volver" title="🗂️ Data Maestra — Logística" subtitle="Panadería y Gastronomía" />
        <div className="page-content">
          <div className="nav-grid nav-grid-centered">
            {ITEMS.map(item => <NavCard key={item.href} {...item} />)}
          </div>
        </div>
      </main>
    </div>
  )
}
