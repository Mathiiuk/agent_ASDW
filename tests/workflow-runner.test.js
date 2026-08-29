// Importamos las utilidades de testing de Vitest
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Importamos módulos de sistema de archivos para crear entornos temporales de prueba
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Importamos los módulos a probar
import { createTask, getTask } from '../src/task-manager.js';
import { diagnoseFailure, generateExecutionReport, runTaskLoop } from '../src/workflow-runner.js';

describe('Módulo de Bucle Autónomo (src/workflow-runner.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('diagnoseFailure()', () => {
    it('debe clasificar correctamente errores de aserción (ASSERTION_FAILURE)', () => {
      const results = [
        {
          gate: 'unit_tests',
          command: 'pnpm test',
          passed: false,
          error: 'AssertionError: expected 1 to be 2',
        },
      ];

      const diagnostics = diagnoseFailure(results);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].category).toBe('ASSERTION_FAILURE');
      expect(diagnostics[0].suggestion).toContain('Ajustar la lógica del código fuente');
    });

    it('debe clasificar correctamente errores de importación (IMPORT_ERROR)', () => {
      const results = [
        {
          gate: 'unit_tests',
          command: 'pnpm test',
          passed: false,
          error: 'Error: Cannot find module ./missing-file.js',
        },
      ];

      const diagnostics = diagnoseFailure(results);
      expect(diagnostics[0].category).toBe('IMPORT_ERROR');
      expect(diagnostics[0].suggestion).toContain('Verificar la ruta del import');
    });

    it('debe clasificar errores de configuración cuando falta un comando (CONFIG_ERROR)', () => {
      const results = [
        {
          gate: 'lint',
          command: 'N/A',
          passed: false,
          error: 'Gate "lint" activado pero no tiene comando configurado',
        },
      ];

      const diagnostics = diagnoseFailure(results);
      expect(diagnostics[0].category).toBe('CONFIG_ERROR');
    });
  });

  describe('generateExecutionReport()', () => {
    it('debe crear el archivo de reporte en .agents/workflow/executions/<ID>.md', () => {
      const summary = {
        success: true,
        iterations: 1,
        results: [{ gate: 'unit_tests', command: 'pnpm test', passed: true }],
        diagnostics: [],
      };

      const reportPath = generateExecutionReport('TEST-RPT-01', summary, tempDir);
      expect(fs.existsSync(reportPath)).toBe(true);

      const content = fs.readFileSync(reportPath, 'utf-8');
      expect(content).toContain('Reporte de Ejecución Automatizada - TEST-RPT-01');
      expect(content).toContain('READY_FOR_PR (SUCCESS)');
      expect(content).toContain('unit_tests');
    });
  });

  describe('runTaskLoop()', () => {
    it('debe completar el bucle con éxito si los quality gates están en verde', async () => {
      // Creamos una tarea con un comando exitoso
      createTask({
        id: 'TEST-LOOP-SUCCESS',
        title: 'Bucle Exitoso',
        createBranch: false,
        projectRoot: tempDir,
      });

      // Modificamos el manifiesto temporal para que ejecute un comando simple que retorna 0
      const taskPath = path.join(tempDir, '.agents', 'workflow', 'tasks', 'TEST-LOOP-SUCCESS.yml');
      const task = getTask('TEST-LOOP-SUCCESS', tempDir);
      task.quality_gates = { quick_check: true };
      task.commands = { quick_check: 'node -e "process.exit(0)"' };
      fs.writeFileSync(taskPath, JSON.stringify(task), 'utf-8');

      const result = await runTaskLoop({
        id: 'TEST-LOOP-SUCCESS',
        maxRetries: 2,
        projectRoot: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);

      // Verificamos que el estado de la tarea sea READY_FOR_PR
      const updated = getTask('TEST-LOOP-SUCCESS', tempDir);
      expect(updated.status).toBe('READY_FOR_PR');
    });
  });
});
