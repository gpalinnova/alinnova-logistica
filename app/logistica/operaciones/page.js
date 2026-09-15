import Link from 'next/link'
import PageHeader from '../../../components/PageHeader'

const ITEMS = [
  { href: '/logistica/operaciones/panaderia', icon: '🥖', title: 'Panadería', desc: 'Cargar OC, armar rutas y generar rutero + remisiones', accent: 'accent-cyan' },
  { href: '/logistica/operaciones/gastronomia', icon: '🍽️', title: 'Gastronomía', desc: 'Cargar OC, armar rutas y generar rutero + remisiones', accent: 'accent-orange' },
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

export default function OperacionesPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica" backLabel="Volver" title="📅 Operaciones del Día — Logística" subtitle="Panadería y Gastronomía" />
        <div className="page-content">
          <div className="nav-grid nav-grid-centered">
            {ITEMS.map(item => <NavCard key={item.href} {...item} />)}
          </div>
        </div>
      </main>
    </div>
  )
}
