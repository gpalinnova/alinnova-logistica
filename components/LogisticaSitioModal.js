'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LogisticaSitioModal({ open, onClose, onSaved, sitio, localidadesDisponibles }) {
  const isEdit = Boolean(sitio)
  const [puntoWms, setPuntoWms] = useState(sitio?.punto_wms ?? '')
  const [nombreInstitucion, setNombreInstitucion] = useState(sitio?.nombre_institucion || '')
  const [nombreSitio, setNombreSitio] = useState(sitio?.nombre_sitio || '')
  const [localidad, setLocalidad] = useState(sitio?.localidad || '')
  const [direccion, setDireccion] = useState(sitio?.direccion || '')
  const [sedeEducativa, setSedeEducativa] = useState(sitio?.sede_educativa || '')
  const [activo, setActivo] = useState(sitio?.activo ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const opcionesLocalidad = localidadesDisponibles.includes('SIN LOCALIDAD')
    ? localidadesDisponibles
    : [...localidadesDisponibles, 'SIN LOCALIDAD']

  async function handleSubmit(e) {
    e.preventDefault()
    const puntoNum = Number(puntoWms)
    if (!puntoWms || !Number.isInteger(puntoNum) || puntoNum <= 0) {
      setError('El Punto WMS debe ser un número entero mayor a 0')
      return
    }
    if (!nombreInstitucion.trim()) {
      setError('El nombre de la institución es obligatorio')
      return
    }
    if (!localidad.trim()) {
      setError('La localidad es obligatoria')
      return
    }

    setSaving(true)
    setError('')
    try {
      let query = supabase.from('logistica_sitios').select('id').eq('punto_wms', puntoNum)
      if (isEdit) query = query.neq('id', sitio.id)
      const { data: existentes, error: checkError } = await query
      if (checkError) throw checkError
      if (existentes && existentes.length > 0) {
        setError('Ya existe un sitio con ese Punto WMS')
        setSaving(false)
        return
      }

      const payload = {
        punto_wms: puntoNum,
        nombre_institucion: nombreInstitucion.trim(),
        nombre_sitio: nombreSitio.trim() || null,
        localidad: localidad.trim().toUpperCase(),
        direccion: direccion.trim() || null,
        sede_educativa: sedeEducativa.trim() || null,
        activo,
      }

      if (isEdit) {
        const { error: updError } = await supabase.from('logistica_sitios').update(payload).eq('id', sitio.id)
        if (updError) throw updError
      } else {
        const { error: insError } = await supabase.from('logistica_sitios').insert([payload])
        if (insError) throw insError
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err.code === '23505' ? 'Ya existe un sitio con ese Punto WMS' : 'No se pudo guardar el sitio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Editar Sitio' : 'Nuevo Sitio'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Punto WMS</label>
              <input
                type="number"
                min="1"
                value={puntoWms}
                onChange={e => setPuntoWms(e.target.value)}
                disabled={isEdit}
                placeholder="Ej: 25078"
              />
            </div>
            <div className="form-group">
              <label>Localidad</label>
              <input
                type="text"
                list="logistica-localidades-datalist"
                value={localidad}
                onChange={e => setLocalidad(e.target.value)}
                placeholder="Ej: BOSA"
              />
              <datalist id="logistica-localidades-datalist">
                {opcionesLocalidad.map(loc => <option key={loc} value={loc} />)}
              </datalist>
            </div>
          </div>

          <div className="form-group">
            <label>Nombre institución</label>
            <input type="text" value={nombreInstitucion} onChange={e => setNombreInstitucion(e.target.value)} placeholder="Ej: COLEGIO COMPARTIR RECUERDO (IED)" />
          </div>

          <div className="form-group">
            <label>Nombre sitio</label>
            <input type="text" value={nombreSitio} onChange={e => setNombreSitio(e.target.value)} />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Dirección</label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Sede educativa</label>
              <input type="text" value={sedeEducativa} onChange={e => setSedeEducativa(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
              Activo
            </label>
          </div>

          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
