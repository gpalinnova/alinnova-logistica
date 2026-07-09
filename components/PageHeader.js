import Link from 'next/link'

export default function PageHeader({ backHref, backLabel, title, subtitle }) {
  return (
    <div className="content-header">
      <Link href={backHref} className="breadcrumb-link">← {backLabel}</Link>
      <div className="logo-box">ALINNOVA</div>
      <div className="header-text">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}
