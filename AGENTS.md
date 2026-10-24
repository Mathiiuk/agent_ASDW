# Workspace AI Rules

Estás operando en un entorno de desarrollo estructurado para Agentes de IA.

> [!IMPORTANT]
> 1. Debes seguir ESTRICTAMENTE las directrices del flujo de trabajo definidas en:
>    **[.agents/rules/master-workflow.md](.agents/rules/master-workflow.md)**
> 2. Antes de realizar cambios importantes, DEBES leer el contexto del proyecto en:
>    **[.agents/memory/context.md](.agents/memory/context.md)**

Para ejecutar tareas, asume los roles especializados (Frontend, Backend, DevOps, etc.) definidos en la carpeta `.agents/skills/`.

Para entregas de varias features usa el **modo de desarrollo por fases** (`agt phase:start` / `phase:check` / `phase:health`, o las tools MCP equivalentes): feat + check → siguiente feat, fix si un check falla, healthcheck final y hotfix si falla. Todo queda documentado en `docs/bitacora/<PLAN-ID>.md`.
