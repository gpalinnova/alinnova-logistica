'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEntregaAction } from '../../lib/entregasActions'
import { buildMensajeWhatsappEntrega } from '../../lib/entregasMensaje'

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

function ToggleSiNo({ name, initial }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="entregas-toggle">
      <input type="hidden" name={name} value={value ? 'true' : 'false'} />
      <button
        type="button"
        className={`entregas-toggle-btn ${value ? 'entregas-toggle-btn-active' : ''}`}
        onClick={() => setValue(true)}
      >
        Sí
      </button>
      <button
        type="button"
        className={`entregas-toggle-btn ${!value ? 'entregas-toggle-btn-active' : ''}`}
        onClick={() => setValue(false)}
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
  const registro = colegio.registro
  const entregado = !!registro

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    const accion = e.nativeEvent.submitter?.value || 'guardar'
    const formData = new FormData(e.currentTarget)

    const errores = validarFormData(formData)
    if (Object.keys(errores).length > 0) {
      setFieldErrors(errores)
      return
    }
    setFieldErrors({})

    formData.set('fecha', fecha)
    formData.set('id_ruta', idRuta)
    formData.set('id_sitio_entrega', colegio.sitioId)

    setSaving(true)
    try {
      const payload = await guardarEntregaAction(formData)
      if (accion === 'guardar_whatsapp') {
        const mensaje = buildMensajeWhatsappEntrega({ conductor: nombreConductor, colegio, valores: payload })
        window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank')
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
      <div className="entregas-card-nombre">{colegio.nombreInstitucion}</div>
      <div className="entregas-card-meta">
        Id {colegio.idSitioEntrega} · {colegio.direccion || '-'} · {colegio.localidad || '-'}
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

          <div className="form-group">
            <label htmlFor={`llegada-${colegio.sitioId}`}>⏰ Hora de llegada <RequiredMark /></label>
            <input
              id={`llegada-${colegio.sitioId}`}
              type="time"
              name="hora_llegada"
              defaultValue={horaInputValue(registro?.hora_llegada)}
            />
            <FieldError mensaje={fieldErrors.hora_llegada} />
          </div>

          <div className="form-group">
            <label htmlFor={`temp-${colegio.sitioId}`}>🌡️ Temperatura de llegada <RequiredMark /></label>
            <input
              id={`temp-${colegio.sitioId}`}
              type="text"
              name="temperatura_llegada"
              defaultValue={temperaturaInputValue(registro)}
              placeholder="1.5 / 2.1"
            />
            <FieldError mensaje={fieldErrors.temperatura_llegada} />
          </div>

          <div className="form-group">
            <label htmlFor={`recibido-${colegio.sitioId}`}>⏰ Hora de recibido <RequiredMark /></label>
            <input
              id={`recibido-${colegio.sitioId}`}
              type="time"
              name="hora_recibido"
              defaultValue={horaInputValue(registro?.hora_recibido)}
            />
            <FieldError mensaje={fieldErrors.hora_recibido} />
          </div>

          <div className="form-group">
            <label htmlFor={`salida-${colegio.sitioId}`}>⏰ Hora de salida <RequiredMark /></label>
            <input
              id={`salida-${colegio.sitioId}`}
              type="time"
              name="hora_salida"
              defaultValue={horaInputValue(registro?.hora_salida)}
            />
            <FieldError mensaje={fieldErrors.hora_salida} />
          </div>

          <div className="form-group">
            <label htmlFor={`quien-${colegio.sitioId}`}>👤 Nombre de quien recibe <RequiredMark /></label>
            <input
              id={`quien-${colegio.sitioId}`}
              type="text"
              name="quien_recibe"
              defaultValue={registro?.quien_recibe || ''}
            />
            <FieldError mensaje={fieldErrors.quien_recibe} />
          </div>

          <div className="form-group">
            <label htmlFor={`cargo-${colegio.sitioId}`}>💼 Cargo <RequiredMark /></label>
            <input
              id={`cargo-${colegio.sitioId}`}
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
            <ToggleSiNo name="interventoria" initial={registro ? registro.interventoria : false} />
          </div>

          <div className="form-group">
            <label htmlFor={`metodo-${colegio.sitioId}`}>📊 Método de conteo <RequiredMark /></label>
            <select id={`metodo-${colegio.sitioId}`} name="metodo_conteo" defaultValue={registro?.metodo_conteo || 'aleatorio'}>
              <option value="aleatorio">Aleatorio</option>
              <option value="uno_a_uno">Uno a uno</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor={`presentan-${colegio.sitioId}`}>🧺 Canastillas que se presentan <RequiredMark /></label>
            <input
              id={`presentan-${colegio.sitioId}`}
              type="number"
              name="canastillas_presentan"
              defaultValue={registro?.canastillas_presentan ?? ''}
              min="0"
            />
            <FieldError mensaje={fieldErrors.canastillas_presentan} />
          </div>

          <div className="form-group">
            <label htmlFor={`retiran-${colegio.sitioId}`}>🧺 Canastillas que se retiran <RequiredMark /></label>
            <input
              id={`retiran-${colegio.sitioId}`}
              type="number"
              name="canastillas_retiran"
              defaultValue={registro?.canastillas_retiran ?? ''}
              min="0"
            />
            <FieldError mensaje={fieldErrors.canastillas_retiran} />
          </div>

          <div className="form-group">
            <label htmlFor={`obs-${colegio.sitioId}`}>📝 Observaciones</label>
            <textarea
              id={`obs-${colegio.sitioId}`}
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
