'use client'

import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { RuteroPage } from '../components/LogisticaWizardPrint'

const PAGE_W = 297
const PAGE_H = 210

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

// Renderiza RuteroPage (el mismo componente que usa la vista de impresión) en
// un contenedor fuera de pantalla, para capturarlo con html2canvas sin
// duplicar la lógica visual del rutero.
async function renderRuteroOffscreen(props) {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '-10000px'
  host.style.zIndex = '-1'
  document.body.appendChild(host)
  const root = createRoot(host)
  await new Promise(resolve => {
    root.render(createElement(RuteroPage, props))
    // doble rAF: asegura que el layout/paint ya corrió antes de capturar
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
  const node = host.firstElementChild
  return {
    node,
    cleanup: () => { root.unmount(); host.remove() },
  }
}

async function nodoAPdf(node) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'landscape', compress: true })
  const pxPerMm = canvas.width / PAGE_W
  const pageHeightPx = Math.floor(PAGE_H * pxPerMm)

  let y = 0
  let primera = true
  while (y < canvas.height) {
    const sliceH = Math.min(pageHeightPx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    if (!primera) doc.addPage([PAGE_W, PAGE_H], 'landscape')
    doc.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W, sliceH / pxPerMm)
    y += sliceH
    primera = false
  }
  return doc
}

// items: [{ ruta, filas, colegios, fechaEntrega }]
// Devuelve { ok: [nombreRuta], fallidos: [nombreRuta] }
export async function descargarRuterosPdf(items, { onProgress } = {}) {
  const resultado = { ok: [], fallidos: [] }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    onProgress?.(i + 1, items.length, item.ruta.nombre)
    let cleanup
    try {
      const { node, cleanup: limpiar } = await renderRuteroOffscreen({
        ruta: item.ruta,
        filas: item.filas,
        colegios: item.colegios,
        fechaEntrega: item.fechaEntrega,
      })
      cleanup = limpiar
      const doc = await nodoAPdf(node)
      doc.save(nombreArchivo(item.ruta.nombre, item.fechaEntrega))
      resultado.ok.push(item.ruta.nombre)
    } catch (err) {
      console.error('No se pudo generar el PDF del rutero', item.ruta.nombre, err)
      resultado.fallidos.push(item.ruta.nombre)
    } finally {
      cleanup?.()
    }
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 350))
  }
  return resultado
}
