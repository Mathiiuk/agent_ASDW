# Changelog

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
