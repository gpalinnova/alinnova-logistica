import PageHeader from '../../components/PageHeader'

export default function LogisticaPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/" backLabel="Volver al inicio" title="🚚 Logística Alinnova" subtitle="Módulo en construcción" />
        <div className="page-content">
          <div className="coming-soon-wrap">
            <div className="coming-soon-card">
              <div className="coming-soon-emoji">🚚</div>
              <div className="coming-soon-title">Logística Alinnova</div>
              <p className="coming-soon-text">Próximamente encontrarás aquí la gestión unificada de las líneas de Panadería y Gastronomía.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
