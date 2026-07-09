import PageHeader from './PageHeader'

export default function ComingSoon({ backHref, backLabel, title, subtitle }) {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref={backHref} backLabel={backLabel} title={title} subtitle={subtitle} />
        <div className="page-content">
          <div className="coming-soon-wrap">
            <div className="coming-soon-card">
              <div className="coming-soon-emoji">🚧</div>
              <div className="coming-soon-title">Próximamente</div>
              <p className="coming-soon-text">Esta sección estará disponible pronto</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
