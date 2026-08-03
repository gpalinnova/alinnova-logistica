'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../../components/PageHeader'
import Toast from '../../../../components/Toast'
import LogisticaProductoModal from '../../../../components/LogisticaProductoModal'
import { supabase } from '../../../../lib/supabase'

const MODALIDAD_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'panaderia', label: '🥐 Panadería' },
  { key: 'am_pm', label: '☀️ AM-PM' },
  { key: 'gastronomia', label: '🍽️ Gastronomía' },
]

const MODALIDAD_INFO = {
  panaderia: { label: 'Panadería', className: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', className: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', className: 'logistica-pill-gastronomia' },
}

function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

export default function ProductosLogisticaPage() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [filtroModalidad, setFiltroModalidad] = useState('todos')
  const [filtroFamilia, setFiltroFamilia] = useState('todas')
  const [search, setSearch] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [modalState, setModalState] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProductos() }, [])

  async function fetchProductos() {
    setLoading(true)
    const { data, error } = await supabase.from('logistica_productos').select('*').order('modalidad').order('nombre')
    if (error) {
      setErrorMsg('No se pudieron cargar los productos.')
    } else {
      setProductos(data || [])
      setErrorMsg('')
    }
    setLoading(false)
  }

  const familias = useMemo(() => {
    return Array.from(new Set(productos.map(p => p.familia_producto).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  }, [productos])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return productos.filter(p => {
      if (filtroModalidad !== 'todos' && p.modalidad !== filtroModalidad) return false
      if (filtroFamilia !== 'todas' && p.familia_producto !== filtroFamilia) return false
      if (!mostrarInactivos && !p.activo) return false
      if (term) {
        const matches = [p.nombre, p.nombre_corto, String(p.codigo_articulo)]
          .some(v => v != null && String(v).toLowerCase().includes(term))
        if (!matches) return false
      }
      return true
    })
  }, [productos, filtroModalidad, filtroFamilia, search, mostrarInactivos])

  const conteo = useMemo(() => {
    const activos = productos.filter(p => p.activo)
    return {
      activos: activos.length,
      panaderia: activos.filter(p => p.modalidad === 'panaderia').length,
      am_pm: activos.filter(p => p.modalidad === 'am_pm').length,
      gastronomia: activos.filter(p => p.modalidad === 'gastronomia').length,
      familias: new Set(activos.map(p => p.familia_producto).filter(Boolean)).size,
    }
  }, [productos])

  function openAddModal() {
    setModalState({ mode: 'add' })
  }

  function openEditModal(producto) {
    setModalState({ mode: 'edit', producto })
  }

  function closeModal() {
    if (saving) return
    setModalState(null)
  }

  async function handleSubmit(formData) {
    setSaving(true)
    try {
      if (modalState.mode === 'add') {
        const { error } = await supabase.from('logistica_productos').insert([formData])
        if (error) throw error
        setToast({ message: 'Producto creado correctamente.', type: 'success' })
      } else {
        const { error } = await supabase.from('logistica_productos')
          .update(formData)
          .eq('id', modalState.producto.id)
        if (error) throw error
        setToast({ message: 'Producto actualizado correctamente.', type: 'success' })
      }
      await fetchProductos()
      setModalState(null)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.code === '23505' ? 'Ya existe un producto con ese código de artículo.' : 'No se pudo guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(producto) {
    const { error } = await supabase.from('logistica_productos')
      .update({ activo: !producto.activo })
      .eq('id', producto.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el estado del producto.')
    } else {
      await fetchProductos()
    }
  }

  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica/data-maestra"
          backLabel="Volver"
          title="🥐 Productos — Logística"
          subtitle={`${conteo.activos} productos activos · ${conteo.familias} familias · ${conteo.panaderia} panadería · ${conteo.am_pm} AM-PM · ${conteo.gastronomia} gastronomía`}
        />
        <div className="page-content">
          <div className="logistica-filter-tabs">
            {MODALIDAD_TABS.map(tab => (
              <button
                key={tab.key}
                className={`logistica-filter-tab ${filtroModalidad === tab.key ? 'active' : ''}`}
                onClick={() => setFiltroModalidad(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="page-toolbar spread">
            <div className="toolbar-search">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔎 Buscar por nombre o código..."
              />
            </div>
            <select value={filtroFamilia} onChange={e => setFiltroFamilia(e.target.value)}>
              <option value="todas">Todas las familias</option>
              {familias.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <label className="logistica-checkbox-label">
              <input type="checkbox" checked={mostrarInactivos} onChange={e => setMostrarInactivos(e.target.checked)} />
              Mostrar inactivos
            </label>
            <button className="btn-primary" onClick={openAddModal}>➕ Nuevo producto</button>
          </div>

          {errorMsg && <div className="form-error-banner">{errorMsg}</div>}

          {loading ? (
            <div className="empty-state"><p>Cargando productos...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>{productos.length === 0 ? 'No hay productos cargados todavía.' : 'No hay productos que coincidan con el filtro.'}</p></div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código artículo</th>
                    <th>Nombre corto</th>
                    <th>Modalidad</th>
                    <th>Familia</th>
                    <th>Gramaje</th>
                    <th>Capacidad canastilla</th>
                    <th>Valor unitario</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(producto => {
                    const modInfo = MODALIDAD_INFO[producto.modalidad]
                    return (
                      <tr key={producto.id}>
                        <td className="logistica-mono">{producto.codigo_articulo}</td>
                        <td>{producto.nombre_corto}</td>
                        <td><span className={`logistica-pill ${modInfo?.className || ''}`}>{modInfo?.label || producto.modalidad}</span></td>
                        <td><span className="logistica-pill logistica-pill-familia">{producto.familia_producto}</span></td>
                        <td>{producto.gramaje_gr != null ? `${producto.gramaje_gr}g` : <span className="logistica-muted">—</span>}</td>
                        <td>{producto.capacidad_canastilla > 0 ? producto.capacidad_canastilla : <span className="logistica-muted">—</span>}</td>
                        <td>{producto.valor_unitario > 0 ? formatCOP(producto.valor_unitario) : <span className="logistica-muted">—</span>}</td>
                        <td>
                          <span className={`badge ${producto.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                            {producto.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="product-row-actions">
                            <button className="btn-secondary" onClick={() => openEditModal(producto)}>✏️ Editar</button>
                            <button className="btn-secondary" onClick={() => handleToggleActivo(producto)}>
                              {producto.activo ? '⏸ Desactivar' : '▶️ Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {modalState && (
        <LogisticaProductoModal
          mode={modalState.mode}
          initialData={modalState.mode === 'edit' ? modalState.producto : null}
          onClose={closeModal}
          onSubmit={handleSubmit}
          saving={saving}
          familiasExistentes={familias}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
