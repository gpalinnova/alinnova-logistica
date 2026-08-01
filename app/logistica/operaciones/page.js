import Link from 'next/link'
import PageHeader from '../../../components/PageHeader'

const ITEMS = [
  { href: '/logistica/operaciones/importar-oc', icon: '📥', title: 'Importar OC', desc: 'Cargue de órdenes de compra', accent: 'accent-cyan' },
  { href: '/logistica/operaciones/reprogramacion', icon: '📆', title: 'Reprogramación de fechas', desc: 'Ajuste de fechas de entrega', accent: 'accent-orange' },
  { href: '/logistica/operaciones/ruteo', icon: '🗺️', title: 'Ruteo del día', desc: 'Asignación de rutas por sitio', accent: 'accent-purple' },
  { href: '/logistica/operaciones/remisiones', icon: '📄', title: 'Remisiones', desc: 'PDF de remisiones por sitio', accent: 'accent-darkgreen' },
  { href: '/logistica/operaciones/ruteros', icon: '📋', title: 'Ruteros', desc: 'PDF de cargue por conductor', accent: 'accent-yellow' },
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
          <div className="nav-grid">
            {ITEMS.map(item => <NavCard key={item.href} {...item} />)}
          </div>
        </div>
      </main>
    </div>
  )
}
