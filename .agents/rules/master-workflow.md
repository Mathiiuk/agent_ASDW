---
name: "director-tecnico"
type: "workflow-orchestrator"
description: "Regla Maestra de Flujo de Trabajo Autónomo de Bucle Cerrado (Director Técnico)"
activation:
  global: true
  triggers:
    - "on_task_assigned"
    - "on_chat_start"
    - "on_goal_requested"
---

# Regla Maestra de Flujo de Trabajo Autónomo (Director Técnico)

Toda tarea o desarrollo en el proyecto debe seguir obligatoriamente este marco metodológico de **bucle cerrado y auto-reparación** de principio a fin sin detenerse a solicitar aprobaciones intermedias innecesarias cuando el objetivo ya fue definido.

---

## 1. Stack de Skills y Herramientas Integradas

1. **`software-delivery-workflow` (DT / Director Técnico)**:
   - Toda tarea debe tener sus 5 artefactos en `.agents/workflow/`: `tasks/<ID>.yml`, `specs/<ID>.md`, `plans/<ID>.md`, `tests/<ID>.md`, `features/<ID>.feature` y su reporte de cierre en `executions/<ID>.md`.
2. **`bdd-spec-writer`**:
   - Redacción de criterios de aceptación ejecutables en Gherkin (inglés con comentarios en español) validados mediante Cucumber (`pnpm test:bdd`).
3. **`tdd-workflow` & `spec-to-plan`**:
   - Desarrollo guiado por pruebas unitarias (`pnpm test` con Vitest) con alta cobertura y código documentado en español para aprendizaje.
4. **`security-guardian` & `auth-implementation-patterns`**:
   - Arquitectura Zero Trust, sin secretos en repositorios o manifests y permisos estrictos.

---

## 2. Ciclo de Ejecución de Tareas y Ramas

1. **Creación de Tarea:** Ejecutar `agt task:new <ID> -t "Título" --type <tipo>` para inicializar los 5 artefactos y crear/conmutar a la rama `<tipo>/<ID>-<slug>`.
2. **Implementación TDD / BDD:** Escribir pruebas y código comentado en español línea por línea.
3. **Quality Gates Obligatorios:**
   - `pnpm test` (Unit Tests con Vitest)
   - `pnpm test:bdd` (Escenarios BDD con Cucumber)
   - `agt task:verify <ID>`
4. **Cierre de Tarea:** Generar `.agents/workflow/executions/<ID>.md`, actualizar estado a `READY_FOR_PR` / `DONE` y commitear con mensaje semántico explicativo.

---

## 3. Directivas de Automatización de Bucle Cerrado (Sin Pausas de Aprobación)

Cuando el usuario asigne un requerimiento, el agente debe ejecutar las siguientes acciones de forma **ininterrumpida**:

1. **Inicialización Inmediata:** Crear la tarea y la rama Git mediante `agt task:new` o las funciones correspondientes.
2. **Codificación & Pruebas:** Desarrollar los tests (`tests/`, `tests/bdd/steps/`) y la funcionalidad en `src/`.
3. **Ejecución de Quality Gates:** Ejecutar las pruebas en la terminal (`pnpm test`, `pnpm test:bdd`, `agt task:verify <ID>`).
4. **Auto-Corrección Continua (Self-Healing Loop):**
   - Si algún comando o prueba falla, leer detalladamente el stack trace y los logs de error.
   - Diagnosticar la causa raíz y aplicar el parche de código de forma autónoma.
   - Re-ejecutar las pruebas en bucle hasta que **el 100% de los checks estén en verde**.
5. **Cierre y Notificación:** Crear el reporte de ejecución en `.agents/workflow/executions/<ID>.md` y presentar el resumen final al usuario con evidencia de que todos los tests pasaron.
