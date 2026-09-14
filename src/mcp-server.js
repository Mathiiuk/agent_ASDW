import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import process from 'node:process';
import {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  formatBranchName,
  checkoutBranch,
  validateManifest,
  runQualityGates,
  runTaskLoop,
  queryMemory,
  buildKnowledgeGraph,
  recordLesson,
  generateRelease,
  generateBddScaffold,
} from './index.js';

/**
 * Catálogo de herramientas del Agente expuestas vía MCP.
 * A diferencia de un servidor de "solo lectura", estas herramientas permiten
 * a un agente de IA externo (Claude Code, Cursor, Antigravity, etc.) ejecutar
 * el ciclo de vida completo de una tarea (crear, verificar, auto-reparar, cerrar)
 * sin depender de invocar la shell manualmente.
 */
export const TOOLS = [
  {
    name: 'list_active_tasks',
    description: 'Obtiene la lista de todas las tareas registradas en el workflow del proyecto actual.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_task',
    description: 'Obtiene el manifiesto completo (YAML) de una tarea específica por su ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID de la tarea (ej: AGT-0011)' } },
      required: ['id'],
    },
  },
  {
    name: 'create_task',
    description: 'Crea una nueva tarea (manifiesto, spec, plan, tests, feature BDD) y opcionalmente su rama de Git.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID único de la tarea (ej: AGT-0011)' },
        title: { type: 'string', description: 'Título descriptivo de la tarea' },
        type: { type: 'string', description: 'Tipo de tarea (feat, fix, refactor, docs, chore, etc.)' },
        owner: { type: 'string', description: 'Responsable de la tarea' },
        baseBranch: { type: 'string', description: 'Rama base de origen' },
        createBranch: { type: 'boolean', description: 'Si crea/conmuta la rama de Git automáticamente (default true)' },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Actualiza el estado de una tarea en su manifiesto YAML (ej: IN_PROGRESS, READY_FOR_PR, DONE).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', description: 'Nuevo estado del ciclo de vida de la tarea' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'checkout_task_branch',
    description: 'Calcula y conmuta (creándola si no existe) a la rama de Git correspondiente a una tarea.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'verify_task_quality_gates',
    description: 'Valida el manifiesto y ejecuta los Quality Gates configurados para una tarea, devolviendo el resultado de cada gate.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'run_self_healing_loop',
    description:
      'Ejecuta una iteración del bucle de verificación de una tarea: corre los Quality Gates y, si fallan, devuelve un diagnóstico estructurado (categoría + sugerencia por gate) para que el agente de IA aplique la corrección de código correspondiente antes de volver a invocar esta herramienta.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        maxRetries: { type: 'number', description: 'Reintentos internos antes de reportar fallo (default 1, ya que la corrección la aplica el agente externo entre llamadas)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'record_lesson',
    description: 'Registra una lección aprendida o trampa evitada en la memoria persistente del proyecto (.agents/memory/).',
    inputSchema: {
      type: 'object',
      properties: {
        lesson: { type: 'string' },
        category: { type: 'string', description: 'BUG_FIX, BEST_PRACTICE, SECURITY, ARCHITECTURE, CI_CD, WORKFLOW' },
        solution: { type: 'string' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'sync_knowledge_graph',
    description: 'Reescanea el código fuente y reconstruye el Grafo de Conocimiento y el contexto condensado (.agents/memory/).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'query_graphify_memory',
    description: 'Consulta el Grafo de Conocimiento (módulos, dependencias, tareas) o las lecciones aprendidas dado un término clave. El resultado se recorta a `limit` coincidencias por categoría.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Palabra clave a buscar (ej: "auth", "login", "database")' },
        limit: { type: 'number', description: 'Máximo de coincidencias por categoría a devolver (default 15)' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'generate_release',
    description: 'Consolida las tareas en estado DONE en una nueva versión: actualiza CHANGELOG.md y package.json.',
    inputSchema: {
      type: 'object',
      properties: { version: { type: 'string', description: 'Versión a liberar (ej: v1.2.0)' } },
      required: ['version'],
    },
  },
  {
    name: 'generate_bdd_scaffold',
    description: 'Genera el esqueleto de Step Definitions (Cucumber/JS) a partir del archivo .feature de una tarea.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
];

/**
 * Implementación de cada herramienta. Cada handler recibe los argumentos crudos
 * de la llamada MCP y el directorio de trabajo (cwd), y retorna un objeto plano
 * serializable a JSON (nunca imprime a stdout, reservado al protocolo JSON-RPC).
 */
export const TOOL_HANDLERS = {
  list_active_tasks: async (_args, cwd) => listTasks(cwd),

  get_task: async ({ id }, cwd) => getTask(id, cwd),

  create_task: async ({ id, title, type, owner, baseBranch, createBranch }, cwd) =>
    createTask({
      id,
      title,
      type: type || 'feat',
      owner: owner || 'team-agent',
      baseBranch: baseBranch || 'main',
      createBranch: createBranch !== false,
      projectRoot: cwd,
    }),

  update_task_status: async ({ id, status }, cwd) => updateTaskStatus(id, String(status).toUpperCase(), cwd),

  checkout_task_branch: async ({ id }, cwd) => {
    const task = getTask(id, cwd);
    const branchName = formatBranchName(task.type, task.id, task.title || task.summary);
    return checkoutBranch(branchName, { createIfNotExists: true, cwd });
  },

  verify_task_quality_gates: async ({ id }, cwd) => {
    const task = getTask(id, cwd);
    const validation = validateManifest(task);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }
    const gatesResult = runQualityGates(task, cwd);
    return { valid: true, ...gatesResult };
  },

  run_self_healing_loop: async ({ id, maxRetries }, cwd) =>
    runTaskLoop({ id, maxRetries: maxRetries || 1, projectRoot: cwd }),

  record_lesson: async ({ lesson, category, solution }, cwd) =>
    recordLesson({ lesson, category: category || 'BUG_FIX', solution: solution || '', projectRoot: cwd }),

  sync_knowledge_graph: async (_args, cwd) => buildKnowledgeGraph(cwd),

  query_graphify_memory: async ({ keyword, limit }, cwd) => queryMemory(keyword, cwd, limit || 15),

  generate_release: async ({ version }, cwd) => generateRelease(version, cwd),

  generate_bdd_scaffold: async ({ id }, cwd) => generateBddScaffold(id, cwd),
};

/**
 * Inicia el servidor MCP nativo del Agente Dev.
 * Permite que clientes (IDE, Antigravity, Cursor, Claude Desktop) llamen a las
 * herramientas del ciclo de vida completo del workflow directamente mediante
 * el protocolo JSON-RPC sobre stdio, en lugar de depender de comandos de shell.
 */
export async function startMcpServer() {
  const server = new Server(
    { name: 'agente-dev-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const cwd = process.cwd();
    const handler = TOOL_HANDLERS[request.params.name];

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Tool no reconocida: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      const result = await handler(request.params.arguments || {}, cwd);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error ejecutando la herramienta: ${error.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
