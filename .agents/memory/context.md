# 🧠 Contexto y Memoria del Proyecto: agente_dev

> **Última sincronización:** 2026-08-29T15:19:31.449Z | **Nodos:** 22 | **Tareas:** 7

## 📦 Mapa de Módulos y Dependencias

| Módulo | Líneas | Dependencias Principales |
|---|---|---|
| `src/git.js` | 162 | node:child_process |
| `src/index.js` | 18 | ninguna |
| `src/init.js` | 127 | node:fs, node:path, node:url |
| `src/memory.js` | 308 | node:fs, node:path, ./task-manager.js |
| `src/task-manager.js` | 294 | node:fs, node:path, js-yaml |
| `src/validator.js` | 155 | node:child_process |
| `src/workflow-runner.js` | 169 | node:fs, node:path, ./task-manager.js |
| `bin/agente-dev.js` | 378 | commander, picocolors, ../src/index.js |

## 📋 Tareas Registradas

- **AGT-0001: CLI del Agente de Workflow y Automatización de Ramas Git** `[READY_FOR_PR]`
- **AGT-0002: Integracion de Motor BDD con Gherkin y Cucumber** `[READY_FOR_PR]`
- **AGT-0003: Motor de Bucle Autonomo y Auto-Correccion Self-Healing** `[READY_FOR_PR]`
- **AGT-0004: Consolidacion de Artefactos y Plantillas dentro de .agents** `[READY_FOR_PR]`
- **AGT-0005: Estructurar Skills por Departamentos de Empresa Frontend Backend SEO QA DevOps Seguridad UX DT** `[READY_FOR_PR]`
- **AGT-0006: Implementacion Completa de CI/CD con GitHub Actions y Quality Gates Automatizados** `[READY_FOR_PR]`
- **AGT-0007: Implementacion de Memoria Graphify para Ahorro de Tokens y Aprendizaje de Errores** `[PLANNED]`

## 💡 Lecciones Aprendidas y Anti-Patrones a Evitar

- **[ARCHITECTURE]** Asegurar que todas las rutas de artefactos utilicen .agents/workflow/ y .agents/templates/ *(Solución: Utilizar las constantes DIRS en src/task-manager.js y MEMORY_PATHS en src/memory.js)*
