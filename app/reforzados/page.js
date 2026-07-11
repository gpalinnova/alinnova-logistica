import Link from 'next/link'
import PageHeader from '../../components/PageHeader'

const DATA_MAESTRA = [
  { href: '/reforzados/productos', icon: '📦', title: 'Productos', desc: 'Productos y embalaje', accent: 'accent-blue' },
  { href: '/reforzados/menus', icon: '🍽️', title: 'Menús', desc: 'Menús', accent: 'accent-orange' },
  { href: '/reforzados/ciclos', icon: '📅', title: 'Ciclos', desc: 'Ciclos mensuales', accent: 'accent-purple' },
  { href: '/reforzados/sitios', icon: '📍', title: 'Sitios', desc: 'ID sitios entrega', accent: 'accent-green' },
  { href: '/reforzados/rutas', icon: '🚚', title: 'Rutas', desc: 'Rutas', accent: 'accent-yellow' },
  { href: '/reforzados/base-suministro', icon: '📥', title: 'Base de Suministro', desc: 'Cargue diario de cantidades por sitio', accent: 'accent-cyan' },
]

const OPERACIONES_DEL_DIA = [
  { href: '/reforzados/envio-dia', icon: '📤', title: 'Envío del Día', desc: 'Reporte diario para grupos', accent: 'accent-whatsapp' },
  { href: '/reforzados/remisiones', icon: '📄', title: 'Remisiones', desc: 'PDF diario de remisiones por sitio', accent: 'accent-darkgreen' },
  { href: '/reforzados/rutero', icon: '📋', title: 'Rutero', desc: 'PDF de cargue por conductor', accent: 'accent-orange' },
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

export default function ReforzadosPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/" backLabel="Inicio" title="Reforzados" subtitle="Control Logística" />
        <div className="page-content">
          <div className="section-label">📊 Data Maestra</div>
          <div className="nav-grid">
            {DATA_MAESTRA.map(item => <NavCard key={item.href} {...item} />)}
          </div>

          <div className="section-label">⚙️ Operaciones del Día</div>
          <div className="nav-grid">
            {OPERACIONES_DEL_DIA.map(item => <NavCard key={item.href} {...item} />)}
          </div>
        </div>
      </main>
    </div>
  )
}
