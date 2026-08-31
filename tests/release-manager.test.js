import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateRelease } from '../src/release-manager.js';
import * as taskManager from '../src/task-manager.js';

// Mockeamos el sistema de archivos y el task-manager
vi.mock('node:fs');
vi.mock('../src/task-manager.js');

describe('Release Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar si no se pasa la versión', () => {
    expect(() => generateRelease()).toThrow('Debes proporcionar una versión (ej: v1.2.0)');
  });

  it('debe abortar si no hay tareas DONE para liberar', () => {
    taskManager.listTasks.mockReturnValue([
      { id: 'AGT-001', status: 'IN_PROGRESS' },
      { id: 'AGT-002', status: 'DONE', released_in: 'v1.0.0' }
    ]);
    const res = generateRelease('v1.1.0', '/mock');
    expect(res.success).toBe(false);
    expect(res.message).toBe('No hay tareas nuevas en estado DONE para liberar.');
  });

  it('debe generar el changelog y actualizar manifiestos', () => {
    taskManager.listTasks.mockReturnValue([
      { id: 'AGT-003', status: 'DONE', type: 'feat', title: 'Login', owner: 'alice' },
      { id: 'AGT-004', status: 'DONE', type: 'fix', title: 'Bug en header', owner: 'bob' }
    ]);

    fs.existsSync.mockReturnValue(false); // NO existe CHANGELOG ni package.json
    
    const res = generateRelease('v1.2.0', '/mock');

    expect(res.success).toBe(true);
    expect(res.tasksCount).toBe(2);
    
    // Debería escribir en CHANGELOG.md y en los 2 archivos yml
    expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
  });
});
