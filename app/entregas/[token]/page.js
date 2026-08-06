import { supabase } from '../../../lib/supabase'
import { todayLocalISO, formatFechaDiaMes } from '../../../lib/tablaWhatsappUtils'
import ListaColegios from '../../../components/entregas/ListaColegios'
import ResumenDiaButton from '../../../components/entregas/ResumenDiaButton'

export const dynamic = 'force-dynamic'

// Mismo cruce que usa el Rutero (lib/ruteroCalc.js buildRuteroConductores):
// ruta_mes activa -> asignaciones del repartidor -> filtro por base de
// suministro del día (total > 0) -> datos de reforzados_sitios. Ordenado
// por orden_entrega asc, igual que el Rutero.
async function getColegiosDelDia(repartidorId, fecha) {
  const { data: rutaMesActiva } = await supabase
    .from('reforzados_rutas_mes')
    .select('id')
    .eq('estado', 'activo')
    .maybeSingle()

  if (!rutaMesActiva) return []

  const [{ data: asignaciones }, { data: baseRows }, { data: sitiosData }] = await Promise.all([
    supabase
      .from('reforzados_ruta_asignaciones')
      .select('*')
      .eq('ruta_mes_id', rutaMesActiva.id)
      .eq('repartidor_id', repartidorId),
    supabase
      .from('reforzados_base_suministro')
      .select('id_sitio_entrega, total')
      .eq('fecha', fecha)
      .gt('total', 0),
    supabase.from('reforzados_sitios').select('*'),
  ])

  const baseByIdSitio = new Map((baseRows || []).map(b => [b.id_sitio_entrega, b]))
  const sitiosById = new Map((sitiosData || []).map(s => [s.id_sitio_entrega, s]))

  const filas = []
  for (const a of asignaciones || []) {
    const base = baseByIdSitio.get(a.id_sitio_entrega)
    if (!base || !base.total) continue
    const sitio = sitiosById.get(a.id_sitio_entrega)
    if (!sitio) continue
    filas.push({
      idSitioEntrega: a.id_sitio_entrega,
      sitioId: sitio.id,
      orden: a.orden_entrega,
      nombreInstitucion: sitio.nombre_institucion,
      direccion: sitio.direccion,
      localidad: sitio.localidad,
    })
  }
  filas.sort((a, b) => a.orden - b.orden)

  if (filas.length === 0) return []

  const { data: registros } = await supabase
    .from('reforzados_entrega_registro')
    .select('*')
    .eq('fecha', fecha)
    .in('id_sitio_entrega', filas.map(f => f.sitioId))

  const registrosById = new Map((registros || []).map(r => [r.id_sitio_entrega, r]))

  return filas.map(f => ({ ...f, registro: registrosById.get(f.sitioId) || null }))
}

export default async function EntregaTokenPage({ params }) {
  const { token } = await params

  const { data: tokenRow } = await supabase
    .from('reforzados_registro_token')
    .select('*, repartidor:reforzados_repartidores(id, conductor, auxiliar, placa)')
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

  const { repartidor, fecha } = tokenRow
  const colegios = await getColegiosDelDia(repartidor.id, fecha)
  const totalColegios = colegios.length
  const entregados = colegios.filter(c => c.registro).length
  const rutaCompletada = totalColegios > 0 && entregados === totalColegios
  const progresoPct = totalColegios > 0 ? Math.round((entregados / totalColegios) * 100) : 0

  return (
    <div className="entregas-public-page">
      <div className="entregas-public-card">
        <div className="entregas-public-header">
          <div className="logo-box">ALINNOVA</div>
          <h2>Registro de entregas</h2>
          <p>{formatFechaDiaMes(fecha)}</p>
        </div>

        <div className="entregas-public-meta">
          <div><strong>Conductor:</strong> {repartidor?.conductor || '-'}</div>
          <div><strong>Placa:</strong> {repartidor?.placa || '-'}</div>
          {repartidor?.auxiliar && <div><strong>Auxiliar:</strong> {repartidor.auxiliar}</div>}
        </div>

        {totalColegios === 0 ? (
          <div className="empty-state"><p>No hay colegios asignados con envío para esta fecha.</p></div>
        ) : (
          <>
            <div className="entregas-progreso">
              <div className="entregas-progreso-texto">{entregados} de {totalColegios} entregados</div>
              <div className="entregas-progreso-bar">
                <div className="entregas-progreso-bar-fill" style={{ width: `${progresoPct}%` }} />
              </div>
            </div>

            <ListaColegios
              colegios={colegios}
              fecha={fecha}
              idRuta={repartidor.id}
              nombreConductor={repartidor.conductor}
            />

            {rutaCompletada && (
              <div className="entregas-completada">
                <div className="entregas-completada-emoji">🎉</div>
                <div className="entregas-completada-texto">Ruta completada</div>
                <ResumenDiaButton colegios={colegios} conductor={repartidor.conductor} fecha={fecha} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
