// Importamos las funciones de Cucumber para definir los pasos
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
// Importamos módulos de Node.js para crear entornos de prueba temporales aislados
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
// Importamos el modo por fases y el gestor de tareas
import { getTask } from '../../../src/task-manager.js';
import {
  startPhasedDevelopment,
  checkCurrentPhase,
  runFinalHealthcheck,
  getPhasePlan,
  getActivePhasePlanId,
  parsePhaseArg,
} from '../../../src/phase-runner.js';

// Ejecutores de gates simulados para no lanzar comandos reales
const passRunner = () => ({ allPassed: true, results: [{ gate: 'unit_tests', command: 'pnpm test', passed: true }] });
const failRunner = () => ({
  allPassed: false,
  results: [{ gate: 'unit_tests', command: 'pnpm test', passed: false, error: 'AssertionError: boom' }],
});

// Contexto del escenario
let phaseDir;
let planId;

// Creamos un directorio aislado solo para los escenarios de AGT-0011
Before(function () {
  phaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-phase-'));
});

// Limpiamos el directorio temporal al terminar
After(function () {
  if (phaseDir && fs.existsSync(phaseDir)) {
    fs.rmSync(phaseDir, { recursive: true, force: true });
  }
});

Given('a phased plan {string} with phases {string} and {string}', function (id, first, second) {
  planId = id;
  startPhasedDevelopment({ id, title: 'Plan BDD', phases: [parsePhaseArg(first), parsePhaseArg(second)], projectRoot: phaseDir });
});

When('the phase check passes', function () {
  checkCurrentPhase({ planId, gateRunner: passRunner, projectRoot: phaseDir });
});

When('the phase check fails', function () {
  checkCurrentPhase({ planId, gateRunner: failRunner, projectRoot: phaseDir });
});

When('the final healthcheck passes', function () {
  runFinalHealthcheck({ planId, gateRunner: passRunner, projectRoot: phaseDir });
});

When('the final healthcheck fails', function () {
  runFinalHealthcheck({ planId, gateRunner: failRunner, projectRoot: phaseDir });
});

Then('the current phase should be {string}', function (taskId) {
  const plan = getPhasePlan(planId, phaseDir);
  assert.strictEqual(plan.phases[plan.current_phase].task_id, taskId);
});

Then('the phased plan status should be {string}', function (status) {
  assert.strictEqual(getPhasePlan(planId, phaseDir).status, status);
});

Then('the phased mode should be inactive', function () {
  assert.strictEqual(getActivePhasePlanId(phaseDir), null);
});

Then('a {string} task {string} should exist', function (type, taskId) {
  assert.strictEqual(getTask(taskId, phaseDir).type, type);
});

Then('the log {string} should mention {string}', function (relativePath, text) {
  const content = fs.readFileSync(path.join(phaseDir, relativePath), 'utf-8');
  assert.ok(content.includes(text), `La bitácora debe mencionar "${text}"`);
});
