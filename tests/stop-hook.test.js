import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  startPhasedDevelopment,
  checkCurrentPhase,
  runFinalHealthcheck,
  resumePhasedPlan,
  getPhasePlan,
} from '../src/phase-runner.js';
import { getNextStep } from '../src/next-step.js';
import { evaluateStopHook, installStopHook, STOP_HOOK_COMMAND } from '../src/stop-hook.js';

const CLI = path.resolve('bin/agente-dev.js');
const passRunner = () => ({ allPassed: true, results: [{ gate: 'unit_tests', command: 'pnpm test', passed: true }] });
const failRunner = () => ({
  allPassed: false,
  results: [{ gate: 'unit_tests', command: 'pnpm test', passed: false, error: 'AssertionError: boom' }],
});

describe('Límite de intentos y hook Stop (src/stop-hook.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const start = (maxAttempts = 2) =>
    startPhasedDevelopment({
      id: 'PLAN-S',
      title: 'Plan stop',
      phases: [{ id: 'S-1', title: 'Uno' }],
      maxAttempts,
      projectRoot: tempDir,
    });

  it('debe bloquear el plan tras N checks fallidos consecutivos y permitir reanudarlo', () => {
    start(2);
    expect(checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir }).blocked).toBe(false);
    expect(checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir }).blocked).toBe(true);

    const plan = getPhasePlan(null, tempDir);
    expect(plan.status).toBe('BLOCKED');
    expect(plan.blocked_reason).toContain('S-1');
    expect(getNextStep({ projectRoot: tempDir })).toMatchObject({ action: 'BLOCKED', done: true });
    expect(() => checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir })).toThrow(/bloqueado/);

    resumePhasedPlan({ note: 'se revisó el mock', projectRoot: tempDir });
    expect(getPhasePlan(null, tempDir).status).toBe('ACTIVE');
    expect(checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir }).passed).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'docs', 'bitacora', 'PLAN-S.md'), 'utf-8')).toContain('PLAN_RESUMED');
  });

  it('un check en verde debe reiniciar la racha de fallos', () => {
    startPhasedDevelopment({
      id: 'PLAN-R',
      title: 'Racha',
      phases: [{ id: 'R-1', title: 'Uno' }, { id: 'R-2', title: 'Dos' }],
      maxAttempts: 2,
      projectRoot: tempDir,
    });
    checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir });
    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    expect(checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir }).blocked).toBe(false);
  });

  it('debe bloquear el healthcheck tras N fallos y reanudar en HOTFIX_REQUIRED', () => {
    start(2);
    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    runFinalHealthcheck({ gateRunner: failRunner, projectRoot: tempDir });
    expect(runFinalHealthcheck({ gateRunner: failRunner, projectRoot: tempDir }).blocked).toBe(true);
    expect(() => runFinalHealthcheck({ gateRunner: passRunner, projectRoot: tempDir })).toThrow(/bloqueado/);

    resumePhasedPlan({ projectRoot: tempDir });
    expect(getPhasePlan(null, tempDir).status).toBe('HOTFIX_REQUIRED');
  });

  it('el hook debe bloquear con trabajo pendiente y soltar sin progreso tras maxIdleBlocks', () => {
    start(3);
    const first = evaluateStopHook({ projectRoot: tempDir, maxIdleBlocks: 2 });
    expect(first.block).toBe(true);
    expect(first.reason).toContain('IMPLEMENT_FEATURE');
    expect(evaluateStopHook({ projectRoot: tempDir, maxIdleBlocks: 2 }).block).toBe(true);
    // Tercer intento sin ningún check: se permite detener
    expect(evaluateStopHook({ projectRoot: tempDir, maxIdleBlocks: 2 }).block).toBe(false);

    // Con progreso (un check ejecutado) vuelve a bloquear
    checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir });
    const afterFail = evaluateStopHook({ projectRoot: tempDir, maxIdleBlocks: 2 });
    expect(afterFail.block).toBe(true);
    expect(afterFail.reason).toContain('FIX_BUG');
  });

  it('el hook no debe bloquear sin plan activo ni con el plan completado', () => {
    expect(evaluateStopHook({ projectRoot: tempDir }).block).toBe(false);
    start(3);
    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    runFinalHealthcheck({ gateRunner: passRunner, projectRoot: tempDir });
    expect(evaluateStopHook({ projectRoot: tempDir }).block).toBe(false);
  });

  it('installStopHook debe ser idempotente y conservar la configuración existente', () => {
    const settingsPath = path.join(tempDir, '.claude', 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: ['Bash(pnpm test)'] } }));

    expect(installStopHook(tempDir).installed).toBe(true);
    expect(installStopHook(tempDir).installed).toBe(false);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.permissions.allow).toEqual(['Bash(pnpm test)']);
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(settings.hooks.Stop[0].hooks[0].command).toBe(STOP_HOOK_COMMAND);
  });

  it('agt hook:stop debe imprimir decision block en JSON y salir con código 0', () => {
    start(3);
    const out = execFileSync('node', [CLI, '--root', tempDir, 'hook:stop'], { encoding: 'utf-8' });
    const decision = JSON.parse(out);
    expect(decision.decision).toBe('block');
    expect(decision.reason).toContain('PLAN-S');
  });
});
