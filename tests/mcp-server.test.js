import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TOOLS, TOOL_HANDLERS } from '../src/mcp-server.js';

describe('Servidor MCP - Catálogo y Handlers de Herramientas (src/mcp-server.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-mcp-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe declarar un inputSchema válido para cada tool listada', () => {
    for (const tool of TOOLS) {
      expect(tool.name).toBeTypeOf('string');
      expect(tool.description).toBeTypeOf('string');
      expect(tool.inputSchema.type).toBe('object');
      // Toda tool debe tener un handler implementado
      expect(TOOL_HANDLERS[tool.name]).toBeTypeOf('function');
    }
  });

  it('debe permitir crear, verificar y actualizar el estado de una tarea end-to-end vía handlers', async () => {
    // 1. Crear la tarea sin generar rama Git (entorno de prueba aislado)
    const created = await TOOL_HANDLERS.create_task(
      { id: 'MCP-0001', title: 'Tarea vía MCP', createBranch: false },
      tempDir
    );
    expect(created.id).toBe('MCP-0001');

    // 2. Leerla de vuelta
    const fetched = await TOOL_HANDLERS.get_task({ id: 'MCP-0001' }, tempDir);
    expect(fetched.status).toBe('PLANNED');

    // 3. Verificar sus Quality Gates (unit_tests apuntará a 'pnpm test' y fallará
    //    fuera del repo real, pero el resultado debe ser estructurado, no lanzar excepción)
    const verification = await TOOL_HANDLERS.verify_task_quality_gates({ id: 'MCP-0001' }, tempDir);
    expect(verification.valid).toBe(true);
    expect(Array.isArray(verification.results)).toBe(true);

    // 4. Actualizar el estado
    const updated = await TOOL_HANDLERS.update_task_status({ id: 'MCP-0001', status: 'in_progress' }, tempDir);
    expect(updated.status).toBe('IN_PROGRESS');

    // 5. Debe aparecer en el listado
    const list = await TOOL_HANDLERS.list_active_tasks({}, tempDir);
    expect(list.map((t) => t.id)).toContain('MCP-0001');
  });

  it('debe registrar una lección y poder consultarla luego por palabra clave', async () => {
    const entry = await TOOL_HANDLERS.record_lesson(
      { lesson: 'Evitar N+1 queries en turnos', category: 'PERFORMANCE', solution: 'Usar inner join con índices' },
      tempDir
    );
    expect(entry.category).toBe('PERFORMANCE');

    const result = await TOOL_HANDLERS.query_graphify_memory({ keyword: 'N+1' }, tempDir);
    expect(result.matchedLessons).toHaveLength(1);
  });

  it('run_self_healing_loop debe devolver diagnóstico estructurado cuando los gates fallan', async () => {
    await TOOL_HANDLERS.create_task(
      { id: 'MCP-0002', title: 'Tarea con gate roto', createBranch: false },
      tempDir
    );

    const taskYamlPath = path.join(tempDir, '.agents', 'workflow', 'tasks', 'MCP-0002.yml');
    let content = fs.readFileSync(taskYamlPath, 'utf-8');
    content = content.replace('unit_tests: pnpm test', 'unit_tests: node -e "process.exit(1)"');
    fs.writeFileSync(taskYamlPath, content, 'utf-8');

    const loopResult = await TOOL_HANDLERS.run_self_healing_loop({ id: 'MCP-0002', maxRetries: 1 }, tempDir);
    expect(loopResult.success).toBe(false);
    expect(loopResult.diagnostics.length).toBeGreaterThan(0);
    expect(loopResult.reportPath).toBeTypeOf('string');
  });

  it('las tools del modo por fases deben iniciar el plan, abrir un fix al fallar y exponer el estado', async () => {
    const started = await TOOL_HANDLERS.start_phased_plan(
      { id: 'PLAN-MCP', title: 'Plan vía MCP', phases: [{ id: 'MCP-0101', title: 'Login' }] },
      tempDir
    );
    expect(started.plan.status).toBe('ACTIVE');

    // Fuera del repo real 'pnpm test' falla, así que el check debe abrir un fix
    const check = await TOOL_HANDLERS.check_current_phase({}, tempDir);
    expect(check.passed).toBe(false);
    expect(check.fixTask).toBe('MCP-0101-FIX-1');

    const plan = await TOOL_HANDLERS.get_phased_plan({}, tempDir);
    expect(plan.phases[0].status).toBe('FIXING');
    expect(fs.existsSync(path.join(tempDir, 'docs', 'bitacora', 'PLAN-MCP.md'))).toBe(true);
  });
});
