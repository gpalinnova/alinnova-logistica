import Link from 'next/link'
import PageHeader from '../../components/PageHeader'

export default function ReforzadosPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/" backLabel="Inicio" title="Reforzados" subtitle="Control Logística" />
        <div className="page-content">
          <Link href="/reforzados/tabla-whatsapp" className="feature-card-single accent-whatsapp">
            <div className="feature-card-single-icon">💬</div>
            <div className="feature-card-single-title">Tabla WhatsApp</div>
          </Link>
        </div>
      </main>
    </div>
  )
}
