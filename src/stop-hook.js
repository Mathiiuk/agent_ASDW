import fs from 'node:fs';
import path from 'node:path';
import { getNextStep } from './next-step.js';
import { getActivePhasePlanId, getPhasePlan } from './phase-runner.js';

/**
 * Archivo donde el hook recuerda cuántas veces bloqueó el cierre sin que el plan avanzara
 */
const STOP_STATE_PATH = path.join('.agents', 'workflow', 'phases', 'stop-hook.json');

/**
 * Bloqueos seguidos sin progreso del plan antes de dejar que el agente se detenga
 */
export const DEFAULT_MAX_IDLE_BLOCKS = 2;

/**
 * Comando que se registra en el hook Stop de Claude Code
 */
export const STOP_HOOK_COMMAND = 'agt hook:stop';

/**
 * Huella del progreso del plan: cambia cada vez que se ejecuta un check o un healthcheck.
 *
 * @param {object} plan - Estado del plan
 * @returns {string} - Huella comparable
 */
function planFingerprint(plan) {
  const checks = plan.phases.reduce((acc, p) => acc + p.checks, 0);
  return `${plan.status}|${plan.current_phase}|${checks}|${plan.healthcheck.runs}`;
}

/**
 * Decide si el agente puede terminar su turno. Bloquea mientras el plan por fases tenga trabajo
 * pendiente, salvo que el agente lleve maxIdleBlocks bloqueos seguidos sin ejecutar ningún check
 * (salvaguarda contra bucles infinitos y gasto de tokens).
 *
 * @param {object} [options] - Parámetros
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @param {number} [options.maxIdleBlocks=DEFAULT_MAX_IDLE_BLOCKS] - Bloqueos sin progreso tolerados
 * @returns {{ block: boolean, reason: string, step: object }} - Decisión del hook
 */
export function evaluateStopHook({ projectRoot = process.cwd(), maxIdleBlocks = DEFAULT_MAX_IDLE_BLOCKS } = {}) {
  const step = getNextStep({ projectRoot });
  const statePath = path.join(projectRoot, STOP_STATE_PATH);

  if (step.done) {
    fs.rmSync(statePath, { force: true });
    return { block: false, reason: step.instructions, step };
  }

  const plan = getPhasePlan(getActivePhasePlanId(projectRoot), projectRoot);
  const fingerprint = planFingerprint(plan);
  let state = { fingerprint: null, idleBlocks: 0 };
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch {
      // Estado corrupto: se reinicia
    }
  }

  const idleBlocks = state.fingerprint === fingerprint ? state.idleBlocks + 1 : 1;
  if (idleBlocks > maxIdleBlocks) {
    fs.rmSync(statePath, { force: true });
    return {
      block: false,
      reason: `El plan ${plan.id} no avanzó tras ${maxIdleBlocks} avisos; se permite detener al agente. Pendiente: ${step.action}.`,
      step,
    };
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ fingerprint, idleBlocks }), 'utf-8');

  const progress = step.progress ? ` (${step.progress.done}/${step.progress.total} fases en verde)` : '';
  const target = step.task ? ` ${step.task}` : '';
  return {
    block: true,
    reason: `El plan ${plan.id} no está terminado${progress}. Siguiente acción: ${step.action}${target}. ${step.instructions} Luego ejecuta \`${step.cli}\` (o la tool MCP ${step.tool}) y consulta \`agt next\`.`,
    step,
  };
}

/**
 * Registra el hook Stop del agente en .claude/settings.json del proyecto, conservando
 * la configuración existente. Es idempotente.
 *
 * @param {string} [projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ path: string, installed: boolean }} - Ruta del settings y si se agregó el hook
 */
export function installStopHook(projectRoot = process.cwd()) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  }

  settings.hooks = settings.hooks || {};
  settings.hooks.Stop = settings.hooks.Stop || [];
  const alreadyInstalled = settings.hooks.Stop.some((group) =>
    (group.hooks || []).some((h) => h.command === STOP_HOOK_COMMAND)
  );
  if (alreadyInstalled) {
    return { path: settingsPath, installed: false };
  }

  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: STOP_HOOK_COMMAND }] });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  return { path: settingsPath, installed: true };
}
