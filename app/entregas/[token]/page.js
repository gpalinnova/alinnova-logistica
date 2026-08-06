import { supabase } from '../../../lib/supabase'
import { todayLocalISO, formatFechaDiaMes } from '../../../lib/tablaWhatsappUtils'

export const dynamic = 'force-dynamic'

export default async function EntregaTokenPage({ params }) {
  const { token } = await params

  const { data: tokenRow } = await supabase
    .from('reforzados_registro_token')
    .select('*, repartidor:reforzados_repartidores(conductor, auxiliar, placa)')
    .eq('token', token)
    .maybeSingle()

  const esValido = tokenRow && tokenRow.fecha >= todayLocalISO()

  if (!esValido) {
    return (
      <div className="entregas-public-page">
        <div className="entregas-public-card">
          <div className="rt-status-card">
            <div className="rt-status-card-emoji">⚠️</div>
            <div className="rt-status-card-text">Link no válido o expirado</div>
          </div>
        </div>
      </div>
    )
  }

  const { repartidor } = tokenRow

  return (
    <div className="entregas-public-page">
      <div className="entregas-public-card">
        <div className="entregas-public-header">
          <div className="logo-box">ALINNOVA</div>
          <h2>Registro de entregas</h2>
          <p>{formatFechaDiaMes(tokenRow.fecha)}</p>
        </div>

        <div className="entregas-public-meta">
          <div><strong>Conductor:</strong> {repartidor?.conductor || '-'}</div>
          <div><strong>Placa:</strong> {repartidor?.placa || '-'}</div>
          {repartidor?.auxiliar && <div><strong>Auxiliar:</strong> {repartidor.auxiliar}</div>}
        </div>

        <div className="empty-state">
          <p>Aquí va la lista de colegios de la ruta (Fase 2)</p>
        </div>
      </div>
    </div>
  )
}
