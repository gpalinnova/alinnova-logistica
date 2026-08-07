import { supabase } from '../../../lib/supabase'
import { todayLocalISO, formatFechaDiaMes, formatFechaLargaSinComa } from '../../../lib/tablaWhatsappUtils'
import { getRepartidoresActivosFecha } from '../../../lib/registroEntregasCalc'
import EntregasClient from '../../../components/entregas/EntregasClient'

export const dynamic = 'force-dynamic'

// Trae los repartidores activos hoy (con sus colegios) y cruza cada colegio
// con su registro de entrega del día, para poder mostrarlos ya armados sin
// que el cliente tenga que hacer una consulta adicional al elegir conductor.
async function getDatosDelDia(fecha) {
  const repartidores = await getRepartidoresActivosFecha(fecha)
  if (repartidores.length === 0) return { conductores: [], colegiosPorConductor: {} }

  const idsSitio = [...new Set(repartidores.flatMap(r => r.sitios.map(s => s.sitioId)))]

  let registrosById = new Map()
  if (idsSitio.length > 0) {
    const { data: registros } = await supabase
      .from('reforzados_entrega_registro')
      .select('*')
      .eq('fecha', fecha)
      .in('id_sitio_entrega', idsSitio)
    registrosById = new Map((registros || []).map(r => [r.id_sitio_entrega, r]))
  }

  const conductores = []
  const colegiosPorConductor = {}
  for (const r of repartidores) {
    conductores.push({ id: r.id, conductor: r.conductor, auxiliar: r.auxiliar, placa: r.placa })
    colegiosPorConductor[r.id] = r.sitios.map(s => ({ ...s, registro: registrosById.get(s.sitioId) || null }))
  }

  return { conductores, colegiosPorConductor }
}

export default async function EntregaTokenPage({ params }) {
  const { token } = await params

  const { data: configRow } = await supabase
    .from('reforzados_registro_config')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  const esValido = !!configRow && configRow.revoked_at === null

  if (!esValido) {
    return (
      <div className="entregas-public-page">
        <div className="entregas-public-card">
          <div className="rt-status-card">
            <div className="rt-status-card-emoji">⚠️</div>
            <div className="rt-status-card-text">Link no disponible</div>
          </div>
        </div>
      </div>
    )
  }

  const fecha = todayLocalISO()
  const { conductores, colegiosPorConductor } = await getDatosDelDia(fecha)

  return (
    <div className="entregas-public-page">
      <div className="entregas-public-card">
        <div className="entregas-public-header">
          <div className="logo-box">ALINNOVA</div>
          <h2>Registro de entregas</h2>
          <p>Hoy · {formatFechaDiaMes(fecha)}</p>
        </div>

        {conductores.length === 0 ? (
          <div className="registro-vacio-dia">
            <div className="registro-vacio-emoji">📭</div>
            <div className="registro-vacio-titulo">Hoy no hay entregas planeadas</div>
            <div className="registro-vacio-subtitulo">{formatFechaLargaSinComa(fecha)}</div>
            <div className="registro-vacio-nota">Este link mostrará automáticamente tus entregas el próximo día operativo.</div>
          </div>
        ) : (
          <EntregasClient
            fecha={fecha}
            conductores={conductores}
            colegiosPorConductor={colegiosPorConductor}
          />
        )}
      </div>
    </div>
  )
}
