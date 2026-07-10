'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/PageHeader'
import ProductoModal from '../../../components/ProductoModal'
import { supabase } from '../../../lib/supabase'

const COMPONENTES = [
  { key: 'BEBIDA UHT', label: 'Bebida UHT', accent: 'accent-blue' },
  { key: 'AGUA', label: 'Agua', accent: 'accent-celeste' },
  { key: 'PROTEICO', label: 'Proteico', accent: 'accent-red' },
  { key: 'POSTRE', label: 'Postre', accent: 'accent-pink' },
  { key: 'FRUTA', label: 'Fruta', accent: 'accent-green' },
]

function groupByComponente(productos) {
  const grouped = {}
  for (const c of COMPONENTES) grouped[c.key] = []
  for (const row of productos) {
    const list = grouped[row.componente] || (grouped[row.componente] = [])
    let group = list.find(g => g.nombre === row.nombre)
    if (!group) {
      group = {
        nombre: row.nombre,
        empaque_texto: row.empaque_texto,
        unidades_por_canastilla: row.unidades_por_canastilla,
        activo: row.activo,
        ids: [],
        tipos: [],
      }
      list.push(group)
    }
    group.ids.push(row.id)
    if (row.tipo) group.tipos.push(row.tipo)
    if (row.activo) group.activo = true
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    for (const g of grouped[key]) g.tipos.sort()
  }
  return grouped
}

export default function ProductosPage() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [expanded, setExpanded] = useState(() => Object.fromEntries(COMPONENTES.map(c => [c.key, true])))
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProductos() }, [])

  async function fetchProductos() {
    setLoading(true)
    const { data, error } = await supabase.from('reforzados_productos').select('*').order('nombre')
    if (error) {
      setErrorMsg('No se pudieron cargar los productos.')
    } else {
      setProductos(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const grouped = useMemo(() => groupByComponente(productos), [productos])

  function toggleSection(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(componenteKey, group) {
    setModalState({ mode: 'edit', componente: componenteKey, group })
  }

  function closeModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        if (formData.componente === 'PROTEICO') {
          const rows = ['TIPO 1', 'TIPO 2'].map(tipo => ({
            componente: formData.componente,
            nombre: formData.nombre,
            empaque_texto: formData.empaque_texto,
            unidades_por_canastilla: formData.unidades_por_canastilla,
            tipo,
          }))
          const { error } = await supabase.from('reforzados_productos').insert(rows)
          if (error) throw error
        } else {
          const { error } = await supabase.from('reforzados_productos').insert([{
            componente: formData.componente,
            nombre: formData.nombre,
            empaque_texto: formData.empaque_texto,
            unidades_por_canastilla: formData.unidades_por_canastilla,
            tipo: null,
          }])
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('reforzados_productos')
          .update({
            nombre: formData.nombre,
            empaque_texto: formData.empaque_texto,
            unidades_por_canastilla: formData.unidades_por_canastilla,
            updated_at: new Date().toISOString(),
          })
          .in('id', modalState.group.ids)
        if (error) throw error
      }
      await fetchProductos()
      setModalState(null)
    } catch (err) {
      setErrorMsg('No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(group) {
    const { error } = await supabase.from('reforzados_productos')
      .update({ activo: !group.activo, updated_at: new Date().toISOString() })
      .in('id', group.ids)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado del producto.')
    } else {
      await fetchProductos()
    }
  }

  async function handleDelete(group) {
    if (!window.confirm(`¿Eliminar "${group.nombre}"? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('reforzados_productos').delete().in('id', group.ids)
    if (error) {
      setErrorMsg('No se pudo eliminar el producto.')
    } else {
      await fetchProductos()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader backHref="/reforzados" backLabel="Reforzados" title="Productos Maestro" subtitle="Catálogo de productos y empaques por componente" />
        <div className="page-content">
          <div className="page-toolbar">
            <button className="btn-primary" onClick={openAddModal}>➕ Agregar Producto</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando productos...</p></div>
          ) : (
            COMPONENTES.map(c => {
              const items = grouped[c.key] || []
              const isOpen = expanded[c.key]
              return (
                <div key={c.key} className={`section-collapsible ${c.accent} ${isOpen ? '' : 'collapsed'}`}>
                  <div className="section-collapsible-header" onClick={() => toggleSection(c.key)}>
                    <div>
                      <span className="section-collapsible-title">{c.label}</span>
                      <span className="section-collapsible-count"> ({items.length} producto{items.length === 1 ? '' : 's'})</span>
                    </div>
                    <span className="section-collapsible-chevron">▼</span>
                  </div>
                  {isOpen && (
                    <div className="section-collapsible-body">
                      {items.length === 0 ? (
                        <div className="empty-state"><p>No hay productos en este componente.</p></div>
                      ) : (
                        items.map(group => (
                          <div key={group.nombre} className="product-row">
                            <div className="product-row-main">
                              <div className="product-row-nombre">{group.nombre}</div>
                              <div className="product-row-empaque">{group.empaque_texto}</div>
                              <div className="product-row-meta">
                                <span className="badge badge-info">{group.unidades_por_canastilla} uds/canastilla</span>
                                {group.tipos.includes('TIPO 1') && <span className="badge badge-tipo1">TIPO 1</span>}
                                {group.tipos.includes('TIPO 2') && <span className="badge badge-tipo2">TIPO 2</span>}
                                {!group.activo && <span className="badge badge-inactivo">Inactivo</span>}
                              </div>
                            </div>
                            <div className="product-row-actions">
                              <label className="switch" title={group.activo ? 'Activo' : 'Inactivo'}>
                                <input type="checkbox" checked={group.activo} onChange={() => handleToggleActivo(group)} />
                                <span className="switch-slider"></span>
                              </label>
                              <button className="icon-btn" title="Editar" onClick={() => openEditModal(c.key, group)}>✏️</button>
                              <button className="icon-btn danger" title="Eliminar" onClick={() => handleDelete(group)}>🗑️</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>

      {modalState && (
        <ProductoModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? { componente: modalState.componente, ...modalState.group } : null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </div>
  )
}
