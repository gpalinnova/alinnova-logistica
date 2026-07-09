import Link from 'next/link'

const AREAS = [
  { href: '/reforzados', icon: '🚚', title: 'Reforzados', desc: 'Distribución de refuerzos y empaques', accent: 'accent-blue' },
  { href: '/panaderia', icon: '🥐', title: 'Panadería', desc: 'Logística de línea panadería', accent: 'accent-orange' },
  { href: '/gastronomia', icon: '🍽️', title: 'Gastronomía', desc: 'Logística de línea gastronomía', accent: 'accent-green' },
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
