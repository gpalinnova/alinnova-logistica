import * as XLSX from 'xlsx'

const HEADERS = ['CONDUCTOR', 'AUXILIAR', 'PLACA', 'CARGUE ALINNOVA', 'ID SITIO ENTREGA', 'ORDEN ENTREGA', 'HORARIO ENTREGA ALINNOVA']

const EJEMPLOS = [
  ['JUAN PEREZ', 'PEDRO GOMEZ', 'ABC 123', '5:30 a.m.', '12345', '1', '10:00 a.m.'],
  ['JUAN PEREZ', 'PEDRO GOMEZ', 'ABC 123', '5:30 a.m.', '12346', '2', '10:40 a.m.'],
]

export function descargarPlantillaRutas() {
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...EJEMPLOS])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rutas')
  XLSX.writeFile(workbook, 'plantilla_rutas_maestro.xlsx')
}
