-- =====================================================
-- MIGRACIÓN: ELIMINAR DATA MAESTRA DE MENÚS DE REFORZADOS
-- Ejecutada 2026-10-01 (proyecto uojictiomkacldcvhcku).
--
-- Los menús de Reforzados vienen del Excel de Ciclos (hoja
-- "COMPLEMENTOS REFORZADOS") y viven en reforzados_ciclo_dias
-- (menu_numero + componentes). La tarjeta "Menús" se quitó en
-- el commit 4aca7be; ningún código lee estas tablas.
--
-- reforzados_menus tenía 10 filas; reforzados_menu_items 0.
-- reforzados_menus_backup es un respaldo TEMPORAL. Copia
-- adicional en JSON fuera del repo:
--   C:\Users\petro\backups\reforzados_menus_2026-10-01.json
--
-- NO se tocan ciclos_menu ni menu_ciclos (sin prefijo, de
-- otro flujo del proyecto Supabase compartido).
-- =====================================================

-- ============ RESPALDO ============
CREATE TABLE reforzados_menus_backup AS SELECT * FROM reforzados_menus;
ALTER TABLE reforzados_menus_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_reforzados_menus_backup ON reforzados_menus_backup
  FOR ALL TO public USING (true) WITH CHECK (true);

-- ============ BORRADO ============
DROP TABLE reforzados_menu_items;
DROP TABLE reforzados_menus;
