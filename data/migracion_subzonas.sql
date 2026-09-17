-- =====================================================
-- MIGRACIÓN: RUTEO POR SUBZONAS (Fase 1)
-- Crea las tablas de grupos de ruteo, subzonas, y agrega
-- la columna subzona_codigo a la tabla de sitios.
--
-- OJO (ejecutado 2026-09-17): el mapeo punto_wms del CSV
-- corresponde a logistica_sitios (directorio general de
-- Logística, 242 sitios), NO a reforzados_sitios (29 sitios,
-- id_sitio_entrega sin relación con punto_wms). Por eso el
-- catálogo de subzonas/grupos de ruteo vive con prefijo
-- `logistica_` — es un catálogo geográfico compartido, no
-- exclusivo de Reforzados. reforzados_sitios no se tocó.
-- =====================================================

-- ============ TABLA: logistica_grupos_ruteo ============
-- Un grupo de ruteo = una localidad o un conjunto fusionado.
-- Guarda el prefijo que aparece en el rutero ("BOSA", "KENNEDY")
-- y los umbrales de partición en JSONB (editables desde la app).

CREATE TABLE IF NOT EXISTS logistica_grupos_ruteo (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                TEXT        UNIQUE NOT NULL,
  nombre_mostrar        TEXT        NOT NULL,
  prefijo_ruta          TEXT        NOT NULL,      -- 'BOSA', 'KENNEDY', 'CENTRO'
  max_subzonas          INT         NOT NULL DEFAULT 1,
  umbrales              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  destino_fijo          TEXT,                       -- 'CEDI Celta Park' para Sumapaz
  carro_dedicado        BOOLEAN     NOT NULL DEFAULT FALSE,
  orden                 INT         NOT NULL DEFAULT 0,
  activo                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE logistica_grupos_ruteo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON logistica_grupos_ruteo
  FOR ALL USING (true) WITH CHECK (true);

-- Estructura esperada del JSONB `umbrales`:
-- [
--   {"max_sitios": 14, "asignaciones": [[1,2,3]]},   -- 1 ruta = todas las subzonas
--   {"max_sitios": 25, "asignaciones": [[1,2],[3]]}, -- 2 rutas
--   {"max_sitios": 999,"asignaciones": [[1],[2],[3]]} -- 3 rutas
-- ]
-- Cada array interior es una lista de "orden_dentro_grupo" de subzonas.

-- ============ TABLA: logistica_subzonas ============
-- Una subzona = una porción geográfica dentro de un grupo de ruteo.
-- La ruta se etiqueta como "prefijo N" donde N = índice de la asignación.

CREATE TABLE IF NOT EXISTS logistica_subzonas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                TEXT        UNIQUE NOT NULL,
  nombre_mostrar        TEXT        NOT NULL,
  grupo_ruteo_codigo    TEXT        NOT NULL REFERENCES logistica_grupos_ruteo(codigo)
                                    ON UPDATE CASCADE ON DELETE RESTRICT,
  orden_dentro_grupo    INT         NOT NULL DEFAULT 1,
  activo                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE logistica_subzonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON logistica_subzonas
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ix_logistica_subzonas_grupo
  ON logistica_subzonas(grupo_ruteo_codigo, orden_dentro_grupo);

-- ============ AJUSTE: agregar subzona_codigo a logistica_sitios ============

ALTER TABLE logistica_sitios
  ADD COLUMN IF NOT EXISTS subzona_codigo TEXT
    REFERENCES logistica_subzonas(codigo)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_logistica_sitios_subzona
  ON logistica_sitios(subzona_codigo);


-- ============ SEEDS: logistica_grupos_ruteo ============

INSERT INTO logistica_grupos_ruteo
  (codigo, nombre_mostrar, prefijo_ruta, max_subzonas, umbrales,
   destino_fijo, carro_dedicado, orden)
VALUES
  ('BOSA', 'Bosa', 'BOSA', 3,
    '[
      {"max_sitios": 14, "asignaciones": [[1,2,3]]},
      {"max_sitios": 25, "asignaciones": [[1,2],[3]]},
      {"max_sitios": 999,"asignaciones": [[1],[2],[3]]}
    ]'::jsonb,
    NULL, FALSE, 10),

  ('KENNEDY', 'Kennedy', 'KENNEDY', 3,
    '[
      {"max_sitios": 13, "asignaciones": [[1,2,3]]},
      {"max_sitios": 22, "asignaciones": [[1,2],[3]]},
      {"max_sitios": 999,"asignaciones": [[1],[2],[3]]}
    ]'::jsonb,
    NULL, FALSE, 20),

  ('CIUDAD_BOLIVAR', 'Ciudad Bolívar', 'CIUDAD BOLIVAR', 2,
    '[
      {"max_sitios": 13, "asignaciones": [[1,2]]},
      {"max_sitios": 999,"asignaciones": [[1],[2]]}
    ]'::jsonb,
    NULL, FALSE, 30),

  ('USME', 'Usme', 'USME', 2,
    '[
      {"max_sitios": 13, "asignaciones": [[1,2]]},
      {"max_sitios": 999,"asignaciones": [[1],[2]]}
    ]'::jsonb,
    NULL, FALSE, 40),

  ('ENGATIVA', 'Engativá', 'ENGATIVA', 2,
    '[
      {"max_sitios": 13, "asignaciones": [[1,2]]},
      {"max_sitios": 999,"asignaciones": [[1],[2]]}
    ]'::jsonb,
    NULL, FALSE, 50),

  ('SUBA', 'Suba', 'SUBA', 2,
    '[
      {"max_sitios": 13, "asignaciones": [[1,2]]},
      {"max_sitios": 999,"asignaciones": [[1],[2]]}
    ]'::jsonb,
    NULL, FALSE, 60),

  ('SAN_CRISTOBAL', 'San Cristóbal', 'SAN CRISTOBAL', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 70),

  ('RAFAEL_URIBE', 'Rafael Uribe Uribe', 'RAFAEL URIBE', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 80),

  ('USAQUEN', 'Usaquén', 'USAQUEN', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 90),

  ('FONTIBON', 'Fontibón', 'FONTIBON', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 100),

  ('PUENTE_ARANDA', 'Puente Aranda', 'PUENTE ARANDA', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 110),

  ('TUNJUELITO', 'Tunjuelito', 'TUNJUELITO', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 120),

  ('CENTRO', 'Centro (Santa Fe + Mártires + Candelaria + Teusaquillo)',
    'CENTRO', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 130),

  ('NORTE_CENTRAL', 'Norte Central (Barrios Unidos + Chapinero)',
    'NORTE CENTRAL', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 140),

  ('ANTONIO_NARINO', 'Antonio Nariño', 'ANTONIO NARINO', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb, NULL, FALSE, 150),

  ('SUMAPAZ', 'Sumapaz → Celta Park', 'SUMAPAZ', 1,
    '[{"max_sitios": 999, "asignaciones": [[1]]}]'::jsonb,
    'CEDI Celta Park', TRUE, 160)
ON CONFLICT (codigo) DO NOTHING;


-- ============ SEEDS: logistica_subzonas ============

INSERT INTO logistica_subzonas
  (codigo, nombre_mostrar, grupo_ruteo_codigo, orden_dentro_grupo)
VALUES
  -- BOSA (3)
  ('BOSA_NORTE',       'Bosa Norte',       'BOSA', 1),
  ('BOSA_CENTRAL',     'Bosa Central',     'BOSA', 2),
  ('BOSA_OCCIDENTE',   'Bosa Occidente',   'BOSA', 3),

  -- KENNEDY (3)
  ('KENNEDY_CENTRAL',  'Kennedy Central',  'KENNEDY', 1),
  ('KENNEDY_OCCIDENTE','Kennedy Occidente','KENNEDY', 2),
  ('KENNEDY_SUR',      'Kennedy Sur',      'KENNEDY', 3),

  -- CIUDAD BOLIVAR (2)
  ('CB_ORIENTAL',      'Ciudad Bolívar Oriental',   'CIUDAD_BOLIVAR', 1),
  ('CB_OCCIDENTAL',    'Ciudad Bolívar Occidental', 'CIUDAD_BOLIVAR', 2),

  -- USME (2)
  ('USME_NORTE',       'Usme Norte',       'USME', 1),
  ('USME_SUR',         'Usme Sur',         'USME', 2),

  -- ENGATIVA (2)
  ('ENG_ORIENTAL',     'Engativá Oriental',     'ENGATIVA', 1),
  ('ENG_OCCIDENTAL',   'Engativá Occidental',   'ENGATIVA', 2),

  -- SUBA (2)
  ('SUBA_ORIENTAL',    'Suba Oriental',    'SUBA', 1),
  ('SUBA_OCCIDENTAL',  'Suba Occidental',  'SUBA', 2),

  -- Localidades de una sola subzona
  ('SAN_CRISTOBAL',    'San Cristóbal',    'SAN_CRISTOBAL', 1),
  ('RAFAEL_URIBE',     'Rafael Uribe Uribe','RAFAEL_URIBE', 1),
  ('USAQUEN',          'Usaquén',          'USAQUEN', 1),
  ('FONTIBON',         'Fontibón',         'FONTIBON', 1),
  ('PUENTE_ARANDA',    'Puente Aranda',    'PUENTE_ARANDA', 1),
  ('TUNJUELITO',       'Tunjuelito',       'TUNJUELITO', 1),

  -- Fusiones
  ('CENTRO',           'Centro (fusión)',  'CENTRO', 1),
  ('NORTE_CENTRAL',    'Norte Central (fusión)','NORTE_CENTRAL', 1),
  ('ANTONIO_NARINO',   'Antonio Nariño',   'ANTONIO_NARINO', 1),

  -- Sumapaz
  ('SUMAPAZ_CELTA',    'Sumapaz → Celta Park', 'SUMAPAZ', 1)
ON CONFLICT (codigo) DO NOTHING;
