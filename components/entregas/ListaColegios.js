'use client'

import { useState } from 'react'
import ColegioCard from './ColegioCard'

export default function ListaColegios({ colegios, fecha, idRuta, nombreConductor }) {
  const [openId, setOpenId] = useState(null)

  return (
    <div className="entregas-lista">
      {colegios.map(c => {
        const groupKey = c.sitioIds.join('-')
        return (
          <ColegioCard
            key={groupKey}
            colegio={c}
            fecha={fecha}
            idRuta={idRuta}
            nombreConductor={nombreConductor}
            isOpen={openId === groupKey}
            onToggle={() => setOpenId(current => (current === groupKey ? null : groupKey))}
          />
        )
      })}
    </div>
  )
}
