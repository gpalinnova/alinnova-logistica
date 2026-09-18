-- =====================================================
-- MIGRACIÓN: EMPAQUE AM-PM SEGÚN HORNO (ejecutada 2026-09-18)
-- Distingue, dentro de la modalidad AM-PM, colegios con horno
-- (solo parafinado) de colegios sin horno (parafinado + bolsa).
-- =====================================================

-- ============ AJUSTE: logistica_sitios ============
-- tiene_horno: catálogo fijo mantenido por Alinnova, no viene de la OC.

ALTER TABLE logistica_sitios
  ADD COLUMN IF NOT EXISTS tiene_horno BOOLEAN NOT NULL DEFAULT FALSE;

-- Carga inicial: 82 colegios de Data/mapeo_colegios_con_horno.csv
-- (los 82 matchearon por punto_wms, ninguno quedó sin marcar).

-- ============ AJUSTE: logistica_despachos ============
-- tipo_empaque: trazabilidad del subgrupo de esa fila de historial.
-- Valores por lógica (no CHECK): 'parafinado', 'parafinado_bolsa', NULL
-- (NULL = línea no-AM-PM, panadería/gastronomía, comportamiento actual).

ALTER TABLE logistica_despachos
  ADD COLUMN IF NOT EXISTS tipo_empaque TEXT;

-- La clave única original (fecha_despacho, nombre_ruta, linea) ya no
-- alcanza: una ruta AM-PM mixta (colegios con y sin horno) genera 2 filas
-- de historial para la misma combinación, distinguidas solo por
-- tipo_empaque. SQL trata NULL <> NULL, así que meter tipo_empaque crudo
-- en el unique constraint rompería el dedupe al reimprimir rutas sin
-- AM-PM (cada reimpresión insertaría una fila nueva en vez de actualizar
-- la existente). Se agrega una columna generada que normaliza NULL -> ''
-- solo para esta clave de unicidad/conflicto del upsert.

ALTER TABLE logistica_despachos DROP CONSTRAINT IF EXISTS logistica_despachos_clave_unica;

ALTER TABLE logistica_despachos
  ADD COLUMN IF NOT EXISTS tipo_empaque_clave TEXT GENERATED ALWAYS AS (COALESCE(tipo_empaque, '')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS logistica_despachos_clave_unica
  ON logistica_despachos (fecha_despacho, nombre_ruta, linea, tipo_empaque_clave);
