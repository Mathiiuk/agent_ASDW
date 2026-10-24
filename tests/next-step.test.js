import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startPhasedDevelopment, checkCurrentPhase, runFinalHealthcheck } from '../src/phase-runner.js';
import { getNextStep } from '../src/next-step.js';
import { callTool } from '../src/mcp-server.js';

const passRunner = () => ({ allPassed: true, results: [{ gate: 'unit_tests', command: 'pnpm test', passed: true }] });
const failRunner = () => ({
  allPassed: false,
  results: [{ gate: 'unit_tests', command: 'pnpm test', passed: false, error: 'AssertionError: boom' }],
});

describe('Siguiente acción del flujo (src/next-step.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'next-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const start = () =>
    startPhasedDevelopment({
      id: 'PLAN-N',
      title: 'Plan next',
      phases: [{ id: 'N-1', title: 'Uno' }, { id: 'N-2', title: 'Dos' }],
      projectRoot: tempDir,
    });

  it('sin plan activo debe devolver NO_ACTIVE_PLAN con done = true', () => {
    const step = getNextStep({ projectRoot: tempDir });
    expect(step.action).toBe('NO_ACTIVE_PLAN');
    expect(step.done).toBe(true);
  });

  it('debe recorrer IMPLEMENT_FEATURE → FIX_BUG → IMPLEMENT_FEATURE → RUN_HEALTHCHECK → FIX_HOTFIX → DONE', () => {
    start();
    let step = getNextStep({ projectRoot: tempDir });
    expect(step).toMatchObject({ action: 'IMPLEMENT_FEATURE', task: 'N-1', done: false, tool: 'check_current_phase' });
    expect(step.artifacts.spec).toBe('.agents/workflow/specs/N-1.md');

    checkCurrentPhase({ gateRunner: failRunner, projectRoot: tempDir });
    step = getNextStep({ projectRoot: tempDir });
    expect(step).toMatchObject({ action: 'FIX_BUG', task: 'N-1-FIX-1', phaseTask: 'N-1' });
    expect(step.diagnosis).toContain('ASSERTION_FAILURE');

    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    step = getNextStep({ projectRoot: tempDir });
    expect(step).toMatchObject({ action: 'IMPLEMENT_FEATURE', task: 'N-2', progress: { done: 1, total: 2 } });

    checkCurrentPhase({ gateRunner: passRunner, projectRoot: tempDir });
    expect(getNextStep({ projectRoot: tempDir })).toMatchObject({ action: 'RUN_HEALTHCHECK', tool: 'run_final_healthcheck' });

    runFinalHealthcheck({ gateRunner: failRunner, projectRoot: tempDir });
    expect(getNextStep({ projectRoot: tempDir })).toMatchObject({ action: 'FIX_HOTFIX', task: 'PLAN-N-HOTFIX-1' });

    runFinalHealthcheck({ gateRunner: passRunner, projectRoot: tempDir });
    // El plan completado ya no está activo: se consulta por ID
    expect(getNextStep({ planId: 'PLAN-N', projectRoot: tempDir })).toMatchObject({ action: 'DONE', done: true });
    expect(getNextStep({ projectRoot: tempDir }).action).toBe('NO_ACTIVE_PLAN');
  });

  it('la tool MCP next_step debe devolver la misma acción', async () => {
    start();
    const step = await callTool('next_step', { projectRoot: tempDir });
    expect(step.action).toBe('IMPLEMENT_FEATURE');
  });
});
