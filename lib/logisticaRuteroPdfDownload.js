'use client'

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { RuteroPage } from '../components/LogisticaWizardPrint'
import { RuteroPageAmPmSinHorno, RuteroPageAmPmConHorno } from '../components/RuteroPageAmPm'
import { filasNoAmPm, separarAmPmPorHorno } from './logisticaEmpaqueAmpm'

// Carta horizontal. La página del rutero ya trae sus márgenes de 8 mm como
// padding y su contenido escalado para caber en 1 hoja (ver RuteroPage).
const PAGE_W = 279.4
const PAGE_H = 215.9

function slugRuta(nombre) {
  return (nombre || 'ruta')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nombreArchivo(nombreRuta, fechaISO) {
  const fecha = (fechaISO || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  return `ruteros-${slugRuta(nombreRuta)}-${fecha}.pdf`
}

// Renderiza un elemento React (RuteroPage o una variante) en un contenedor
// fuera de pantalla, para capturarlo con html2canvas sin duplicar la
// lógica visual del rutero.
async function renderOffscreen(element) {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '-10000px'
  host.style.zIndex = '-1'
  document.body.appendChild(host)
  const root = createRoot(host)
  await new Promise(resolve => {
    root.render(element)
    // doble rAF: asegura que el layout/paint ya corrió antes de capturar
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
  // RuteroPage puede renderizar antes un aviso solo de pantalla: se captura
  // únicamente la hoja del rutero.
  const node = host.querySelector('.wizard-print-page') || host.firstElementChild
  return {
    node,
    cleanup: () => { root.unmount(); host.remove() },
  }
}

// Captura `node` (una hoja de rutero) y la agrega como UNA sola página al
// `doc` ya abierto, ajustada al tamaño carta sin deformarla. Nunca se parte
// en tajadas: cada rutero ocupa exactamente una hoja.
async function agregarNodoAPdf(doc, node, esPrimeraPaginaDelDoc) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
  const ratio = Math.min(PAGE_W / canvas.width, PAGE_H / canvas.height)
  const w = canvas.width * ratio
  const h = canvas.height * ratio
  if (!esPrimeraPaginaDelDoc) doc.addPage('letter', 'landscape')
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', (PAGE_W - w) / 2, 0, w, h)
}

// Arma los elementos React de las páginas de rutero de una ruta: la página
// normal (panadería/gastronomía) más, cuando aplica, las 2 páginas AM-PM
// (parafinado+bolsa para colegios sin horno, parafinado para colegios con
// horno). Si la ruta no tiene ninguna fila, se conserva el fallback de
// "Sin colegios asignados" de RuteroPage.
function paginasRuteroDe({ ruta, filas, colegios, fechaEntrega }) {
  const filasSinAmPm = filasNoAmPm(filas)
  const { conHorno, sinHorno } = separarAmPmPorHorno(filas, colegios)
  const props = { ruta, colegios, fechaEntrega }

  if (!filasSinAmPm.length && !sinHorno.length && !conHorno.length) {
    return [createElement(RuteroPage, { ...props, filas })]
  }

  const paginas = []
  if (filasSinAmPm.length) paginas.push(createElement(RuteroPage, { ...props, filas: filasSinAmPm }))
  if (sinHorno.some(f => f.cantidad > 0)) paginas.push(createElement(RuteroPageAmPmSinHorno, { ...props, filas }))
  if (conHorno.some(f => f.cantidad > 0)) paginas.push(createElement(RuteroPageAmPmConHorno, { ...props, filas }))
  return paginas
}

// items: [{ ruta, filas, colegios, fechaEntrega }]
// Devuelve { ok: [nombreRuta], fallidos: [nombreRuta] }
export async function descargarRuterosPdf(items, { onProgress } = {}) {
  const resultado = { ok: [], fallidos: [] }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress?.(i + 1, items.length, item.ruta.nombre)
    const paginas = paginasRuteroDe(item)
    let doc = null
    let esPrimeraPagina = true
    let ok = true
    for (const pagina of paginas) {
      let cleanup
      try {
        const { node, cleanup: limpiar } = await renderOffscreen(pagina)
        cleanup = limpiar
        if (!doc) doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape', compress: true })
        await agregarNodoAPdf(doc, node, esPrimeraPagina)
        esPrimeraPagina = false
      } catch (err) {
        console.error('No se pudo generar una página del rutero', item.ruta.nombre, err)
        ok = false
      } finally {
        cleanup?.()
      }
    }
    if (ok && doc) {
      doc.save(nombreArchivo(item.ruta.nombre, item.fechaEntrega))
      resultado.ok.push(item.ruta.nombre)
    } else {
      resultado.fallidos.push(item.ruta.nombre)
    }
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 350))
  }
  return resultado
}
