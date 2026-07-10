'use client'

import { useState } from 'react'

export default function SitioModal({ mode, initialData, onClose, onSubmit, saving }) {
  const [idSitioEntrega, setIdSitioEntrega] = useState(initialData?.id_sitio_entrega ?? '')
  const [nombreInstitucion, setNombreInstitucion] = useState(initialData?.nombre_institucion || '')
  const [sedeEducativa, setSedeEducativa] = useState(initialData?.sede_educativa || '')
  const [sitioEntrega, setSitioEntrega] = useState(initialData?.sitio_entrega || '')
  const [nombreDescripcion, setNombreDescripcion] = useState(initialData?.nombre_descripcion || '')
  const [localidad, setLocalidad] = useState(initialData?.localidad || '')
  const [barrio, setBarrio] = useState(initialData?.barrio || '')
  const [proyectoInversion, setProyectoInversion] = useState(initialData?.proyecto_inversion || '')
  const [jornada, setJornada] = useState(initialData?.jornada || '')
  const [horarioSugerido, setHorarioSugerido] = useState(initialData?.horario_sugerido || '')
  const [direccion, setDireccion] = useState(initialData?.direccion || '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const idNum = Number(idSitioEntrega)
    if (!idSitioEntrega || !Number.isInteger(idNum) || idNum <= 0) {
      setError('El ID de sitio de entrega debe ser un número entero mayor a 0')
      return
    }
    if (!nombreInstitucion.trim()) {
      setError('El nombre de la institución es obligatorio')
      return
    }
    setError('')
    onSubmit({
      id_sitio_entrega: idNum,
      nombre_institucion: nombreInstitucion.trim(),
      sede_educativa: sedeEducativa.trim() || null,
      sitio_entrega: sitioEntrega.trim() || null,
      nombre_descripcion: nombreDescripcion.trim() || null,
      localidad: localidad.trim() || null,
      barrio: barrio.trim() || null,
      proyecto_inversion: proyectoInversion.trim() || null,
      jornada: jornada.trim() || null,
      horario_sugerido: horarioSugerido.trim() || null,
      direccion: direccion.trim() || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{mode === 'edit' ? 'Editar Sitio' : 'Agregar Sitio'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>ID Sitio Entrega</label>
              <input
                type="number"
                min="1"
                value={idSitioEntrega}
                onChange={e => setIdSitioEntrega(e.target.value)}
                disabled={mode === 'edit'}
                placeholder="Ej: 25078"
              />
            </div>
            <div className="form-group">
              <label>Jornada</label>
              <input type="text" value={jornada} onChange={e => setJornada(e.target.value)} placeholder="Ej: M o T" />
            </div>
          </div>

          <div className="form-group">
            <label>Nombre Institución</label>
            <input type="text" value={nombreInstitucion} onChange={e => setNombreInstitucion(e.target.value)} placeholder="Ej: COLEGIO COMPARTIR RECUERDO (IED)" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Sede Educativa</label>
              <input type="text" value={sedeEducativa} onChange={e => setSedeEducativa(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Sitio Entrega</label>
              <input type="text" value={sitioEntrega} onChange={e => setSitioEntrega(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Nombre / Descripción</label>
            <input type="text" value={nombreDescripcion} onChange={e => setNombreDescripcion(e.target.value)} placeholder="Ej: CENT EDUC DIST EL RECUERDO" />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Localidad</label>
              <input type="text" value={localidad} onChange={e => setLocalidad(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Barrio</label>
              <input type="text" value={barrio} onChange={e => setBarrio(e.target.value)} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Proyecto de Inversión</label>
              <input type="text" value={proyectoInversion} onChange={e => setProyectoInversion(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Horario Sugerido</label>
              <input type="text" value={horarioSugerido} onChange={e => setHorarioSugerido(e.target.value)} placeholder="Ej: 10:00 a.m. a 10:40 a.m." />
            </div>
          </div>

          <div className="form-group">
            <label>Dirección</label>
            <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} />
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
