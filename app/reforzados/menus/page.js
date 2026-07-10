'use client'

import { useEffect, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import MenuModal from '../../../components/MenuModal'
import ConfirmModal from '../../../components/ConfirmModal'
import Toast from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'

const COMPONENTES = [
  { key: 'bebida_uht', label: 'Bebida UHT', componente: 'BEBIDA UHT', emoji: '🥛' },
  { key: 'agua', label: 'Agua', componente: 'AGUA', emoji: '💧' },
  { key: 'proteico', label: 'Proteico', componente: 'PROTEICO', emoji: '🥪' },
  { key: 'postre', label: 'Postre', componente: 'POSTRE', emoji: '🍮' },
  { key: 'fruta', label: 'Fruta', componente: 'FRUTA', emoji: '🍎' },
]

export default function MenusPage() {
  const [menus, setMenus] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [confirmResync, setConfirmResync] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [menusRes, productosRes] = await Promise.all([
      supabase.from('reforzados_menus').select('*').order('numero'),
      supabase.from('reforzados_productos').select('componente, nombre').eq('activo', true),
    ])
    if (menusRes.error || productosRes.error) {
      setErrorMsg('No se pudieron cargar los menús.')
    } else {
      setMenus(menusRes.data || [])
      setProductos(productosRes.data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const productosByComponente = COMPONENTES.reduce((acc, c) => {
    const nombres = productos.filter(p => p.componente === c.componente).map(p => p.nombre)
    acc[c.componente] = [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'))
    return acc
  }, {})

  function openEdit(menu) {
    setEditing(menu)
  }

  function closeEdit() {
    if (saving) return
    setEditing(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      const { error } = await supabase.from('reforzados_menus')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      if (error) throw error
      const numero = editing.numero
      await fetchAll()
      setEditing(null)
      setToast({ message: `Menú ${numero} actualizado`, type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo guardar el menú.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResync() {
    setResyncing(true)
    try {
      const { data: ciclo, error: cicloError } = await supabase
        .from('reforzados_ciclos')
        .select('id')
        .eq('estado', 'activo')
        .maybeSingle()
      if (cicloError) throw cicloError
      if (!ciclo) {
        setErrorMsg('No hay un ciclo activo para resincronizar.')
        setConfirmResync(false)
        return
      }

      const { data: dias, error: diasError } = await supabase
        .from('reforzados_ciclo_dias')
        .select('menu_numero, fecha, bebida_uht, agua, proteico, postre, fruta')
        .eq('ciclo_id', ciclo.id)
        .not('menu_numero', 'is', null)
        .order('fecha')
      if (diasError) throw diasError

      const primeraAparicion = {}
      for (const dia of dias || []) {
        if (!(dia.menu_numero in primeraAparicion)) {
          primeraAparicion[dia.menu_numero] = dia
        }
      }

      for (let numero = 1; numero <= 10; numero++) {
        const dia = primeraAparicion[numero]
        const { error } = await supabase.from('reforzados_menus')
          .update({
            bebida_uht: dia?.bebida_uht ?? null,
            agua: dia?.agua ?? null,
            proteico: dia?.proteico ?? null,
            postre: dia?.postre ?? null,
            fruta: dia?.fruta ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('numero', numero)
        if (error) throw error
      }

      await fetchAll()
      setConfirmResync(false)
      setToast({ message: 'Menús resincronizados desde el ciclo activo', type: 'success' })
    } catch (err) {
      setErrorMsg('No se pudo resincronizar desde el ciclo activo.')
    } finally {
      setResyncing(false)
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Menús Maestro" subtitle="Composición fija de los 10 menús rotativos" />
        <div className="page-content">
          <div className="page-toolbar">
            <button className="btn-secondary" onClick={() => setConfirmResync(true)} disabled={loading}>
              🔄 Resincronizar desde ciclo activo
            </button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando menús...</p></div>
          ) : menus.length === 0 ? (
            <div className="empty-state"><p>No hay menús cargados todavía.</p></div>
          ) : (
            <div className="menu-grid">
              {menus.map(menu => (
                <div key={menu.id} className="menu-card">
                  <div className="menu-card-header">
                    <span className="menu-card-numero">MENÚ {menu.numero}</span>
                    <button className="icon-btn" title="Editar" onClick={() => openEdit(menu)}>✏️</button>
                  </div>
                  {COMPONENTES.map(c => (
                    <div key={c.key} className="menu-card-item">
                      <span className="menu-card-item-label">{c.emoji} {c.label.toUpperCase()}</span>
                      <span className={`menu-card-item-value${menu[c.key] ? '' : ' is-empty'}`}>
                        {menu[c.key] || 'Sin definir'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {editing && (
        <MenuModal
          menu={editing}
          productosByComponente={productosByComponente}
          onClose={closeEdit}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}

      {confirmResync && (
        <ConfirmModal
          title="¿Resincronizar los 10 menús?"
          message="Se sobrescribirán bebida UHT, agua, proteico, postre y fruta de cada menú con la primera aparición en el ciclo activo. Los menús editados manualmente perderán sus cambios."
          confirmLabel="Resincronizar"
          danger
          onConfirm={handleResync}
          onCancel={() => !resyncing && setConfirmResync(false)}
          loading={resyncing}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
