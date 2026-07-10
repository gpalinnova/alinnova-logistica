import Link from 'next/link'
import PageHeader from '../../components/PageHeader'

const DATA_MAESTRA = [
  { href: '/reforzados/productos', icon: '📦', title: 'Productos Maestro', desc: 'Catálogo de productos y empaques', accent: 'accent-blue' },
  { href: '/reforzados/menus', icon: '🍽️', title: 'Menús Maestro', desc: 'Composición de menús por ciclo', accent: 'accent-orange' },
  { href: '/reforzados/ciclos', icon: '📅', title: 'Ciclos Maestro', desc: 'Calendario de ciclos y menús', accent: 'accent-purple' },
  { href: '/reforzados/sitios', icon: '📍', title: 'Sitios Maestro', desc: 'Puntos y direcciones de entrega', accent: 'accent-green' },
  { href: '/reforzados/repartidores', icon: '🚚', title: 'Repartidores Maestro', desc: 'Conductores y rutas asignadas', accent: 'accent-yellow' },
]

const OPERACIONES_DEL_DIA = [
  { href: '/reforzados/base-suministro', icon: '📥', title: 'Base de Suministro', desc: 'Cargue de información diaria', accent: 'accent-cyan' },
  { href: '/reforzados/tabla-whatsapp', icon: '💬', title: 'Tabla WhatsApp', desc: 'Reporte diario para reparto', accent: 'accent-whatsapp' },
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
