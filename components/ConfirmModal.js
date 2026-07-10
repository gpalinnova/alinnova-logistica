'use client'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={() => !loading && onCancel()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <p className="modal-confirm-text">{message}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button className={danger ? 'btn-danger-solid' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
