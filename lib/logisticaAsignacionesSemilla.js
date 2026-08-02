// Asignaciones semilla derivadas del Excel de rutas por carro.
// Cada entrada: [nombre_del_colegio_en_imagen, sub_ruta_dentro_de_la_localidad]
// La sub_ruta 1 = azul en BOSA / rojo en las demás; sub_ruta 2 = rojo en BOSA / sin color en las demás; sub_ruta 3 = sin color en BOSA.

export const ASIGNACIONES_SEMILLA = {
  BOSA: [
    // Sub-ruta 1 (AZUL) → BOSA PAN 1 / BOSA AMPM 1 / BOSA GASTRO 1
    ['COL ALFONSO LOPEZ MICHELSEN', 1],
    ['COL CARLOS PIZARRO LEON GOMEZ', 1],
    ['COL CIUDADELA EDUC DE BOSA', 1],
    ['COL CIUDADELA EL RECREO', 1],
    ['COL JORGE ISAACS', 1],
    ['COL JOSE FRANCISCO SOCARRAS', 1],
    ['COL LEONARDO POSADA PEDRAZA', 1],
    ['COL PARQUES DE BOGOTA', 1],
    ['COL PORFIRIO BARBA JACOB', 1],
    ['COL SOLEDAD ACOSTA SAMPER', 1],
    ['COLEGIO ARGELIA', 1],
    // Sub-ruta 2 (ROJO) → BOSA PAN 2
    ['COL BRASILIA BOSA', 2],
    ['COL EL PORVENIR', 2],
    ['COL GERMAN ARCINIEGAS', 2],
    ['COL LAURA HERRERA', 2],
    ['COLEGIO SAN IGNACIO', 2],
    ['COLEGIO VILLAS DEL PROGRESO', 2],
    // Sub-ruta 3 (SIN COLOR) → BOSA PAN 3
    ['COL ALFONSO REYES ECHANDIA', 3],
    ['COL CARLOS ALBAN HOLGUIN', 3],
    ['COL ESMERALDA ARBOLEDA', 3],
    ['COL FERNANDO MAZUERA VILLEGAS', 3],
    ['COL GRAN COLOMBIANO', 3],
    ['COLEGIO BIC INDEPENDENCIA', 3],
    ['COLEGIO CHARLES DE GAULLE', 3],
    ['COLEGIO NUEVO CHILE', 3],
  ],
  USME: [
    // Sub-ruta 1 (ROJO) → USME PAN 1
    ['COL GRAN YOMASA', 1],
    ['COL OFELIA URIBE DE ACOSTA', 1],
    ['COL ORLANDO FALS BORDA', 1],
    ['COL PAULO FREIRE', 1],
    ['COL VALLES DE CAFAM', 1],
    ['COL SANTA LIBRADA', 1],
    ['COL MIRAVALLE', 1],
    ['COLEGIO CIUDAD CHENGDU', 1],
    // Sub-ruta 2 (SIN COLOR) → USME PAN 2
    ['COL CHUNIZA', 2],
    ['COL CIUDAD DE VILLAVICENCIO', 2],
    ['COL EDUARDO UMANA MENDOZA', 2],
    ['COL EL DESTINO', 2],
    ['COL FERNANDO GONZALEZ OCHOA', 2],
    ['COL FRANCISCO ANTONIO ZEA DE USME', 2],
    ['COLEGIO JOSE EUSTASIO RIVERA', 2],
    ['COLEGIO SAN JOSE DE USME', 2],
  ],
  KENNEDY: [
    // Sub-ruta 1 (ROJO) → KENNEDY PAN 1
    ['COL BELLAVISTA', 1],
    ['COL DARIO ECHANDIA', 1],
    ['COL EDUARDO UMANA LUNA', 1],
    ['COL GABRIEL BETANCOURT MEJIA', 1],
    ['COL GUSTAVO ROJAS PINILLA', 1],
    ['COL JACKELINNE', 1],
    ['COL MANUEL CEPEDA VARGAS', 1],
    ['COL RODRIGO DE TRIANA', 1],
    ['COL SALUDCOOP SUR', 1],
    ['COL LAS MARGARITAS', 1],
    ['COLEGIO HERNANDO DURAN DUSSAN', 1],
    ['COL EMMA REYES', 1],
    // Sub-ruta 2 (SIN COLOR) → KENNEDY PAN 2
    ['COL FRANCISCO DE MIRANDA', 2],
    ['COL JOHN F KENNEDY', 2],
    ['COL NICOLAS ESGUERRA', 2],
    ['COL O.E.A', 2],
    ['COL PAULO VI', 2],
    ['COL SAN JOSE', 2],
    ['COL LAS AMERICAS', 2],
    ['COLEGIO MARSELLA', 2],
    ['COLEGIO PROSPERO PINZON', 2],
    ['COLEGIO CARLOS ARANGO VELEZ', 2],
    ['COL VILLA MEJIA', 2],
    ['COLEGIO SAN PEDRO CLAVER', 2],
    ['COLEGIO FELIZA BURSTZTYN', 2],
    ['COLEGIO ELOISA GARZON', 2],
  ],
  'CIUDAD BOLIVAR': [
    // Sub-ruta 1 (ROJO) → CIUDAD BOLIVAR PAN 1
    ['COL ANTONIO GARCIA', 1],
    ['COL EL TESORO DE LA CUMBRE', 1],
    ['COL EL MINUTO DE BUENOS AIRES', 1],
    ['COL FANNY MICKEY', 1],
    ['COL JOSE CELESTINO MUTIS', 1],
    ['COL JOSE JAIME ROJAS', 1],
    ['COL JOSE MARIA VARGAS VILA', 1],
    ['COL RODRIGO LARA BONILLA', 1],
    ['COL CANDELARIA ASPROCADE', 1],
    ['COL LA JOYA', 1],
    ['COLEGIO BUENAVISTA CALASANZ', 1],
    // Sub-ruta 2 (SIN COLOR) → CIUDAD BOLIVAR PAN 2
    ['COL CEDID CIUDAD BOLIVAR', 2],
    ['COL CUNDINAMARCA', 2],
    ['COL GIMNASIO SABIO CALDAS', 2],
    ['COL GUILLERMO CANO ISAZA', 2],
    ['COL LA ESTANCIA', 2],
    ['COL MARIA MERCEDES CARRANZA', 2],
    ['COL SIERRA MORENA', 2],
    ['COL EL ENSUEÑO', 2],
    ['COL ROGELIO SALMONA MADELENA', 2],
    ['COL ANGELA RESTREPO MORENO', 2],
    ['COL EL NOGAL', 2],
    ['COLEGIO ARBORIZADORA ALTA', 2],
    ['COLEGIO AGUDELO RESTREPO', 2],
    ['COLEGIO MARIA CURREA MARTINEZ', 2],
  ],
};

// Función auxiliar para normalizar nombres (sin acentos, mayúsculas, sin (IED), sin puntuación extra).
export function normalizarNombreSitio(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/\(IED\)/g, '')
    .replace(/[.,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
