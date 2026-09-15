'use client'

import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { readFileAsArrayBuffer } from '../lib/parseRutasExcel'
import { parsearExcelDirectorio, construirPreviewDirectorio } from '../lib/logisticaDirectorioImport'

export default function LogisticaDirectorioExcelModal({ onClose, onImported }) {
  const [estado, setEstado] = useState('inicial')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [colegiosDetectados, setColegiosDetectados] = useState([])
  const [preview, setPreview] = useState(null)
  const [resultadoExito, setResultadoExito] = useState(null)
  const fileInputRef = useRef(null)

  function resetear() {
    setEstado('inicial')
    setErrorMsg('')
    setArchivoNombre('')
    setColegiosDetectados([])
    setPreview(null)
    setResultadoExito(null)
  }

  async function procesarArchivo(file) {
    setEstado('parseando')
    setErrorMsg('')
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const parsed = parsearExcelDirectorio(buffer)
      if (parsed.colegios.length === 0) throw new Error('El archivo no contiene colegios válidos para importar.')

      const { data: sitiosData, error: sitiosError } = await supabase
        .from('logistica_sitios')
        .select('punto_wms, bodega, cebe_sap, dane_12, dane_12_sede, nombre_institucion, nombre_sitio, cod_localidad, localidad, direccion')
      if (sitiosError) throw new Error('No se pudieron consultar los sitios existentes.')

      const previewResult = construirPreviewDirectorio(parsed.colegios, sitiosData || [])

      setArchivoNombre(file.name)
      setColegiosDetectados(parsed.colegios)
      setPreview(previewResult)
      setEstado('preview')
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo procesar el archivo.')
      setEstado('error')
    }
  }

  function handleFileSelected(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setErrorMsg('Solo se aceptan archivos .xlsx')
      setEstado('error')
      return
    }
    procesarArchivo(file)
  }

  function handleDragOver(e) { e.preventDefault(); setDragActive(true) }
  function handleDragLeave(e) { e.preventDefault(); setDragActive(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFileSelected(e.dataTransfer.files?.[0])
  }
  function handleInputChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    handleFileSelected(file)
  }

  async function aplicarCambios() {
    setEstado('confirmando')
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('logistica_sitios')
        .upsert(preview.filasParaGuardar, { onConflict: 'punto_wms' })
      if (error) throw new Error('No se pudo aplicar el directorio. No se modificó ningún registro.')

      setResultadoExito({
        actualizados: preview.actualizaciones.length,
        insertados: preview.inserciones.length,
      })
      setEstado('exito')
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo aplicar el directorio.')
      setEstado('error')
    }
  }

  const cerrable = estado !== 'parseando' && estado !== 'confirmando'

  return (
    <div className="modal-overlay" onClick={cerrable ? onClose : undefined}>
      <div className="modal-box modal-box-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Cargar directorio desde Excel</div>

        {estado === 'inicial' && (
          <div
            className={`dropzone ${dragActive ? 'dropzone-highlight' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <div className="dropzone-icon">📚</div>
            <div className="dropzone-text">Arrastra el Excel del directorio de colegios o haz clic para seleccionar</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {estado === 'parseando' && (
          <div className="empty-state"><p>Leyendo archivo Excel...</p></div>
        )}

        {estado === 'confirmando' && (
          <div className="empty-state"><p>Aplicando cambios...</p></div>
        )}

        {estado === 'error' && (
          <>
            <div className="form-error-banner">{errorMsg}</div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={onClose}>Cerrar</button>
              <button className="btn-primary" onClick={resetear}>🔄 Reintentar</button>
            </div>
          </>
        )}

        {estado === 'exito' && resultadoExito && (
          <>
            <div className="logistica-exito-box">
              ✓ Directorio actualizado: {resultadoExito.actualizados} actualizados, {resultadoExito.insertados} insertados. Ningún colegio fue borrado.
            </div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={resetear}>📚 Cargar otro archivo</button>
              <button className="btn-primary" onClick={onImported}>✓ Listo</button>
            </div>
          </>
        )}

        {estado === 'preview' && preview && (
          <>
            <div className="modal-hint">
              <strong>Archivo:</strong> {archivoNombre}<br />
              <strong>{colegiosDetectados.length} colegios detectados en el archivo.</strong>
            </div>

            <div className="rem-stats-row">
              <div className="rem-stat-card">
                <div className="rem-stat-num">{preview.actualizaciones.length}</div>
                <div className="rem-stat-label">Colegios se ACTUALIZARÁN (ya existen por PUNTO WMS)</div>
              </div>
              <div className="rem-stat-card">
                <div className="rem-stat-num">{preview.inserciones.length}</div>
                <div className="rem-stat-label">Colegios se INSERTARÁN (nuevos)</div>
              </div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Punto WMS</th>
                    <th>Institución educativa</th>
                    <th>Sitio de entrega</th>
                    <th>Cod. localidad</th>
                    <th>Localidad</th>
                    <th>Dirección</th>
                  </tr>
                </thead>
                <tbody>
                  {colegiosDetectados.slice(0, 10).map(c => (
                    <tr key={c.punto_wms}>
                      <td className="logistica-mono">{c.punto_wms}</td>
                      <td>{c.nombre_institucion}</td>
                      <td>{c.nombre_sitio || '-'}</td>
                      <td>{c.cod_localidad || '-'}</td>
                      <td>{c.localidad || '-'}</td>
                      <td>{c.direccion || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {colegiosDetectados.length > 10 && (
              <p className="modal-hint">Mostrando 10 de {colegiosDetectados.length} colegios detectados.</p>
            )}

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button className="btn-secondary" onClick={resetear}>✕ Cancelar</button>
              <button className="btn-primary" onClick={aplicarCambios}>💾 Aplicar cambios</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
