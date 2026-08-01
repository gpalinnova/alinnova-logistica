import Link from 'next/link'
import PageHeader from '../../components/PageHeader'

const SECCIONES = [
  { href: '/logistica/data-maestra', icon: '🗂️', title: 'Data Maestra', desc: 'Productos, sitios y rutas del módulo', accent: 'accent-indigo' },
  { href: '/logistica/operaciones', icon: '📅', title: 'Operaciones del Día', desc: 'Importar OC, ruteo, remisiones y ruteros', accent: 'accent-indigo' },
]

export default function LogisticaPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/" backLabel="Volver al inicio" title="🚚 Logística Alinnova" subtitle="Panadería y Gastronomía" />
        <div className="page-content">
          <div className="home-cards">
            {SECCIONES.map(item => (
              <Link key={item.href} href={item.href} className={`home-card ${item.accent}`}>
                <div className="home-card-icon">{item.icon}</div>
                <div className="home-card-title">{item.title}</div>
                <div className="home-card-desc">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
