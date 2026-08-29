// Importamos las utilidades de testing de Vitest
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Importamos módulos de sistema de archivos para crear entornos temporales de prueba
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Importamos la función a probar
import { initProject } from '../src/init.js';

describe('Módulo de Inicialización de Proyectos (src/init.js)', () => {
  let tempProjectDir;

  beforeEach(() => {
    // Creamos un directorio temporal simulando un proyecto externo nuevo
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'external-app-'));
  });

  afterEach(() => {
    if (tempProjectDir && fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    }
  });

  it('debe inicializar la estructura de .agents/ en un proyecto destino vacío', () => {
    const result = initProject({
      targetDir: tempProjectDir,
      copyCucumber: true,
    });

    // Verificamos que se hayan copiado las subcarpetas esenciales
    expect(result.copiedFolders).toContain('rules');
    expect(result.copiedFolders).toContain('skills');
    expect(result.copiedFolders).toContain('templates');

    // Verificamos la existencia física de las carpetas y archivos en el destino
    const targetRules = path.join(tempProjectDir, '.agents', 'rules', 'master-workflow.md');
    const targetTemplates = path.join(tempProjectDir, '.agents', 'templates', 'feature.feature');
    const targetCucumber = path.join(tempProjectDir, 'cucumber.json');
    const targetCi = path.join(tempProjectDir, '.github', 'workflows', 'ci.yml');

    expect(fs.existsSync(targetRules)).toBe(true);
    expect(fs.existsSync(targetTemplates)).toBe(true);
    expect(fs.existsSync(targetCucumber)).toBe(true);
    expect(fs.existsSync(targetCi)).toBe(true);
    expect(result.ciCreated).toBe(true);

    // Verificamos la creación de la estructura limpia de workflow
    const workflowTasks = path.join(tempProjectDir, '.agents', 'workflow', 'tasks');
    const workflowSpecs = path.join(tempProjectDir, '.agents', 'workflow', 'specs');
    const workflowPlans = path.join(tempProjectDir, '.agents', 'workflow', 'plans');
    const workflowTests = path.join(tempProjectDir, '.agents', 'workflow', 'tests');
    const workflowFeatures = path.join(tempProjectDir, '.agents', 'workflow', 'features');
    const workflowExecutions = path.join(tempProjectDir, '.agents', 'workflow', 'executions');

    expect(fs.existsSync(workflowTasks)).toBe(true);
    expect(fs.existsSync(workflowSpecs)).toBe(true);
    expect(fs.existsSync(workflowPlans)).toBe(true);
    expect(fs.existsSync(workflowTests)).toBe(true);
    expect(fs.existsSync(workflowFeatures)).toBe(true);
    expect(fs.existsSync(workflowExecutions)).toBe(true);
  });
});
