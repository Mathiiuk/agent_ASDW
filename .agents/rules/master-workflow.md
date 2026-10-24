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

## 1. Departamentos y Roles de la Empresa (`.agents/skills/`)

El agente opera asumiendo los roles especializados según la naturaleza de la tarea:

1. **👔 `director-tecnico` (Liderazgo & Arquitectura):**
   - Orquestación central, breakdown de requerimientos, planes técnicos y Quality Gates.
2. **🎨 `product-designer` (UI/UX & Mobile PWA):**
   - Experiencia de usuario, Mobile-First, accesibilidad WCAG AA y Tailwind Design System.
3. **⚛️ `frontend-engineer` (Ingeniería Frontend):**
   - React 18/19, Next.js, Vite, Custom Hooks, gestión de estado y modularidad.
4. **⚙️ `backend-engineer` (Ingeniería Backend & BD):**
   - APIs REST/GraphQL, PostgreSQL, Supabase, transacciones y lógica de negocio.
5. **🧪 `qa-engineer` (Calidad & Automatización):**
   - BDD con Gherkin (`.feature`) y Cucumber, TDD con Vitest y matrices de prueba.
6. **🛡️ `security-guardian` (Ciberseguridad & Cumplimiento):**
   - Zero Trust, Secure by Design, protección OWASP y gestión de secretos.
7. **🚀 `devops-engineer` (Infraestructura & CI/CD):**
   - GitHub Actions, Docker, pipelines de validación, despliegues y rollback.
8. **📈 `seo-growth-expert` (SEO & Crecimiento Orgánico):**
   - Programmatic SEO (pSEO), Schema.org JSON-LD, Core Web Vitals y OpenGraph.
9. **🪢 `ponytail` (Mínimo cambio completo, transversal):**
   - Se aplica en toda tarea de código junto al rol que corresponda: el cambio más chico que resuelve el problema completo, sin recortar validación, seguridad ni tests. Nivel por defecto `full`; cambia con `/ponytail lite|full|ultra`.

---

## 2. Ciclo de Ejecución de Tareas y Gestión de Ramas

1. **Nuevas Funcionalidades / Módulos (`feat`, `refactor`):**
   - Crear tarea y conmutar a rama dedicada: `agt task:new <ID> -t "Título" --type feat`.
2. **Correcciones, Fixes de CI/CD y Ajustes Menores (`fix`, `docs`, `chore`):**
   - **NO crear una rama nueva.** Mantenerse en la rama activa de trabajo (o en `main`/`staging`) y enviar la corrección mediante commits semánticos directos (`git commit -m "fix(...)"` o `agt task:new <ID> -t "..." --no-branch`).
3. **Implementación TDD / BDD:** Escribir pruebas y código comentado en español línea por línea.
4. **Quality Gates Obligatorios:**
   - `pnpm test` (Unit Tests con Vitest)
   - `pnpm test:bdd` (Escenarios BDD con Cucumber)
   - `agt task:verify <ID>`
5. **Cierre de Tarea:** Generar `.agents/workflow/executions/<ID>.md`, actualizar estado a `READY_FOR_PR` / `DONE` y commitear con mensaje semántico explicativo.

---

## 3. Directivas de Automatización de Bucle Cerrado (Sin Pausas de Aprobación)

Cuando el usuario asigne un requerimiento, el agente debe ejecutar las siguientes acciones de forma **ininterrumpida**:

1. **Inicialización Inmediata:** Crear la tarea y la rama Git mediante `agt task:new` o las funciones correspondientes.
2. **Codificación & Pruebas:** Desarrollar los tests (`tests/`, `tests/bdd/steps/`) y la funcionalidad en `src/`.
3. **Ejecución de Quality Gates:** Ejecutar las pruebas en la terminal (`pnpm test`, `pnpm test:bdd`, `agt task:verify <ID>`) o, si el cliente está conectado por MCP (`agt mcp`), invocar directamente la tool `verify_task_quality_gates`.
4. **Auto-Corrección Continua (Self-Healing Loop):**
   - Invocar la tool MCP `run_self_healing_loop` (o `agt task:loop <ID>` en terminal). Esta herramienta **no corrige código por sí misma**: ejecuta los gates y devuelve un diagnóstico estructurado (`{ gate, category, suggestion }` por cada fallo).
   - El agente de IA es quien lee ese diagnóstico, localiza la causa raíz en el código fuente y aplica el parche de forma autónoma con sus propias herramientas de edición.
   - Volver a invocar `run_self_healing_loop` / `verify_task_quality_gates` tras cada corrección, en bucle, hasta que **el 100% de los checks estén en verde**.
5. **Cierre y Notificación:** Crear el reporte de ejecución en `.agents/workflow/executions/<ID>.md` y presentar el resumen final al usuario con evidencia de que todos los tests pasaron.

---

## 4. Modo de Desarrollo por Fases (Opcional)

Para desarrollos grandes divididos en varias features, activar el **modo por fases**. El flujo es estrictamente secuencial y queda documentado en la bitácora `docs/bitacora/<PLAN-ID>.md`:

```
feat 1 → check ✔ → feat 2 → check ✖ → fix → check ✔ → ... → healthcheck final ✖ → hotfix → healthcheck ✔ → COMPLETED
```

1. **Activar:** `agt phase:start <PLAN-ID> -t "Título" -p "<TASK-ID>:<Título feat 1>" -p "<TASK-ID>:<Título feat 2>"`
   - Crea las tareas `feat` faltantes (sin rama propia: todo el plan vive en la rama activa).
   - Opcional: `--health "<gate>=<comando>"` (repetible) para el healthcheck final. Por defecto: `pnpm test` y `pnpm test:bdd`.
2. **Desarrollar la feat actual** (TDD/BDD) y ejecutar **`agt phase:check`**:
   - ✔ **Verde:** la feat pasa a `READY_FOR_PR` y se inicia automáticamente la siguiente.
   - ✖ **Bug:** se crea la tarea `<TASK-ID>-FIX-<n>` (tipo `fix`) con los mismos gates. Corregir y re-ejecutar `agt phase:check` hasta que esté en verde (el fix se marca `RESOLVED`). **No se avanza a la siguiente feat con un fix abierto.**
3. **Healthcheck final:** al completar todas las fases, ejecutar **`agt phase:health`** (suite completa):
   - ✔ **Verde:** el plan queda `COMPLETED` y el modo por fases se desactiva.
   - ✖ **Bug:** se crea la tarea `<PLAN-ID>-HOTFIX-<n>` (tipo `hotfix`). Corregir y re-ejecutar `agt phase:health`.
4. **Vía MCP:** las mismas acciones están disponibles como tools `start_phased_plan`, `check_current_phase`, `run_final_healthcheck` y `get_phased_plan`; tras cada fallo, leer el diagnóstico devuelto, corregir el código y volver a invocar la tool.
5. **Seguimiento:** `agt phase:status` muestra fases, fixes abiertos y la ruta de la bitácora. La bitácora se regenera en cada paso con la tabla de fases, fixes/hotfixes, resultado del healthcheck y el registro cronológico de eventos; debe commitearse junto con el código.
6. **Límite de intentos:** tras `max_attempts` checks fallidos consecutivos (por defecto 3), el plan queda `BLOCKED`. **Detenerse e informar al usuario** con el diagnóstico; no reanudar (`agt phase:resume`) sin su indicación.

### Bucle autónomo (obligatorio con el modo por fases activo)

No adivinar el siguiente paso: consultarlo siempre.

1. Invocar la tool MCP `next_step` (o `agt next --json`).
2. Ejecutar la acción devuelta:
   - `IMPLEMENT_FEATURE`: completar spec, plan y `.feature`, escribir tests y código.
   - `FIX_BUG` / `FIX_HOTFIX`: leer el reporte y el diagnóstico, y corregir la causa raíz.
   - `RUN_HEALTHCHECK`: ejecutar el healthcheck.
3. Invocar la tool indicada en `tool` (`check_current_phase` / `run_final_healthcheck`) y commitear la fase cuando quede en verde.
4. Repetir hasta que `done` sea `true`: `DONE` (presentar el resumen) o `BLOCKED` (pedir intervención).

En Claude Code, el hook Stop (`agt hook:stop`, instalado por `agt init` o `agt hook:install`) impide terminar el turno mientras quede trabajo pendiente.
