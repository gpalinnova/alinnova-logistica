import Link from 'next/link'
import PageHeader from './PageHeader'

export default function AreaPage({ backHref, backLabel, title, subtitle, items }) {
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref={backHref} backLabel={backLabel} title={title} subtitle={subtitle} />
        <div className="page-content">
          <div className="stub-cards">
            {items.map(item => {
              const className = `stub-card${item.accent ? ` ${item.accent}` : ''}`
              const content = (
                <>
                  <div className="stub-card-icon">{item.icon}</div>
                  <div className="stub-card-title">{item.title}</div>
                </>
              )
              return item.href ? (
                <Link key={item.title} href={item.href} className={className}>
                  {content}
                </Link>
              ) : (
                <div key={item.title} className={className}>
                  {content}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
