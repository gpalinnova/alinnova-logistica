# Reglas del proyecto Control Logística

## Stack
- Next.js 16 con JavaScript plano (NO TypeScript)
- CSS global custom en `app/globals.css` (NO Tailwind, NO shadcn)
- Supabase JS client desde `lib/supabase.js`
- Deploy automático en Vercel al hacer push a `main`
- Proyecto Supabase compartido con alinnova-turnos

## Reglas de trabajo obligatorias

### Al terminar CUALQUIER tarea que modifique código:
1. Correr `npm run build` para validar. Si falla, corregir antes de seguir.
2. Ejecutar SIEMPRE en este orden sin preguntar al usuario:
   - `git add .`
   - `git commit -m "tipo: descripción corta"`
   - `git push origin main`
3. Después del push, ejecutar `git log --oneline -1` y confirmar textualmente al usuario que el commit está en `origin/main`.
4. Nunca terminar una tarea diciendo "falta el commit" o "confirma el push". El push es parte de la tarea, no un paso opcional.

### Convenciones de commit:
- `feat:` para funcionalidad nueva
- `fix:` para arreglos de bugs
- `chore:` para limpieza o cambios de estructura
- `style:` para cambios cosméticos/UI
- `docs:` para documentación

### Migraciones de Supabase:
- Ejecutar las migraciones ANTES del commit, no dejarlas como pendientes.
- Verificar en la base que la tabla existe y tiene los datos esperados.
- Confirmar textualmente al usuario los cambios en la base.

### Al preguntar algo al usuario a mitad de una tarea:
- Al recibir la respuesta, RETOMAR SIEMPRE la lista de tareas pendientes.
- Nunca terminar solo respondiendo la pregunta; hay que continuar con lo que quedaba.

### Al final de cada tarea, entregar SIEMPRE este resumen:
- Archivos modificados o creados (lista)
- Cambios en Supabase (tablas, filas, políticas)
- Estado del push: hash del commit + confirmación explícita "push a origin/main ejecutado con éxito"
- Qué queda pendiente para la siguiente tarea (si aplica)

### Estilo de código y UI:
- Nombres de tablas Supabase con prefijo del área: `reforzados_*`, `panaderia_*`, `gastronomia_*`.
- IDs siempre UUID (`gen_random_uuid()`).
- Todas las tablas con RLS habilitado y política ALL para public (mismo patrón que las tablas existentes).
- Los nombres visibles al usuario van en español.
- Los emojis en labels van al inicio del texto.
- Reutilizar clases existentes de globals.css antes de crear nuevas.
