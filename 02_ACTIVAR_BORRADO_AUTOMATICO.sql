-- 1. En Supabase Dashboard -> Integrations -> Cron, activar Supabase Cron si aún no lo está.
-- 2. Ejecutar este archivo en SQL Editor. Una tarea elimina mensajes vencidos cada minuto.
select cron.schedule(
  'brisa_borrar_mensajes_caducados',
  '* * * * *',
  $$ select public.brisa_cleanup(); $$
);
-- Comprobar en Integrations -> Cron -> Jobs.
-- Los mensajes dejan de verse exactamente a los 10 minutos, y el borrado físico
-- ocurre durante el siguiente ciclo (como máximo aproximadamente 1 minuto después).
