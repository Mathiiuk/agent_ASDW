import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { listTasks, queryMemory } from './index.js';
import process from 'node:process';

/**
 * Inicia el servidor MCP nativo del Agente Dev.
 * Permite que clientes (IDE, Antigravity, Cursor) llamen a herramientas CLI
 * directamente mediante el protocolo JSON-RPC sobre stdio.
 */
export async function startMcpServer() {
  const server = new Server(
    {
      name: 'agente-dev-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Registrar Herramientas (ListTools)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_active_tasks',
          description: 'Obtiene la lista de todas las tareas (feat, fix) registradas en el workflow del proyecto actual.',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'query_graphify_memory',
          description: 'Consulta el Grafo de Conocimiento (AST y dependencias) o las lecciones aprendidas dado un término clave.',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Palabra clave a buscar (ej: "auth", "login", "database")',
              },
            },
            required: ['keyword'],
          },
        }
      ],
    };
  });

  // 2. Ejecutar Herramientas (CallTool)
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const cwd = process.cwd();

      if (request.params.name === 'list_active_tasks') {
        const tasks = listTasks(cwd);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      if (request.params.name === 'query_graphify_memory') {
        const { keyword } = request.params.arguments;
        const res = queryMemory(keyword, cwd);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
        };
      }

      throw new Error(`Tool no reconocida: ${request.params.name}`);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ejecutando la herramienta: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // 3. Conectar a través del transporte de entrada/salida estándar (stdio)
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
