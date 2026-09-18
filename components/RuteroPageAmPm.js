'use client'

import { RuteroPage } from './LogisticaWizardPrint'
import { separarAmPmPorHorno, productosUnicos, tituloRuteroAmPm, nombreRutaSinPrefijoH } from '../lib/logisticaEmpaqueAmpm'

// Rutero AM-PM parafinado + bolsa: solo colegios SIN horno.
export function RuteroPageAmPmSinHorno({ ruta, filas, colegios, fechaEntrega }) {
  const { sinHorno } = separarAmPmPorHorno(filas, colegios)
  const titulo = tituloRuteroAmPm(productosUnicos(sinHorno), { parafinado: false })
  return (
    <RuteroPage
      ruta={ruta}
      filas={sinHorno}
      colegios={colegios}
      fechaEntrega={fechaEntrega}
      tituloOverride={titulo}
      nombreRutaOverride={nombreRutaSinPrefijoH(ruta.nombre)}
    />
  )
}

// Rutero AM-PM solo parafinado: solo colegios CON horno.
export function RuteroPageAmPmConHorno({ ruta, filas, colegios, fechaEntrega }) {
  const { conHorno } = separarAmPmPorHorno(filas, colegios)
  const titulo = tituloRuteroAmPm(productosUnicos(conHorno), { parafinado: true })
  return (
    <RuteroPage
      ruta={ruta}
      filas={conHorno}
      colegios={colegios}
      fechaEntrega={fechaEntrega}
      tituloOverride={titulo}
      nombreRutaOverride={nombreRutaSinPrefijoH(ruta.nombre)}
    />
  )
}
