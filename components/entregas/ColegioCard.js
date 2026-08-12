'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEntregaAction } from '../../lib/entregasActions'
import { buildMensajeWhatsappEntrega } from '../../lib/entregasMensaje'
import { enviarPorWhatsApp } from '../../lib/whatsappShare'

const CAMPOS_OBLIGATORIOS = [
  ['hora_llegada', 'Este campo es obligatorio.'],
  ['temperatura_llegada', 'Este campo es obligatorio.'],
  ['hora_recibido', 'Este campo es obligatorio.'],
  ['hora_salida', 'Este campo es obligatorio.'],
  ['quien_recibe', 'Este campo es obligatorio.'],
  ['cargo_recibe', 'Este campo es obligatorio.'],
  ['canastillas_presentan', 'Este campo es obligatorio.'],
  ['canastillas_retiran', 'Este campo es obligatorio.'],
]

function validarFormData(formData) {
  const errores = {}
  for (const [name, mensaje] of CAMPOS_OBLIGATORIOS) {
    const valor = formData.get(name)
    if (valor === null || String(valor).trim() === '') {
      errores[name] = mensaje
    }
  }
  return errores
}

function RequiredMark() {
  return <span className="entregas-form-required">*</span>
}

function FieldError({ mensaje }) {
  if (!mensaje) return null
  return <div className="entregas-form-field-error">{mensaje}</div>
}

function ToggleSiNo({ name, initial, onChange }) {
  const [value, setValue] = useState(initial)
  function set(v) {
    setValue(v)
    onChange?.(v)
  }
  return (
    <div className="entregas-toggle">
      <input type="hidden" name={name} value={value ? 'true' : 'false'} />
      <button
        type="button"
        className={`entregas-toggle-btn ${value ? 'entregas-toggle-btn-active' : ''}`}
        onClick={() => set(true)}
      >
        Sí
      </button>
      <button
        type="button"
        className={`entregas-toggle-btn ${!value ? 'entregas-toggle-btn-active' : ''}`}
        onClick={() => set(false)}
      >
        No
      </button>
    </div>
  )
}

function horaInputValue(hora) {
  return hora ? hora.slice(0, 5) : ''
}

function temperaturaInputValue(registro) {
  if (!registro) return ''
  if (registro.temperatura_producto) {
    return `${registro.temperatura_transporte || ''} / ${registro.temperatura_producto}`
  }
  return registro.temperatura_transporte || ''
}

export default function ColegioCard({ colegio, fecha, idRuta, nombreConductor, isOpen, onToggle }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [sedeSeleccionada, setSedeSeleccionada] = useState('')
  const [interventoria, setInterventoria] = useState(colegio.registro ? colegio.registro.interventoria : false)
  const [nombreInterventora, setNombreInterventora] = useState('')
  const registro = colegio.registro
  const entregado = colegio.entregado
  const groupId = colegio.sitioIds.join('-')
  const esUnificada = colegio.sitioIds.length > 1

  const registrosDelGrupo = (colegio.registros || []).filter(Boolean)
  const inconsistente = esUnificada && registrosDelGrupo.length > 1 && registrosDelGrupo.some(r => (
    r.hora_llegada !== registrosDelGrupo[0].hora_llegada ||
    r.hora_recibido !== registrosDelGrupo[0].hora_recibido ||
    r.hora_salida !== registrosDelGrupo[0].hora_salida ||
    r.quien_recibe !== registrosDelGrupo[0].quien_recibe
  ))

  function handleInterventoriaChange(value) {
    setInterventoria(value)
    if (!value) setNombreInterventora('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    const accion = e.nativeEvent.submitter?.value || 'guardar'
    const formData = new FormData(e.currentTarget)

    const errores = validarFormData(formData)
    if (!sedeSeleccionada) {
      errores.sede = 'Este campo es obligatorio.'
    }
    if (interventoria && !nombreInterventora.trim()) {
      errores.nombre_interventora = 'Este campo es obligatorio.'
    }
    if (Object.keys(errores).length > 0) {
      setFieldErrors(errores)
      return
    }
    setFieldErrors({})

    formData.set('fecha', fecha)
    formData.set('id_ruta', idRuta)
    formData.set('ids_sitios', JSON.stringify(colegio.sitioIds))

    setSaving(true)
    try {
      const payload = await guardarEntregaAction(formData)
      if (accion === 'guardar_whatsapp') {
        const mensaje = buildMensajeWhatsappEntrega({ conductor: nombreConductor, colegio, valores: payload })
        await enviarPorWhatsApp(mensaje)
      }
      router.refresh()
      onToggle()
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo guardar el registro. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`entregas-card ${entregado ? 'entregas-card-entregado' : ''}`}>
      <div className="entregas-card-nombre-row">
        <div className="entregas-card-nombre">{colegio.nombreInstitucion}</div>
        {colegio.turno && <span className="entregas-turno-chip">Turno {colegio.turno}</span>}
      </div>
      {colegio.horarioEsperado && (
        <div className="entregas-card-horario">🕐 Horario esperado: {colegio.horarioEsperado}</div>
      )}
      <div className="entregas-card-meta">
        {colegio.idsSitioEntrega.length > 1 ? 'Ids' : 'Id'} {colegio.idsSitioEntrega.join(', ')} · {colegio.direccion || '-'} · {colegio.localidad || '-'}
      </div>

      <div className="entregas-card-footer">
        <span className={`entregas-card-estado ${entregado ? 'entregas-card-estado-ok' : ''}`}>
          {entregado ? '✅ Entregado' : 'Pendiente'}
        </span>
        <button type="button" className="btn-primary entregas-card-btn" onClick={onToggle}>
          {isOpen ? '✕ Cerrar' : entregado ? '✏️ Editar' : '📝 Registrar entrega'}
        </button>
      </div>

      {isOpen && (
        <form className="entregas-form" onSubmit={handleSubmit} noValidate>
          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}
          {inconsistente && (
            <div className="form-error-banner">
              ⚠️ Los registros de este grupo no coinciden exactamente entre sí. Se precargaron los datos del primero.
            </div>
          )}

          <div className="form-group">
            <label htmlFor={`sede-${groupId}`}>🏢 Sede <RequiredMark /></label>
            <select
              id={`sede-${groupId}`}
              value={sedeSeleccionada}
              onChange={e => setSedeSeleccionada(e.target.value)}
            >
              <option value="">Selecciona…</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <FieldError mensaje={fieldErrors.sede} />
          </div>

          <div className="form-group">
            <label htmlFor={`llegada-${groupId}`}>⏰ Hora de llegada <RequiredMark /></label>
            <input
              id={`llegada-${groupId}`}
              type="time"
              name="hora_llegada"
              step="300"
              defaultValue={horaInputValue(registro?.hora_llegada)}
            />
            <FieldError mensaje={fieldErrors.hora_llegada} />
          </div>

          <div className="form-group">
            <label htmlFor={`temp-${groupId}`}>🌡️ Temperatura de llegada <RequiredMark /></label>
            <input
              id={`temp-${groupId}`}
              type="text"
              name="temperatura_llegada"
              defaultValue={temperaturaInputValue(registro)}
              placeholder="1.5 / 2.1"
            />
            <FieldError mensaje={fieldErrors.temperatura_llegada} />
          </div>

          <div className="form-group">
            <label htmlFor={`recibido-${groupId}`}>⏰ Hora de recibido <RequiredMark /></label>
            <input
              id={`recibido-${groupId}`}
              type="time"
              name="hora_recibido"
              step="300"
              defaultValue={horaInputValue(registro?.hora_recibido)}
            />
            <FieldError mensaje={fieldErrors.hora_recibido} />
          </div>

          <div className="form-group">
            <label htmlFor={`salida-${groupId}`}>⏰ Hora de salida <RequiredMark /></label>
            <input
              id={`salida-${groupId}`}
              type="time"
              name="hora_salida"
              step="300"
              defaultValue={horaInputValue(registro?.hora_salida)}
            />
            <FieldError mensaje={fieldErrors.hora_salida} />
          </div>

          <div className="form-group">
            <label htmlFor={`quien-${groupId}`}>👤 Nombre de quien recibe <RequiredMark /></label>
            <input
              id={`quien-${groupId}`}
              type="text"
              name="quien_recibe"
              defaultValue={registro?.quien_recibe || ''}
            />
            <FieldError mensaje={fieldErrors.quien_recibe} />
          </div>

          <div className="form-group">
            <label htmlFor={`cargo-${groupId}`}>💼 Cargo <RequiredMark /></label>
            <input
              id={`cargo-${groupId}`}
              type="text"
              name="cargo_recibe"
              defaultValue={registro?.cargo_recibe || ''}
              placeholder="ej. Coordinador, Docente"
            />
            <FieldError mensaje={fieldErrors.cargo_recibe} />
          </div>

          <div className="form-group">
            <label>✍️ Firma planillas <RequiredMark /></label>
            <ToggleSiNo name="firma_planillas" initial={registro ? registro.firma_planillas : true} />
          </div>

          <div className="form-group">
            <label>🔍 Interventoría <RequiredMark /></label>
            <ToggleSiNo
              name="interventoria"
              initial={registro ? registro.interventoria : false}
              onChange={handleInterventoriaChange}
            />
          </div>

          {interventoria && (
            <div className="form-group">
              <label htmlFor={`interventora-${groupId}`}>📋 Nombre de la interventora <RequiredMark /></label>
              <input
                id={`interventora-${groupId}`}
                type="text"
                value={nombreInterventora}
                onChange={e => setNombreInterventora(e.target.value)}
              />
              <FieldError mensaje={fieldErrors.nombre_interventora} />
            </div>
          )}

          <div className="form-group">
            <label htmlFor={`metodo-${groupId}`}>📊 Método de conteo <RequiredMark /></label>
            <select id={`metodo-${groupId}`} name="metodo_conteo" defaultValue={registro?.metodo_conteo || 'aleatorio'}>
              <option value="aleatorio">Aleatorio</option>
              <option value="uno_a_uno">Uno a uno</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor={`presentan-${groupId}`}>🧺 Canastillas que se presentan <RequiredMark /></label>
            <input
              id={`presentan-${groupId}`}
              type="number"
              name="canastillas_presentan"
              defaultValue={registro?.canastillas_presentan ?? ''}
              min="0"
            />
            <FieldError mensaje={fieldErrors.canastillas_presentan} />
          </div>

          <div className="form-group">
            <label htmlFor={`retiran-${groupId}`}>🧺 Canastillas que se retiran <RequiredMark /></label>
            <input
              id={`retiran-${groupId}`}
              type="number"
              name="canastillas_retiran"
              defaultValue={registro?.canastillas_retiran ?? ''}
              min="0"
            />
            <FieldError mensaje={fieldErrors.canastillas_retiran} />
          </div>

          <div className="form-group">
            <label htmlFor={`obs-${groupId}`}>📝 Observaciones</label>
            <textarea
              id={`obs-${groupId}`}
              name="observacion"
              defaultValue={registro?.observacion || ''}
              rows={3}
            />
          </div>

          <div className="entregas-form-actions">
            <button type="button" className="btn-secondary entregas-form-btn" onClick={onToggle} disabled={saving}>
              ← Volver
            </button>
            <button type="submit" name="accion" value="guardar" className="btn-primary entregas-form-btn" disabled={saving}>
              {saving ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
          <button
            type="submit"
            name="accion"
            value="guardar_whatsapp"
            className="btn-whatsapp entregas-form-btn-wide"
            disabled={saving}
          >
            📤 Guardar y enviar a WhatsApp
          </button>
        </form>
      )}
    </div>
  )
}
