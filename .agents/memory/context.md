# 🧠 Contexto y Memoria del Proyecto: agent_ASDW

> **Última sincronización:** 2026-09-14T12:11:17.382Z | **Nodos:** 31 | **Tareas:** 9

## 📦 Mapa de Módulos y Dependencias

| Módulo | Líneas | Dependencias Principales |
|---|---|---|
| `bin/agente-dev.js` | 462 | commander, picocolors, ../src/index.js |
| `src/memory.js` | 336 | node:fs, node:path, ./task-manager.js |
| `src/task-manager.js` | 300 | node:fs, node:path, js-yaml |
| `src/init.js` | 262 | node:fs, node:path, node:url |
| `src/mcp-server.js` | 248 | @modelcontextprotocol/sdk/server/index.js, @modelcontextprotocol/sdk/server/stdio.js, @modelcontextprotocol/sdk/types.js |
| `src/validator.js` | 187 | node:fs, node:path, node:child_process |
| `src/git.js` | 176 | node:child_process |
| `src/workflow-runner.js` | 169 | node:fs, node:path, ./task-manager.js |
| `src/release-manager.js` | 105 | node:fs, node:path, js-yaml |
| `src/scaffolder.js` | 85 | node:fs, node:path, @cucumber/cucumber |
| `src/index.js` | 27 | ninguna |

## 📋 Tareas Registradas

- **AGT-0001: CLI del Agente de Workflow y Automatización de Ramas Git** `[READY_FOR_PR]`
- **AGT-0002: Integracion de Motor BDD con Gherkin y Cucumber** `[READY_FOR_PR]`
- **AGT-0003: Motor de Bucle Autonomo y Auto-Correccion Self-Healing** `[READY_FOR_PR]`
- **AGT-0004: Consolidacion de Artefactos y Plantillas dentro de .agents** `[READY_FOR_PR]`
- **AGT-0005: Estructurar Skills por Departamentos de Empresa Frontend Backend SEO QA DevOps Seguridad UX DT** `[READY_FOR_PR]`
- **AGT-0006: Implementacion Completa de CI/CD con GitHub Actions y Quality Gates Automatizados** `[READY_FOR_PR]`
- **AGT-0007: Implementacion de Memoria Graphify para Ahorro de Tokens y Aprendizaje de Errores** `[READY_FOR_PR]`
- **AGT-0008: Fix compatibilidad CI CD pnpm v11 con Node 22 y 24** `[READY_FOR_PR]`
- **AGT-0010: Integracion de MCP, Release Manager y BDD Scaffolder** `[PLANNED]`

## 💡 Lecciones Aprendidas y Anti-Patrones a Evitar

- **[ARCHITECTURE]** Asegurar que todas las rutas de artefactos utilicen .agents/workflow/ y .agents/templates/ *(Solución: Utilizar las constantes DIRS en src/task-manager.js y MEMORY_PATHS en src/memory.js)*
- **[CI_CD]** pnpm v11 requiere Node.js >= 22.13.0 por modulo nativo node:sqlite. No usar Node 20 en GitHub Actions. *(Solución: Configurar actions/setup-node@v4 con node-version 22 o 24 antes de pnpm/action-setup@v4 con run_install false.)*
- **[WORKFLOW]** No crear ramas nuevas para fixes o ajustes menores; commitear directamente en la rama activa con mensajes semánticos o usar --no-branch. *(Solución: Mantenerse en la rama actual y realizar git commit -m 'fix(...)')*
