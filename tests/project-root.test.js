import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolveProjectRoot, PROJECT_ROOT_ENV } from '../src/project-root.js';
import { callTool, TOOLS } from '../src/mcp-server.js';

const CLI = path.resolve('bin/agente-dev.js');

describe('Resolución de la raíz del proyecto (src/project-root.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'root-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe priorizar argumento explícito > AGT_PROJECT_ROOT > cwd', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'root-env-'));
    try {
      expect(resolveProjectRoot(tempDir, { [PROJECT_ROOT_ENV]: other })).toBe(path.resolve(tempDir));
      expect(resolveProjectRoot(undefined, { [PROJECT_ROOT_ENV]: other })).toBe(path.resolve(other));
      expect(resolveProjectRoot(undefined, {})).toBe(process.cwd());
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('debe fallar si la ruta no existe', () => {
    expect(() => resolveProjectRoot(path.join(tempDir, 'no-existe'), {})).toThrow(/no existe/);
  });

  it('todas las tools MCP deben aceptar projectRoot y callTool debe usarlo', async () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema.properties.projectRoot.type).toBe('string');
    }
    await callTool('create_task', { id: 'ROOT-0001', title: 'Tarea remota', createBranch: false, projectRoot: tempDir });
    expect(fs.existsSync(path.join(tempDir, '.agents', 'workflow', 'tasks', 'ROOT-0001.yml'))).toBe(true);
  });

  it('callTool debe rechazar tools desconocidas', async () => {
    await expect(callTool('no_existe', {})).rejects.toThrow(/Tool no reconocida/);
  });

  it('la CLI debe operar sobre --root y sobre AGT_PROJECT_ROOT', () => {
    execFileSync('node', [CLI, '--root', tempDir, 'task:new', 'ROOT-0002', '-t', 'Via flag', '--no-branch']);
    expect(fs.existsSync(path.join(tempDir, '.agents', 'workflow', 'tasks', 'ROOT-0002.yml'))).toBe(true);

    const out = execFileSync('node', [CLI, 'task:list'], { env: { ...process.env, [PROJECT_ROOT_ENV]: tempDir }, encoding: 'utf-8' });
    expect(out).toContain('ROOT-0002');
  });
});
