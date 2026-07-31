import Link from 'next/link'

const AREAS = [
  { href: '/reforzados', icon: '🚚', title: 'Reforzados', desc: 'Refrigerios reforzados', accent: 'accent-green' },
  { href: '/logistica', icon: '🚚', title: 'Logística Alinnova', desc: 'Logística de línea Panadería y Gastronomía', accent: 'accent-indigo' },
]

export default function Home() {
  return (
    <div className="app-layout">
      <div className="home-screen">
        <div className="home-header">
          <div className="home-logo-pill">ALINNOVA</div>
          <h1 className="home-title">Control Logística</h1>
          <p className="home-subtitle">Selecciona un área para continuar</p>
        </div>
        <div className="home-cards">
          {AREAS.map(area => (
            <Link key={area.href} href={area.href} className={`home-card ${area.accent}`}>
              <div className="home-card-icon">{area.icon}</div>
              <div className="home-card-title">{area.title}</div>
              <div className="home-card-desc">{area.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
