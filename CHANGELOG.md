# Changelog

## [v1.2.0] - 2026-10-24

Desarrollado con el propio modo por fases del agente: plan `PLAN-002` (bitácora en `docs/bitacora/PLAN-002.md`).

### 🚀 Funcionalidades (Features)
- **[AGT-0012]** `projectRoot` configurable: argumento `projectRoot` en todas las tools MCP, variable `AGT_PROJECT_ROOT` y flag global `agt --root <dir>`.
- **[AGT-0013]** Tool MCP `next_step` y comando `agt next [--json]`: la siguiente acción concreta del flujo, con tarea, artefactos, diagnóstico y tool a invocar. Nuevo `agt phase:status --json`.
- **[AGT-0014]** Límite de intentos (`--max-attempts`, default 3), estado `BLOCKED` y `agt phase:resume` / tool `resume_phased_plan`. Hook Stop para Claude Code (`agt hook:stop`), con salvaguarda `--max-idle`; se instala con `agt hook:install` o `agt init`.

### 📝 Documentación
- README: sección 14 "Automatización Autónoma de Punta a Punta", tools nuevas y problemas frecuentes.
- Regla maestra: bucle autónomo obligatorio con `next_step` y límite de intentos.

## [v1.1.0] - 2026-10-24

### 🚀 Funcionalidades (Features)
- **[AGT-0011]** Modo de desarrollo por fases con healthcheck y bitácora: comandos `agt phase:start`, `phase:check`, `phase:health` y `phase:status`. El flujo es feat + check → siguiente feat; si un check falla se abre un `fix`, al final corre un healthcheck y, si falla, se abre un `hotfix`. Todo queda en `docs/bitacora/<PLAN-ID>.md`.
- Tools MCP `start_phased_plan`, `check_current_phase`, `run_final_healthcheck` y `get_phased_plan`.
- `agt init` agrega al proyecto los scripts `agt:phase:*`, las tareas de VS Code del modo por fases y la carpeta `.agents/workflow/phases/`.
- Archivos de reglas de IDE (`AGENTS.md`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `AI.md`) con referencia al modo por fases.
- La memoria Graphify detecta `require()` (CommonJS), escanea `backend/`, `frontend/src` y `automation/`, e ignora `dist`, `build`, `.next` y `coverage`.

### 📝 Documentación
- README: requisitos actualizados (Node >= 22), guía de puesta en marcha, conexión por MCP, actualización del agente y solución de problemas.
- Regla maestra: sección 4 "Modo de Desarrollo por Fases".

## [v1.0.0]

- Versión inicial: CLI `agt`, tareas con ramas Git, quality gates, bucle de verificación, BDD con Cucumber, CI/CD, memoria Graphify, releases, scaffolding BDD, servidor MCP y hook pre-commit (AGT-0001 a AGT-0010).
