'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

// colegiosFaltantes: [{ punto, institucion, sitioEntrega, localidad }]
// onSaved(rows): rows tal como quedaron en logistica_sitios (con id, activo, creado_en, etc.)
export default function LogisticaDirectorioModal({ colegiosFaltantes, onClose, onSaved }) {
  const [filas, setFilas] = useState(() => colegiosFaltantes.map(c => ({
    punto: c.punto,
    institucion: c.institucion || '',
    sitioEntrega: c.sitioEntrega || c.institucion || '',
    localidad: c.localidad || '',
    direccion: '',
  })))
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function updateFila(punto, patch) {
    setFilas(prev => prev.map(f => f.punto === punto ? { ...f, ...patch } : f))
  }

  async function handleGuardar() {
    const faltanDireccion = filas.some(f => !f.direccion.trim())
    if (faltanDireccion) {
      setIntentoGuardar(true)
      return
    }

    setGuardando(true)
    setError('')
    try {
      const rows = filas.map(f => ({
        punto_wms: parseInt(f.punto, 10),
        nombre_institucion: f.institucion.trim(),
        nombre_sitio: f.sitioEntrega.trim(),
        localidad: f.localidad.trim() || 'SIN LOCALIDAD',
        direccion: f.direccion.trim(),
      }))
      const { data, error: insertError } = await supabase.from('logistica_sitios').insert(rows).select()
      if (insertError) throw insertError
      onSaved(data || [])
    } catch (err) {
      setError(err.code === '23505' ? 'Alguno de estos colegios ya existe en el directorio (Punto WMS duplicado).' : (err.message || 'No se pudo guardar el directorio.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={guardando ? undefined : onClose}>
      <div className="modal-box modal-box-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Registrar colegios faltantes en el directorio</div>

        <p className="modal-hint">
          {filas.length} colegio(s) de esta OC no están en el directorio (<span className="logistica-mono">logistica_sitios</span>). Completa la dirección de cada uno para poder generar sus remisiones y ruteros correctamente.
        </p>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Punto WMS</th>
                <th>Institución</th>
                <th>Sitio de entrega</th>
                <th>Localidad</th>
                <th>Dirección *</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const direccionInvalida = intentoGuardar && !f.direccion.trim()
                return (
                  <tr key={f.punto}>
                    <td className="logistica-mono logistica-muted">{f.punto}</td>
                    <td>
                      <input type="text" value={f.institucion} onChange={e => updateFila(f.punto, { institucion: e.target.value })} disabled={guardando} />
                    </td>
                    <td>
                      <input type="text" value={f.sitioEntrega} onChange={e => updateFila(f.punto, { sitioEntrega: e.target.value })} disabled={guardando} />
                    </td>
                    <td>
                      <input type="text" value={f.localidad} onChange={e => updateFila(f.punto, { localidad: e.target.value })} disabled={guardando} />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={f.direccion}
                        placeholder="Obligatoria"
                        onChange={e => updateFila(f.punto, { direccion: e.target.value })}
                        disabled={guardando}
                        className={direccionInvalida ? 'input-error' : ''}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {intentoGuardar && filas.some(f => !f.direccion.trim()) && (
          <p className="modal-error">Completa la dirección de todos los colegios (marcados en rojo) antes de guardar.</p>
        )}
        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando...' : `Guardar ${filas.length} colegio${filas.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
