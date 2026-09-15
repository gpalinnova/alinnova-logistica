'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PageHeader from './PageHeader'
import LogisticaWizardPrint from './LogisticaWizardPrint'
import LogisticaDirectorioModal from './LogisticaDirectorioModal'
import { supabase } from '../lib/supabase'
import { readFileAsArrayBuffer } from '../lib/parseRutasExcel'
import { parsearExcelWizard } from '../lib/logisticaWizardExcel'
import { canastillasDe, fmtN } from '../lib/logisticaWizardCalc'

const STEP_LABELS = ['Cargar OC', 'Seleccionar OC', 'Productos', 'Zonas y rutas', 'Distribuir', 'Conductores', 'Generar']

const LINEA_INFO = {
  panaderia: { label: 'Panadería', pill: 'logistica-pill-panaderia' },
  am_pm: { label: 'AM-PM', pill: 'logistica-pill-ampm' },
  gastronomia: { label: 'Gastronomía', pill: 'logistica-pill-gastronomia' },
}
function matchesFilter(p, filtro) {
  if (filtro === 'todas') return true
  if (filtro === 'sin_clasificar') return !p.maestraOk
  return p.linea === filtro
}

function LineaPill({ linea }) {
  const info = LINEA_INFO[linea]
  if (!info) return <span className="logistica-pill logistica-pill-familia">Sin clasificar</span>
  return <span className={`logistica-pill ${info.pill}`}>{info.label}</span>
}

export default function LogisticaOperacionesWizard() {
  const [step, setStep] = useState(1)

  const [loadingMaestra, setLoadingMaestra] = useState(true)
  const [maestraError, setMaestraError] = useState('')
  const [productosMaestra, setProductosMaestra] = useState(new Map())
  const [directorio, setDirectorio] = useState(new Map())

  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [rawRows, setRawRows] = useState([])
  const [ocs, setOcs] = useState([])

  const [productos, setProductos] = useState([])
  const [filterLinea, setFilterLinea] = useState('todas')

  const [colegios, setColegios] = useState({})
  const [localidades, setLocalidades] = useState([])
  const [rutas, setRutas] = useState([])
  const [colegiosAsignados, setColegiosAsignados] = useState({})
  const [puntosSugeridos, setPuntosSugeridos] = useState(new Set())
  const [puntosConfirmados, setPuntosConfirmados] = useState(new Set())

  const [config, setConfig] = useState({ nroInicio: 1, fechaEmision: '', fechaEntrega: '' })
  const [preview, setPreview] = useState(null)
  const [modalDirectorioAbierto, setModalDirectorioAbierto] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      setLoadingMaestra(true)
      const [{ data: prodData, error: prodErr }, { data: sitiosData, error: sitiosErr }] = await Promise.all([
        supabase.from('logistica_productos').select('*').eq('activo', true),
        supabase.from('logistica_sitios').select('*').eq('activo', true),
      ])
      if (cancelado) return
      if (prodErr || sitiosErr) {
        setMaestraError('No se pudo cargar la data maestra de Productos o el Directorio de colegios desde Supabase.')
      } else {
        setProductosMaestra(new Map((prodData || []).map(p => [String(p.codigo_articulo), p])))
        setDirectorio(new Map((sitiosData || []).map(s => [String(s.punto_wms), s])))
      }
      setLoadingMaestra(false)
    })()
    return () => { cancelado = true }
  }, [])

  const productosPorSap = useMemo(() => new Map(productos.map(p => [p.sap, p])), [productos])

  // ============================== PASO 1 — CARGAR OC ==============================
  function handleFileSelected(file) {
    if (!file) return
    if (loadingMaestra) return
    if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) {
      setFileError('Solo se aceptan archivos Excel (.xlsx, .xls, .xlsm).')
      return
    }
    procesarArchivo(file)
  }

  async function procesarArchivo(file) {
    setParsing(true)
    setFileError('')
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const rows = parsearExcelWizard(buffer)

      const ocMap = new Map()
      rows.forEach(r => {
        if (!ocMap.has(r.oc)) ocMap.set(r.oc, { numero: r.oc, fecha: r.fecha_entrega, colegios: new Set(), lineas: new Set(), cantidad: 0, filas: 0 })
        const o = ocMap.get(r.oc)
        o.colegios.add(r.punto)
        const maestra = productosMaestra.get(r.sap)
        o.lineas.add(maestra ? maestra.modalidad : 'sin_clasificar')
        o.cantidad += r.cantidad
        o.filas += 1
      })
      const ocsList = Array.from(ocMap.values()).map(o => ({
        numero: o.numero, fecha: o.fecha, colegios: o.colegios.size, lineas: Array.from(o.lineas),
        cantidad: o.cantidad, filas: o.filas, selected: true,
      }))

      setFileName(file.name)
      setRawRows(rows)
      setOcs(ocsList)
      setStep(2)
    } catch (err) {
      setFileError(err.message || 'No se pudo procesar el archivo.')
    } finally {
      setParsing(false)
    }
  }

  function handleDragOver(e) { e.preventDefault(); setDragActive(true) }
  function handleDragLeave(e) { e.preventDefault(); setDragActive(false) }
  function handleDrop(e) { e.preventDefault(); setDragActive(false); handleFileSelected(e.dataTransfer.files?.[0]) }
  function handleInputChange(e) { const file = e.target.files?.[0]; e.target.value = ''; handleFileSelected(file) }

  function reiniciarTodo() {
    if (!window.confirm('¿Reiniciar todo el proceso? Perderás la configuración actual.')) return
    setFileName(''); setFileError(''); setRawRows([]); setOcs([]); setProductos([])
    setColegios({}); setLocalidades([]); setRutas([]); setColegiosAsignados({})
    setPuntosSugeridos(new Set()); setPuntosConfirmados(new Set())
    setFilterLinea('todas')
    setStep(1)
  }

  // ============================== PASO 2 — SELECCIONAR OCs ==============================
  function toggleOc(numero) {
    setOcs(prev => prev.map(o => o.numero === numero ? { ...o, selected: !o.selected } : o))
  }

  function confirmOcs() {
    if (!ocs.some(o => o.selected)) { window.alert('Selecciona al menos una OC.'); return }
    buildProductos()
    setStep(3)
  }

  function buildProductos() {
    const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
    const rows = rawRows.filter(r => ocsSet.has(r.oc))

    const colegiosNuevos = {}
    rows.forEach(r => {
      if (!colegiosNuevos[r.punto]) {
        const dir = directorio.get(r.punto)
        colegiosNuevos[r.punto] = {
          punto: r.punto,
          nombre: r.bodega,
          sitioEntrega: r.bodega,
          localidad: r.localidad,
          direccion: dir ? dir.direccion : null,
          sedeEducativa: dir ? dir.sede_educativa : null,
          enDirectorio: Boolean(dir),
        }
      }
    })
    setColegios(colegiosNuevos)

    const prodMap = new Map()
    rows.forEach(r => {
      if (!prodMap.has(r.sap)) prodMap.set(r.sap, { sap: r.sap, nombreExcel: r.nombre, cantidad: 0, colegios: new Set() })
      const p = prodMap.get(r.sap)
      p.cantidad += r.cantidad
      p.colegios.add(r.punto)
    })

    const productosNuevos = Array.from(prodMap.values()).map(p => {
      const maestra = productosMaestra.get(p.sap)
      const embalaje = maestra ? maestra.capacidad_canastilla : 0
      const { base, sueltas } = canastillasDe(p.cantidad, embalaje)
      return {
        sap: p.sap,
        nombre: maestra ? (maestra.nombre_corto || maestra.nombre) : p.nombreExcel,
        nombreCompleto: maestra ? maestra.nombre : p.nombreExcel,
        cantidad: p.cantidad,
        embalaje,
        canastillas: base,
        sueltas,
        linea: maestra ? maestra.modalidad : null,
        precio: maestra ? (maestra.valor_unitario || 0) : 0,
        colegios: p.colegios.size,
        selected: true,
        maestraOk: Boolean(maestra),
      }
    })
    setProductos(productosNuevos)
  }

  // ============================== PASO 3 — PRODUCTOS ==============================
  const productosFiltrados = useMemo(() => productos.filter(p => matchesFilter(p, filterLinea)), [productos, filterLinea])

  function toggleProducto(sap) {
    setProductos(prev => prev.map(p => p.sap === sap ? { ...p, selected: !p.selected } : p))
  }
  function toggleVisiblesProductos(checked) {
    setProductos(prev => prev.map(p => matchesFilter(p, filterLinea) ? { ...p, selected: checked } : p))
  }

  function abrirModalDirectorio() {
    if (!Object.values(colegios).some(c => !c.enDirectorio)) return
    setModalDirectorioAbierto(true)
  }

  // Al guardar el modal: los colegios recién insertados en logistica_sitios se
  // aplican tanto al directorio (para que futuras OCs los encuentren) como a
  // los colegios de la OC actual, para que el flujo siga como si siempre
  // hubieran estado en el directorio.
  function handleDirectorioGuardado(rowsInsertadas) {
    const porPunto = new Map(rowsInsertadas.map(r => [String(r.punto_wms), r]))

    setDirectorio(prev => {
      const next = new Map(prev)
      porPunto.forEach((sitio, punto) => next.set(punto, sitio))
      return next
    })

    setColegios(prev => {
      const next = { ...prev }
      porPunto.forEach((sitio, punto) => {
        if (!next[punto]) return
        next[punto] = {
          ...next[punto],
          nombre: sitio.nombre_institucion,
          sitioEntrega: sitio.nombre_sitio || sitio.nombre_institucion,
          localidad: sitio.localidad,
          direccion: sitio.direccion,
          sedeEducativa: sitio.sede_educativa,
          enDirectorio: true,
        }
      })
      return next
    })

    setModalDirectorioAbierto(false)
  }

  function confirmProductos() {
    if (!productos.some(p => p.selected)) { window.alert('Selecciona al menos un producto.'); return }
    buildLocalidades()
    setStep(4)
  }

  function getFechaOcISO() {
    const oc = ocs.find(o => o.selected)
    return (oc && oc.fecha) || new Date().toISOString().split('T')[0]
  }

  function buildLocalidades() {
    const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
    const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
    const filas = rawRows.filter(r => ocsSet.has(r.oc) && prodSet.has(r.sap))

    const locMap = new Map()
    filas.forEach(r => {
      const loc = r.localidad || 'SIN LOCALIDAD'
      if (!locMap.has(loc)) locMap.set(loc, { nombre: loc, ptos: new Set(), cantidad: 0, porProducto: {} })
      const l = locMap.get(loc)
      l.ptos.add(r.punto)
      l.cantidad += r.cantidad
      l.porProducto[r.sap] = (l.porProducto[r.sap] || 0) + r.cantidad
    })

    const nuevasLocalidades = Array.from(locMap.values()).map(l => {
      let canast = 0
      Object.entries(l.porProducto).forEach(([sap, cant]) => {
        canast += canastillasDe(cant, productosPorSap.get(sap)?.embalaje).total
      })
      return {
        nombre: l.nombre, ptos: l.ptos.size, cantidad: l.cantidad, canastillas: canast,
        selected: l.nombre !== 'SIN LOCALIDAD', numRutas: 1, agrupar: false, porProducto: l.porProducto,
      }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    setLocalidades(nuevasLocalidades)
    reiniciarRutas(nuevasLocalidades, {})
  }

  // ============================== PASO 4 — ZONAS Y RUTAS ==============================
  function reiniciarRutas(localidadesList, preserve) {
    const fechaInit = getFechaOcISO()
    const nuevas = []
    localidadesList.filter(l => l.selected).forEach(l => {
      for (let i = 1; i <= l.numRutas; i++) {
        const nombreRuta = l.numRutas === 1 ? l.nombre : `${l.nombre} ${i}`
        const prev = preserve[nombreRuta]
        nuevas.push({
          id: `r-${Math.random().toString(36).slice(2, 9)}`,
          nombre: nombreRuta,
          localidades: [l.nombre],
          subruta: l.numRutas > 1 ? i : null,
          conductor: prev?.conductor || '',
          placa: prev?.placa || '',
          fechaDespacho: prev?.fechaDespacho || fechaInit,
        })
      }
    })
    setRutas(nuevas)
    autoAsignarColegios(nuevas, localidadesList)
    return nuevas
  }

  function recalcRutasFromLocalidades(localidadesList) {
    const preserve = {}
    rutas.forEach(r => { preserve[r.nombre] = { conductor: r.conductor, placa: r.placa, fechaDespacho: r.fechaDespacho } })
    reiniciarRutas(localidadesList, preserve)
  }

  function autoAsignarColegios(rutasList, localidadesList) {
    const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
    const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
    const puntosPorLoc = {}
    rawRows.filter(r => ocsSet.has(r.oc) && prodSet.has(r.sap)).forEach(r => {
      if (!puntosPorLoc[r.localidad]) puntosPorLoc[r.localidad] = new Set()
      puntosPorLoc[r.localidad].add(r.punto)
    })
    const asignados = {}
    rutasList.forEach(r => {
      r.localidades.forEach(locNombre => {
        const l = localidadesList.find(x => x.nombre === locNombre)
        if (!l || l.numRutas !== 1) return
        ;(puntosPorLoc[locNombre] ? Array.from(puntosPorLoc[locNombre]) : []).forEach(punto => { asignados[punto] = r.id })
      })
    })
    setColegiosAsignados(asignados)
  }

  function updateLocalidad(nombre, patch) {
    const updated = localidades.map(l => l.nombre === nombre ? { ...l, ...patch } : l)
    setLocalidades(updated)
    recalcRutasFromLocalidades(updated)
  }
  function toggleZona(nombre, checked) { updateLocalidad(nombre, { selected: checked }) }
  function setNumRutas(nombre, val) { updateLocalidad(nombre, { numRutas: Math.max(1, parseInt(val, 10) || 1) }) }
  function toggleAgrupar(nombre, checked) { setLocalidades(prev => prev.map(l => l.nombre === nombre ? { ...l, agrupar: checked } : l)) }
  function toggleAllZonas(checked) {
    const updated = localidades.map(l => l.nombre !== 'SIN LOCALIDAD' ? { ...l, selected: checked } : l)
    setLocalidades(updated)
    recalcRutasFromLocalidades(updated)
  }

  function agruparSeleccionadas() {
    const paraAgrupar = localidades.filter(l => l.agrupar && l.selected)
    if (paraAgrupar.length < 2) { window.alert('Marca al menos 2 localidades en la columna "Agrupar" para armarlas en una sola ruta.'); return }
    if (paraAgrupar.some(l => l.numRutas > 1)) { window.alert('Solo se pueden agrupar localidades con 1 ruta cada una. Ajusta el número de rutas antes de agrupar.'); return }
    const nombresAgrupar = paraAgrupar.map(l => l.nombre)
    const rutasFiltradas = rutas.filter(r => !r.localidades.some(loc => nombresAgrupar.includes(loc)))
    const nuevaRuta = {
      id: `r-${Math.random().toString(36).slice(2, 9)}`,
      nombre: nombresAgrupar.join(' + '),
      localidades: nombresAgrupar,
      subruta: null,
      conductor: '',
      placa: '',
      fechaDespacho: getFechaOcISO(),
    }
    const nuevasRutas = [...rutasFiltradas, nuevaRuta]
    setRutas(nuevasRutas)
    const localidadesActualizadas = localidades.map(l => nombresAgrupar.includes(l.nombre) ? { ...l, agrupar: false } : l)
    setLocalidades(localidadesActualizadas)
    autoAsignarColegios(nuevasRutas, localidadesActualizadas)
  }

  function borrarRuta(id) {
    const r = rutas.find(x => x.id === id)
    if (!r) return
    const localidadesActualizadas = localidades.map(l => r.localidades.includes(l.nombre) ? { ...l, selected: false } : l)
    setLocalidades(localidadesActualizadas)
    const nuevasRutas = rutas.filter(x => x.id !== id)
    setRutas(nuevasRutas)
    autoAsignarColegios(nuevasRutas, localidadesActualizadas)
  }

  function confirmZonas() {
    if (!rutas.length) { window.alert('Debes armar al menos una ruta.'); return }
    const necesitaDistribuir = localidades.some(l => l.selected && l.numRutas > 1)
    setStep(necesitaDistribuir ? 5 : 6)
  }

  // ============================== PASO 5 — DISTRIBUIR ==============================
  // Al entrar al paso 5, busca en el histórico la última ruta conocida de cada
  // colegio de una localidad multi-ruta y pre-llena el dropdown si el nombre
  // de esa ruta hace match exacto con alguna de las rutas armadas hoy.
  useEffect(() => {
    if (step !== 5) return
    let cancelado = false
    ;(async () => {
      const localidadesMulti = localidades.filter(l => l.selected && l.numRutas > 1)
      if (!localidadesMulti.length) return
      const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
      const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
      const nombresLoc = new Set(localidadesMulti.map(l => l.nombre))
      const puntos = Array.from(new Set(
        rawRows.filter(r => ocsSet.has(r.oc) && prodSet.has(r.sap) && nombresLoc.has(r.localidad)).map(r => r.punto)
      )).filter(p => !puntosConfirmados.has(p))
      if (!puntos.length) return

      const { data, error } = await supabase
        .from('logistica_asignaciones_historico')
        .select('punto_wms, nombre_ruta, fecha')
        .in('punto_wms', puntos)
        .order('fecha', { ascending: false })
      if (cancelado) return
      if (error) { console.error('No se pudo consultar el histórico de asignaciones:', error); return }

      const ultimaPorPunto = new Map()
      ;(data || []).forEach(row => { if (!ultimaPorPunto.has(row.punto_wms)) ultimaPorPunto.set(row.punto_wms, row.nombre_ruta) })

      const rutaIdPorNombre = new Map(rutas.map(r => [r.nombre, r.id]))
      const nuevasAsignaciones = {}
      const nuevosSugeridos = new Set()
      ultimaPorPunto.forEach((nombreRuta, punto) => {
        const rutaId = rutaIdPorNombre.get(nombreRuta)
        if (!rutaId) return
        nuevasAsignaciones[punto] = rutaId
        nuevosSugeridos.add(punto)
      })
      if (!Object.keys(nuevasAsignaciones).length) return

      setColegiosAsignados(prev => {
        const next = { ...prev }
        Object.entries(nuevasAsignaciones).forEach(([punto, rutaId]) => {
          if (!next[punto]) next[punto] = rutaId
        })
        return next
      })
      setPuntosSugeridos(prev => new Set([...prev, ...nuevosSugeridos]))
    })()
    return () => { cancelado = true }
  }, [step])

  function asignarColegio(punto, rutaId) {
    setColegiosAsignados(prev => {
      const next = { ...prev }
      if (rutaId) next[punto] = rutaId
      else delete next[punto]
      return next
    })
    marcarConfirmado(punto)
  }

  function marcarConfirmado(punto) {
    setPuntosConfirmados(prev => (prev.has(punto) ? prev : new Set(prev).add(punto)))
    setPuntosSugeridos(prev => {
      if (!prev.has(punto)) return prev
      const next = new Set(prev)
      next.delete(punto)
      return next
    })
  }

  async function guardarAsignacionesHistorico() {
    const nombrePorRutaId = new Map(rutas.map(r => [r.id, r.nombre]))
    const fecha = new Date().toISOString()
    const rows = Object.entries(colegiosAsignados)
      .map(([punto_wms, rutaId]) => ({ punto_wms, nombre_ruta: nombrePorRutaId.get(rutaId), fecha }))
      .filter(r => r.nombre_ruta)
    if (!rows.length) return
    const { error } = await supabase.from('logistica_asignaciones_historico').insert(rows)
    if (error) console.error('No se pudo guardar el histórico de asignaciones colegio-ruta:', error)
  }

  async function confirmDistribucion() {
    const necesitanDist = localidades.filter(l => l.selected && l.numRutas > 1)
    const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
    const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
    const sinAsignar = []
    necesitanDist.forEach(l => {
      rawRows.filter(r => ocsSet.has(r.oc) && prodSet.has(r.sap) && r.localidad === l.nombre).forEach(r => {
        if (!colegiosAsignados[r.punto]) sinAsignar.push(r.punto)
      })
    })
    if (sinAsignar.length) {
      const unicos = Array.from(new Set(sinAsignar))
      if (!window.confirm(`Hay ${unicos.length} colegio(s) sin asignar a ninguna ruta. ¿Continuar de todas formas? (Se ignorarán en la generación.)`)) return
    }
    await guardarAsignacionesHistorico()
    setStep(6)
  }

  // ============================== PASO 6 — CONDUCTORES ==============================
  function esRutaDelPunto(r, punto, localidad) {
    if (!r.localidades.includes(localidad)) return false
    const loc = localidades.find(l => l.nombre === localidad)
    if (!loc) return false
    if (loc.numRutas === 1) return true
    return colegiosAsignados[punto] === r.id
  }

  function getFilasRuta(r) {
    const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
    const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
    return rawRows.filter(x => ocsSet.has(x.oc) && prodSet.has(x.sap) && esRutaDelPunto(r, x.punto, x.localidad))
  }

  function getStatsRuta(r) {
    const filas = getFilasRuta(r)
    const puntos = new Set(filas.map(f => f.punto))
    const cant = filas.reduce((s, f) => s + f.cantidad, 0)
    const porProd = {}
    filas.forEach(f => { porProd[f.sap] = (porProd[f.sap] || 0) + f.cantidad })
    let canast = 0
    Object.entries(porProd).forEach(([sap, c]) => { canast += canastillasDe(c, productosPorSap.get(sap)?.embalaje).total })
    return { localidades: r.localidades.length, ptos: puntos.size, cant, canast }
  }

  function updateRuta(id, patch) { setRutas(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)) }

  function confirmConductores() {
    const sinDatos = rutas.filter(r => !r.conductor || !r.placa)
    if (sinDatos.length) {
      if (!window.confirm(`${sinDatos.length} ruta(s) sin conductor o placa. ¿Continuar de todas formas?`)) return
    }
    const hoy = new Date().toISOString().split('T')[0]
    const firstOc = ocs.find(o => o.selected)
    setConfig({ nroInicio: 1, fechaEmision: hoy, fechaEntrega: (firstOc && firstOc.fecha) || hoy })
    setStep(7)
  }

  // ============================== PASO 7 — GENERAR ==============================
  const rutasIndex = useMemo(() => new Map(rutas.map((r, i) => [r.id, i])), [rutas])

  function buildRutaData(r) {
    const filas = getFilasRuta(r).map(f => ({ ...f, producto: productosPorSap.get(f.sap) }))
    return { ruta: r, filas }
  }

  function verRuta(id) {
    const r = rutas.find(x => x.id === id)
    if (!r) return
    setPreview({ titulo: `Ruta: ${r.nombre}`, datos: [buildRutaData(r)] })
  }
  function verTodasRutas() {
    setPreview({ titulo: `Todas las rutas (${rutas.length})`, datos: rutas.map(buildRutaData) })
  }

  // ============================== RENDER ==============================
  return (
    <div className="app-layout">
      <main className="main-content">
        <PageHeader
          backHref="/logistica"
          backLabel="Volver"
          title="📅 Operaciones del Día — Logística"
          subtitle="Wizard de OC → rutero → remisiones"
        />
        <div className="page-content">
          <div className="wizard-steps">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const cls = n === step ? 'active' : n < step ? 'done' : ''
              return (
                <div
                  key={label}
                  className={`wizard-step ${cls}`}
                  onClick={() => { if (n < step) setStep(n) }}
                >
                  <span className="wizard-step-num">{n}</span> {label}
                </div>
              )
            })}
          </div>

          {maestraError && <div className="form-error-banner">{maestraError}</div>}

          {step === 1 && (
            <div>
              <h3>Archivo de Detalle de Entrega del cliente</h3>
              {loadingMaestra ? (
                <div className="empty-state"><p>Cargando productos y directorio de colegios...</p></div>
              ) : (
                <div
                  className={`dropzone ${dragActive ? 'dropzone-highlight' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="dropzone-icon">🥖</div>
                  <div className="dropzone-text">Arrastra el Excel de OC aquí o haz clic para seleccionar</div>
                  <div className="dropzone-hint">Formato: columnas Punto · Numero OC · Nombre_Bodega · Articulo · Nombre · Cantidad · Localidad</div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm" onChange={handleInputChange} style={{ display: 'none' }} />
                </div>
              )}
              {parsing && <div className="empty-state"><p>Leyendo archivo Excel...</p></div>}
              {fileError && <div className="form-error-banner">{fileError}</div>}
              <div className="logistica-info-box">
                Los datos de productos (embalaje, precio) y del directorio de colegios se leen de Supabase.
                <Link href="/logistica/data-maestra/productos" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12 }}>⚙ Editar productos maestros</Link>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>Órdenes de compra detectadas</h3>
              <div className="modal-hint">
                <strong>Archivo:</strong> {fileName}<br />
                Detecté <b>{ocs.length}</b> OC(s). {ocs.filter(o => o.selected).length} seleccionada(s).
              </div>
              <div className="wizard-oc-grid">
                {ocs.map(oc => (
                  <div key={oc.numero} className={`wizard-oc-card ${oc.selected ? 'selected' : ''}`} onClick={() => toggleOc(oc.numero)}>
                    <div className="wizard-oc-chk" />
                    <div className="wizard-oc-num">OC {oc.numero}</div>
                    <div className="wizard-oc-date">Fecha: {oc.fecha || '—'}</div>
                    <div className="wizard-oc-info">
                      <span><b>{oc.colegios}</b> colegios</span>
                      <span><b>{fmtN(oc.cantidad)}</b> unidades</span>
                    </div>
                    <div style={{ marginTop: 8 }}>{oc.lineas.map(l => <LineaPill key={l} linea={l} />)}</div>
                  </div>
                ))}
              </div>
              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(1)}>← Cargar otro archivo</button>
                <button className="btn-primary" onClick={confirmOcs}>Continuar con OCs seleccionadas →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Productos en las OCs seleccionadas</h3>
              <div className="rem-stats-row">
                <div className="rem-stat-card"><div className="rem-stat-num">{productos.length}</div><div className="rem-stat-label">Productos detectados</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{productos.filter(p => p.selected).length}</div><div className="rem-stat-label">Seleccionados</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{fmtN(productos.filter(p => p.selected).reduce((s, p) => s + p.cantidad, 0))}</div><div className="rem-stat-label">Unidades total</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{fmtN(productos.filter(p => p.selected).reduce((s, p) => s + p.canastillas + (p.sueltas > 0 ? 1 : 0), 0))}</div><div className="rem-stat-label">Canastillas total</div></div>
              </div>

              {productos.some(p => !p.maestraOk) && (
                <div className="logistica-warning-box">⚠ {productos.filter(p => !p.maestraOk).length} producto(s) no están en la data maestra (logistica_productos). No se calcularán canastillas para ellos hasta que se creen ahí.</div>
              )}
              {Object.values(colegios).some(c => !c.enDirectorio) && (
                <div className="logistica-warning-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      ⚠ {Object.values(colegios).filter(c => !c.enDirectorio).length} colegio(s) no están en el directorio (logistica_sitios). Sus remisiones y ruteros saldrán con dirección "—".
                      <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
                        {Object.values(colegios).filter(c => !c.enDirectorio).map(c => `${c.punto} — ${c.nombre}`).join(' · ')}
                      </div>
                    </div>
                    <button className="btn-primary" style={{ flexShrink: 0 }} onClick={abrirModalDirectorio}>Completar datos</button>
                  </div>
                </div>
              )}

              <div className="logistica-filter-tabs">
                {['todas', 'panaderia', 'am_pm', 'gastronomia', 'sin_clasificar'].map(key => (
                  <button
                    key={key}
                    className={`logistica-filter-tab ${filterLinea === key ? 'active' : ''}`}
                    onClick={() => setFilterLinea(key)}
                  >
                    {key === 'todas' ? 'Todas' : key === 'sin_clasificar' ? 'Sin clasificar' : LINEA_INFO[key].label}
                  </button>
                ))}
              </div>

              <div className="page-toolbar spread">
                <Link href="/logistica/data-maestra/productos" target="_blank" rel="noopener noreferrer" className="btn-secondary">⚙ Editar productos maestros</Link>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" onClick={() => toggleVisiblesProductos(true)}>Marcar visibles</button>
                  <button className="btn-secondary" onClick={() => toggleVisiblesProductos(false)}>Desmarcar visibles</button>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="wizard-chk-cell"></th>
                      <th>Producto</th>
                      <th>Código SAP</th>
                      <th>Línea</th>
                      <th>Cantidad</th>
                      <th>Emb.</th>
                      <th>Canastillas</th>
                      <th>Sueltas</th>
                      <th>Colegios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map(p => (
                      <tr key={p.sap} className={!p.maestraOk ? 'logistica-row-highlight' : ''}>
                        <td className="wizard-chk-cell"><input type="checkbox" checked={p.selected} onChange={() => toggleProducto(p.sap)} /></td>
                        <td>
                          {p.nombre}
                          {!p.maestraOk && <div style={{ fontSize: 10, color: '#E65100', marginTop: 2 }}>⚠ No está en la data maestra</div>}
                        </td>
                        <td className="logistica-mono">{p.sap}</td>
                        <td><LineaPill linea={p.linea} /></td>
                        <td>{fmtN(p.cantidad)}</td>
                        <td>{p.embalaje || '—'}</td>
                        <td><b>{p.embalaje ? fmtN(p.canastillas) : '?'}</b></td>
                        <td className="logistica-muted">{p.embalaje ? fmtN(p.sueltas) : '—'}</td>
                        <td>{fmtN(p.colegios)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(2)}>← OCs</button>
                <button className="btn-primary" onClick={confirmProductos}>Continuar con productos seleccionados →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3>Localidades y armado de rutas</h3>
              <div className="rem-stats-row">
                <div className="rem-stat-card"><div className="rem-stat-num">{localidades.filter(l => l.selected).length}</div><div className="rem-stat-label">Localidades activas</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{fmtN(localidades.filter(l => l.selected).reduce((s, l) => s + l.ptos, 0))}</div><div className="rem-stat-label">Ptos entrega</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{fmtN(localidades.filter(l => l.selected).reduce((s, l) => s + l.cantidad, 0))}</div><div className="rem-stat-label">Unidades</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{fmtN(localidades.filter(l => l.selected).reduce((s, l) => s + l.canastillas, 0))}</div><div className="rem-stat-label">Canastillas</div></div>
                <div className="rem-stat-card"><div className="rem-stat-num">{rutas.length}</div><div className="rem-stat-label">Rutas armadas</div></div>
              </div>

              {localidades.some(l => l.nombre === 'SIN LOCALIDAD') && (
                <div className="logistica-warning-box">⚠ Hay {localidades.find(l => l.nombre === 'SIN LOCALIDAD')?.ptos || 0} punto(s) sin localidad válida. No se incluyen a menos que los marques manualmente.</div>
              )}

              <div className="data-table-wrap">
                <div className="table-toolbar-row">
                  <span>Marca las localidades que van a despacho hoy. Ajusta cuántos carros necesita cada una.</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary" onClick={() => toggleAllZonas(true)}>Marcar todas</button>
                    <button className="btn-secondary" onClick={() => toggleAllZonas(false)}>Desmarcar</button>
                  </div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="wizard-chk-cell"></th>
                      <th>Localidad</th>
                      <th>Ptos entrega</th>
                      <th>Unidades</th>
                      <th>Canastillas</th>
                      <th style={{ width: 100, textAlign: 'center' }}>Rutas</th>
                      <th style={{ textAlign: 'center' }}>Agrupar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localidades.map(l => {
                      const invalida = l.nombre === 'SIN LOCALIDAD'
                      return (
                        <tr key={l.nombre} className={invalida ? 'logistica-row-highlight' : ''}>
                          <td className="wizard-chk-cell"><input type="checkbox" checked={l.selected} onChange={e => toggleZona(l.nombre, e.target.checked)} /></td>
                          <td>{l.nombre}{invalida && <div style={{ fontSize: 10, color: '#c0392b' }}>⚠ Localidad inválida</div>}</td>
                          <td>{fmtN(l.ptos)}</td>
                          <td>{fmtN(l.cantidad)}</td>
                          <td><b>{fmtN(l.canastillas)}</b></td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="number" min="1" max="5" value={l.numRutas} style={{ width: 60, textAlign: 'center' }} onChange={e => setNumRutas(l.nombre, e.target.value)} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={l.agrupar} onChange={e => toggleAgrupar(l.nombre, e.target.checked)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <h3 style={{ marginTop: 20 }}>Rutas armadas</h3>
              {!rutas.length && <div className="empty-state"><p>Aún no hay rutas armadas. Marca localidades y ajusta cuántos carros necesita cada una.</p></div>}
              {rutas.map(r => {
                const loc = localidades.filter(l => r.localidades.includes(l.nombre) && l.numRutas === 1)
                const ptos = loc.reduce((s, l) => s + l.ptos, 0)
                const cant = loc.reduce((s, l) => s + l.cantidad, 0)
                const canastPorProd = {}
                loc.forEach(l => Object.entries(l.porProducto).forEach(([sap, c]) => { canastPorProd[sap] = (canastPorProd[sap] || 0) + c }))
                let canast = 0
                Object.entries(canastPorProd).forEach(([sap, c]) => { canast += canastillasDe(c, productosPorSap.get(sap)?.embalaje).total })
                return (
                  <div key={r.id} className="wizard-ruta-summary">
                    <div className="wizard-ruta-summary-head">
                      <h4>{r.nombre}</h4>
                      <button className="btn-secondary" onClick={() => borrarRuta(r.id)}>✕ Borrar</button>
                    </div>
                    <div className="wizard-ruta-summary-info">
                      <span><b>{r.localidades.length}</b> localidad(es)</span>
                      <span><b>{ptos || '?'}</b> ptos</span>
                      <span><b>{fmtN(cant)}</b> unidades</span>
                      <span><b>{fmtN(canast)}</b> canastillas</span>
                    </div>
                  </div>
                )
              })}
              <div className="page-toolbar" style={{ justifyContent: 'flex-start', gap: 10, marginTop: 10 }}>
                <button className="btn-secondary" onClick={agruparSeleccionadas}>➕ Agrupar localidades marcadas "Agrupar" en 1 ruta</button>
              </div>

              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(3)}>← Productos</button>
                <button className="btn-primary" onClick={confirmZonas}>Continuar →</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3>Distribuir colegios entre subrutas</h3>
              <div className="logistica-info-box">Las localidades que definiste con más de 1 ruta necesitan que asignes cada colegio a una subruta específica.</div>
              {localidades.filter(l => l.selected && l.numRutas > 1).map(l => {
                const rutasLoc = rutas.filter(r => r.localidades.includes(l.nombre))
                const ocsSet = new Set(ocs.filter(o => o.selected).map(o => o.numero))
                const prodSet = new Set(productos.filter(p => p.selected).map(p => p.sap))
                const puntosLoc = Array.from(new Set(rawRows.filter(r => ocsSet.has(r.oc) && prodSet.has(r.sap) && r.localidad === l.nombre).map(r => r.punto))).sort()
                return (
                  <div key={l.nombre} className="wizard-ruta-detail">
                    <div className="wizard-ruta-detail-head">
                      <h4>{l.nombre}</h4>
                      <div className="wizard-ruta-detail-meta">{l.numRutas} ruta(s) — {puntosLoc.length} colegios — {fmtN(l.cantidad)} und</div>
                    </div>
                    <div className="wizard-localidad-block">
                      {puntosLoc.map(punto => {
                        const c = colegios[punto]
                        const asignado = colegiosAsignados[punto]
                        const sugerido = puntosSugeridos.has(punto)
                        return (
                          <div key={punto} className="wizard-col-row">
                            <div><b>{punto}</b> — {c ? c.nombre : '?'}</div>
                            <div className="wizard-col-select-wrap">
                              <select
                                className={sugerido ? 'sugerida-historico' : ''}
                                value={asignado || ''}
                                onChange={e => asignarColegio(punto, e.target.value)}
                                onBlur={() => marcarConfirmado(punto)}
                              >
                                <option value="">— Sin asignar —</option>
                                {rutasLoc.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                              </select>
                              {sugerido && <span className="wizard-sugerida-hint">⚡ sugerido de la última asignación</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(4)}>← Zonas y Rutas</button>
                <button className="btn-primary" onClick={confirmDistribucion}>Continuar →</button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3>Asignar conductor y placa por ruta</h3>
              {!rutas.length && <div className="form-error-banner">No hay rutas armadas.</div>}
              {rutas.map(r => {
                const stats = getStatsRuta(r)
                return (
                  <div key={r.id} className="wizard-ruta-card">
                    <div className="wizard-ruta-card-head">
                      <input type="text" className="wizard-ruta-nombre" value={r.nombre} onChange={e => updateRuta(r.id, { nombre: e.target.value })} />
                      <div className="wizard-ruta-locs">{r.localidades.join(' · ')}</div>
                    </div>
                    <div className="wizard-ruta-stats">
                      <div className="wizard-st"><b>{stats.localidades}</b><span>Locs</span></div>
                      <div className="wizard-st"><b>{stats.ptos}</b><span>Ptos</span></div>
                      <div className="wizard-st"><b>{fmtN(stats.cant)}</b><span>Und</span></div>
                      <div className="wizard-st"><b>{fmtN(stats.canast)}</b><span>Canast</span></div>
                    </div>
                    <div className="wizard-ruta-inputs">
                      <div className="form-group">
                        <label>Conductor</label>
                        <input type="text" value={r.conductor} placeholder="Nombre del conductor" onChange={e => updateRuta(r.id, { conductor: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Placa</label>
                        <input type="text" value={r.placa} placeholder="Placa del vehículo" onChange={e => updateRuta(r.id, { placa: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Fecha de despacho</label>
                        <input type="date" value={r.fechaDespacho || ''} onChange={e => updateRuta(r.id, { fechaDespacho: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(localidades.some(l => l.selected && l.numRutas > 1) ? 5 : 4)}>← Atrás</button>
                <button className="btn-primary" onClick={confirmConductores}>Continuar →</button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div>
              <h3>Parámetros generales</h3>
              <div className="wizard-config-card">
                <div className="wizard-config-row">
                  <div className="form-group">
                    <label>Número inicial de remisión</label>
                    <input type="number" min="1" value={config.nroInicio} onChange={e => setConfig(c => ({ ...c, nroInicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de emisión</label>
                    <input type="date" value={config.fechaEmision} onChange={e => setConfig(c => ({ ...c, fechaEmision: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de entrega</label>
                    <input type="date" value={config.fechaEntrega} onChange={e => setConfig(c => ({ ...c, fechaEntrega: e.target.value }))} />
                  </div>
                </div>
              </div>

              <h3 style={{ marginTop: 20 }}>Rutas listas para generar</h3>
              {rutas.map(r => {
                const stats = getStatsRuta(r)
                const filas = getFilasRuta(r)
                const colegiosCount = new Set(filas.map(f => f.punto)).size
                return (
                  <div key={r.id} className="wizard-ruta-card">
                    <div className="wizard-ruta-card-head">
                      <div className="wizard-ruta-nombre-static">{r.nombre}</div>
                      <div className="wizard-ruta-locs">
                        {r.conductor || <span style={{ color: '#c0392b' }}>Sin conductor</span>} · {r.placa || <span style={{ color: '#c0392b' }}>Sin placa</span>}
                      </div>
                    </div>
                    <div className="wizard-ruta-stats">
                      <div className="wizard-st"><b>{colegiosCount}</b><span>Remisiones</span></div>
                      <div className="wizard-st"><b>{fmtN(stats.cant)}</b><span>Und</span></div>
                      <div className="wizard-st"><b>{fmtN(stats.canast)}</b><span>Canast</span></div>
                    </div>
                    <button className="btn-primary" onClick={() => verRuta(r.id)}>👁 Ver / Imprimir</button>
                  </div>
                )
              })}

              <div className="page-toolbar spread">
                <button className="btn-secondary" onClick={() => setStep(6)}>← Conductores</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" onClick={reiniciarTodo}>↻ Nueva OC</button>
                  <button className="btn-primary" onClick={verTodasRutas}>🖨 Ver / Imprimir TODAS las rutas</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {preview && (
        <LogisticaWizardPrint
          titulo={preview.titulo}
          datos={preview.datos}
          colegios={colegios}
          config={config}
          rutasIndex={rutasIndex}
          onClose={() => setPreview(null)}
        />
      )}

      {modalDirectorioAbierto && (
        <LogisticaDirectorioModal
          colegiosFaltantes={Object.values(colegios).filter(c => !c.enDirectorio).map(c => ({
            punto: c.punto,
            institucion: c.nombre,
            sitioEntrega: c.sitioEntrega,
            localidad: c.localidad,
          }))}
          onClose={() => setModalDirectorioAbierto(false)}
          onSaved={handleDirectorioGuardado}
        />
      )}
    </div>
  )
}
