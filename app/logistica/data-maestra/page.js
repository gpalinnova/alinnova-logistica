import Link from 'next/link'
import PageHeader from '../../../components/PageHeader'

const ITEMS = [
  { href: '/logistica/data-maestra/productos', icon: '🥐', title: 'Productos', desc: 'Productos del módulo Logística', accent: 'accent-blue' },
  { href: '/logistica/data-maestra/sitios', icon: '🏫', title: 'Sitios', desc: 'Sitios de entrega', accent: 'accent-green' },
  { href: '/logistica/data-maestra/rutas', icon: '🛣️', title: 'Rutas', desc: 'Rutas de reparto', accent: 'accent-yellow' },
  { href: '/logistica/data-maestra/importar-asignaciones', icon: '🎯', title: 'Importar asignaciones', desc: 'Sembrar asignación sitio-ruta desde el mapa base', accent: 'accent-purple' },
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
          <div className="nav-grid">
            {ITEMS.map(item => <NavCard key={item.href} {...item} />)}
          </div>
        </div>
      </main>
    </div>
  )
}
