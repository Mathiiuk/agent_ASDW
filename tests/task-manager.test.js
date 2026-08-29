// Importamos las utilidades de testing de Vitest
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Importamos módulos de sistema de archivos para crear entornos temporales de prueba
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Importamos las funciones del módulo de gestión de tareas
import { createTask, getTask, listTasks, updateTaskStatus } from '../src/task-manager.js';

describe('Módulo de Gestión de Tareas (src/task-manager.js)', () => {
  let tempDir;

  // Antes de cada prueba, creamos una carpeta temporal aislada
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agente-test-'));
  });

  // Después de cada prueba, eliminamos la carpeta temporal
  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe crear los 5 artefactos del workflow (task, spec, plan, test, feature)', () => {
    // Invocamos la creación de una tarea en el directorio temporal sin crear rama git
    const result = createTask({
      id: 'TEST-0001',
      title: 'Prueba de Creación de Artefactos',
      type: 'feat',
      owner: 'test-agent',
      createBranch: false,
      projectRoot: tempDir,
    });

    // Verificamos que se hayan generado 5 archivos (incluyendo el .feature de Gherkin)
    expect(result.files).toHaveLength(5);

    // Verificamos la existencia física de cada archivo en el directorio temporal
    const taskYaml = path.join(tempDir, 'docs', 'workflow', 'tasks', 'TEST-0001.yml');
    const specMd = path.join(tempDir, 'docs', 'workflow', 'specs', 'TEST-0001.md');
    const planMd = path.join(tempDir, 'docs', 'workflow', 'plans', 'TEST-0001.md');
    const testMd = path.join(tempDir, 'docs', 'workflow', 'tests', 'TEST-0001.md');
    const featureFile = path.join(tempDir, 'docs', 'workflow', 'features', 'TEST-0001.feature');

    expect(fs.existsSync(taskYaml)).toBe(true);
    expect(fs.existsSync(specMd)).toBe(true);
    expect(fs.existsSync(planMd)).toBe(true);
    expect(fs.existsSync(testMd)).toBe(true);
    expect(fs.existsSync(featureFile)).toBe(true);

    // Verificamos que el manifiesto se pueda leer con getTask
    const taskData = getTask('TEST-0001', tempDir);
    expect(taskData.id).toBe('TEST-0001');
    expect(taskData.title).toBe('Prueba de Creación de Artefactos');
    expect(taskData.type).toBe('feat');
    expect(taskData.status).toBe('PLANNED');
    expect(taskData.quality_gates.bdd_tests).toBe(true);
  });

  it('debe listar todas las tareas creadas correctamente', () => {
    // Creamos dos tareas en el directorio temporal
    createTask({
      id: 'TEST-0001',
      title: 'Primera Tarea',
      createBranch: false,
      projectRoot: tempDir,
    });
    createTask({
      id: 'TEST-0002',
      title: 'Segunda Tarea',
      createBranch: false,
      projectRoot: tempDir,
    });

    const tasks = listTasks(tempDir);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('TEST-0001');
    expect(tasks[1].id).toBe('TEST-0002');
  });

  it('debe actualizar el estado de una tarea correctamente', () => {
    createTask({
      id: 'TEST-0001',
      title: 'Tarea para Actualizar',
      createBranch: false,
      projectRoot: tempDir,
    });

    const updated = updateTaskStatus('TEST-0001', 'IN_PROGRESS', tempDir);
    expect(updated.status).toBe('IN_PROGRESS');

    const verified = getTask('TEST-0001', tempDir);
    expect(verified.status).toBe('IN_PROGRESS');
  });

  it('debe lanzar un error si se intenta crear una tarea sin ID o sin título', () => {
    expect(() => createTask({ title: 'Sin ID', projectRoot: tempDir })).toThrow(/El ID de la tarea es obligatorio/);
    expect(() => createTask({ id: 'AGT-999', projectRoot: tempDir })).toThrow(/El título de la tarea es obligatorio/);
  });
});
