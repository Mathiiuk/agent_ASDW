// Importamos las utilidades de testing de Vitest
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Importamos módulos de sistema de archivos para crear entornos temporales de prueba
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Importamos los módulos a probar
import { getTask } from '../src/task-manager.js';
import {
  startPhasedDevelopment,
  checkCurrentPhase,
  runFinalHealthcheck,
  getActivePhasePlanId,
  getPhasePlan,
  parsePhaseArg,
} from '../src/phase-runner.js';

// Ejecutores de gates simulados para no lanzar comandos reales
const passRunner = () => ({ allPassed: true, results: [{ gate: 'unit_tests', command: 'pnpm test', passed: true }] });
const failRunner = () => ({
  allPassed: false,
  results: [{ gate: 'unit_tests', command: 'pnpm test', passed: false, error: 'AssertionError: expected 1 to be 2' }],
});

describe('Modo de Desarrollo por Fases (src/phase-runner.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper para iniciar un plan de dos fases en el directorio temporal
  const startPlan = () =>
    startPhasedDevelopment({
      id: 'PLAN-01',
      title: 'Plan de prueba',
      phases: [
        { id: 'TST-0001', title: 'Login' },
        { id: 'TST-0002', title: 'Dashboard' },
      ],
      projectRoot: tempDir,
    });

  it('parsePhaseArg() debe separar ID y título', () => {
    expect(parsePhaseArg('AGT-0012:Login con OAuth')).toEqual({ id: 'AGT-0012', title: 'Login con OAuth' });
    expect(() => parsePhaseArg('sin-separador')).toThrow(/Formato esperado/);
  });

  it('startPhasedDevelopment() debe activar el modo, crear las tareas feat y la bitácora en docs/', () => {
    const { plan, logPath } = startPlan();

    expect(getActivePhasePlanId(tempDir)).toBe('PLAN-01');
    expect(plan.phases[0].status).toBe('IN_PROGRESS');
    expect(plan.phases[1].status).toBe('PENDING');
    expect(getTask('TST-0001', tempDir).status).toBe('IN_PROGRESS');
    expect(getTask('TST-0002', tempDir).type).toBe('feat');
    expect(logPath).toBe(path.join(tempDir, 'docs', 'bitacora', 'PLAN-01.md'));
    expect(fs.readFileSync(logPath, 'utf-8')).toContain('PLAN_START');
  });

  it('no debe permitir dos planes activos a la vez', () => {
    startPlan();
    expect(() =>
      startPhasedDevelopment({ id: 'PLAN-02', title: 'Otro', phases: [{ id: 'X-1', title: 'x' }], projectRoot: tempDir })
    ).toThrow(/Ya hay un plan por fases activo/);
  });

  it('checkCurrentPhase() en verde debe avanzar a la siguiente feat', () => {
    startPlan();
    const res = checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });

    expect(res.passed).toBe(true);
    expect(res.nextPhase.task_id).toBe('TST-0002');
    expect(getTask('TST-0001', tempDir).status).toBe('READY_FOR_PR');
    expect(getTask('TST-0002', tempDir).status).toBe('IN_PROGRESS');
  });

  it('checkCurrentPhase() fallido debe crear un fix, reutilizarlo y resolverlo al volver a verde', () => {
    startPlan();

    const fail1 = checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir });
    expect(fail1.passed).toBe(false);
    expect(fail1.fixTask).toBe('TST-0001-FIX-1');
    expect(getTask('TST-0001-FIX-1', tempDir).type).toBe('fix');
    expect(getTask('TST-0001-FIX-1', tempDir).commands.unit_tests).toBe('pnpm test');

    // Un segundo fallo no debe abrir un fix nuevo
    const fail2 = checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir });
    expect(fail2.fixTask).toBe('TST-0001-FIX-1');
    expect(getPhasePlan(null, tempDir).fixes).toHaveLength(1);

    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    const plan = getPhasePlan(null, tempDir);
    expect(plan.fixes[0].status).toBe('RESOLVED');
    expect(plan.phases[0].checks).toBe(3);
    expect(getTask('TST-0001-FIX-1', tempDir).status).toBe('READY_FOR_PR');
  });

  it('runFinalHealthcheck() no debe ejecutarse con fases pendientes', () => {
    startPlan();
    expect(() => runFinalHealthcheck({ gateRunner: passRunner, projectRoot: tempDir })).toThrow(/fases sin check/);
  });

  it('runFinalHealthcheck() fallido debe abrir un hotfix y al pasar completar el plan', () => {
    startPlan();
    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    const last = checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    expect(last.readyForHealthcheck).toBe(true);

    const bad = runFinalHealthcheck({ gateRunner: failRunner, projectRoot: tempDir });
    expect(bad.passed).toBe(false);
    expect(bad.hotfixTask).toBe('PLAN-01-HOTFIX-1');
    expect(getTask('PLAN-01-HOTFIX-1', tempDir).type).toBe('hotfix');
    expect(getPhasePlan(null, tempDir).status).toBe('HOTFIX_REQUIRED');

    const good = runFinalHealthcheck({ gateRunner: passRunner, projectRoot: tempDir });
    expect(good.passed).toBe(true);
    expect(getActivePhasePlanId(tempDir)).toBeNull();

    const plan = getPhasePlan('PLAN-01', tempDir);
    expect(plan.status).toBe('COMPLETED');
    expect(plan.fixes[0].status).toBe('RESOLVED');

    const log = fs.readFileSync(good.logPath, 'utf-8');
    expect(log).toContain('HOTFIX_CREATED');
    expect(log).toContain('HEALTHCHECK_PASS');
    expect(log).toContain('`COMPLETED`');
  });
});
