import PageHeader from '../../../../components/PageHeader'

export default function ProductosPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica/data-maestra" backLabel="Volver" title="🥐 Productos" subtitle="Data Maestra — Logística" />
        <div className="page-content">
          <div className="coming-soon-wrap">
            <div className="coming-soon-card">
              <div className="coming-soon-emoji">🥐</div>
              <div className="coming-soon-title">Módulo en construcción</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
