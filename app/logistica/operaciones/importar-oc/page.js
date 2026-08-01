import PageHeader from '../../../../components/PageHeader'

export default function ImportarOCPage() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/logistica/operaciones" backLabel="Volver" title="📥 Importar OC" subtitle="Operaciones del Día — Logística" />
        <div className="page-content">
          <div className="coming-soon-wrap">
            <div className="coming-soon-card">
              <div className="coming-soon-emoji">📥</div>
              <div className="coming-soon-title">Módulo en construcción</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
