// Importamos los módulos nativos de sistema de archivos y rutas
import fs from 'node:fs';
import path from 'node:path';
// Importamos js-yaml para persistir el estado del plan por fases
import yaml from 'js-yaml';
// Importamos las utilidades de tareas, validación y diagnóstico existentes en nuestro motor
import { createTask, getTask, updateTask, updateTaskStatus } from './task-manager.js';
import { runQualityGates } from './validator.js';
import { diagnoseFailure, generateExecutionReport } from './workflow-runner.js';

/**
 * Rutas relativas del modo de desarrollo por fases
 */
export const PHASE_PATHS = {
  // Estado interno de cada plan por fases (máquina de estados)
  plans: path.join('.agents', 'workflow', 'phases'),
  // Puntero al plan activo (el "modo por fases" está activo mientras exista)
  active: path.join('.agents', 'workflow', 'phases', 'ACTIVE'),
  // Bitácora legible por humanos en /docs
  logs: path.join('docs', 'bitacora'),
};

/**
 * Estados posibles de un plan por fases
 */
export const PLAN_STATUSES = ['ACTIVE', 'HEALTHCHECK', 'HOTFIX_REQUIRED', 'COMPLETED'];

/**
 * Comandos por defecto del healthcheck final (suite completa del proyecto)
 */
export const DEFAULT_HEALTH_COMMANDS = {
  unit_tests: 'pnpm test',
  bdd_tests: 'pnpm test:bdd',
};

/**
 * Retorna la fecha y hora actual en formato ISO (UTC)
 *
 * @returns {string} - Marca de tiempo ISO
 */
function now() {
  return new Date().toISOString();
}

/**
 * Construye la ruta absoluta al archivo de estado de un plan
 *
 * @param {string} planId - Identificador del plan
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {string} - Ruta absoluta del YAML de estado
 */
function planPath(planId, projectRoot) {
  return path.join(projectRoot, PHASE_PATHS.plans, `${planId}.yml`);
}

/**
 * Verifica si existe el manifiesto de una tarea
 *
 * @param {string} id - Identificador de la tarea
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {boolean} - true si la tarea ya existe
 */
function taskExists(id, projectRoot) {
  return fs.existsSync(path.join(projectRoot, '.agents', 'workflow', 'tasks', `${id}.yml`));
}

/**
 * Agrega una entrada cronológica a la bitácora del plan
 *
 * @param {object} plan - Estado del plan
 * @param {string} event - Tipo de evento (PLAN_START, FEAT_CHECK_PASS, FIX_CREATED, etc.)
 * @param {string} detail - Descripción legible del evento
 */
function addLog(plan, event, detail) {
  plan.log.push({ at: now(), event, detail });
}

/**
 * Obtiene el ID del plan por fases activo, o null si el modo por fases no está activo.
 *
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {string|null} - ID del plan activo
 */
export function getActivePhasePlanId(projectRoot = process.cwd()) {
  const activePath = path.join(projectRoot, PHASE_PATHS.active);
  if (!fs.existsSync(activePath)) {
    return null;
  }
  // Leemos el ID guardado y eliminamos espacios o saltos de línea
  const id = fs.readFileSync(activePath, 'utf-8').trim();
  return id || null;
}

/**
 * Lee el estado de un plan por fases. Si no se pasa ID, usa el plan activo.
 *
 * @param {string|null} planId - Identificador del plan
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Estado del plan
 */
export function getPhasePlan(planId = null, projectRoot = process.cwd()) {
  const id = planId || getActivePhasePlanId(projectRoot);
  if (!id) {
    throw new Error('El modo por fases no está activo. Inícialo con: agt phase:start <PLAN-ID> -t "..." -p "<TASK-ID>:<Título>"');
  }
  const file = planPath(id, projectRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró el plan por fases '${id}' en ${file}`);
  }
  return yaml.load(fs.readFileSync(file, 'utf-8'));
}

/**
 * Genera el contenido Markdown de la bitácora a partir del estado del plan.
 *
 * @param {object} plan - Estado del plan
 * @returns {string} - Documento Markdown de la bitácora
 */
export function renderPhaseLog(plan) {
  const icons = { PENDING: '⏳', IN_PROGRESS: '🔨', FIXING: '🩹', DONE: '✅', OPEN: '🔴', RESOLVED: '🟢' };

  let md = `# Bitácora de Desarrollo por Fases - ${plan.id}\n\n`;
  md += `> **${plan.title}**\n\n`;
  md += `- **Estado del plan:** \`${plan.status}\`\n`;
  md += `- **Inicio (UTC):** ${plan.created_at}\n`;
  md += `- **Última actualización (UTC):** ${plan.updated_at}\n`;
  md += `- **Flujo:** \`feat → check → siguiente feat\` · bug en check → \`fix\` · healthcheck final · bug en healthcheck → \`hotfix\`\n\n`;

  // Tabla de fases
  md += `## 1. Fases\n\n`;
  md += `| # | Tarea | Título | Estado | Checks | Fixes |\n|---|---|---|---|---|---|\n`;
  plan.phases.forEach((p, i) => {
    md += `| ${i + 1} | \`${p.task_id}\` | ${p.title} | ${icons[p.status] || ''} ${p.status} | ${p.checks} | ${p.fixes.length ? p.fixes.map((f) => `\`${f}\``).join(', ') : '-'} |\n`;
  });

  // Tabla de fixes y hotfixes
  md += `\n## 2. Fixes y Hotfixes\n\n`;
  if (plan.fixes.length === 0) {
    md += `Sin bugs detectados hasta el momento.\n`;
  } else {
    md += `| Tarea | Tipo | Origen | Estado | Diagnóstico |\n|---|---|---|---|---|\n`;
    for (const f of plan.fixes) {
      md += `| \`${f.id}\` | ${f.type} | ${f.origin} | ${icons[f.status] || ''} ${f.status} | ${f.diagnosis.replace(/\|/g, '\\|')} |\n`;
    }
  }

  // Resultado del healthcheck final
  md += `\n## 3. Healthcheck Final\n\n`;
  md += `- **Comandos:** ${Object.entries(plan.healthcheck.commands).map(([k, v]) => `\`${k}\` → \`${v}\``).join(', ')}\n`;
  md += `- **Ejecuciones:** ${plan.healthcheck.runs}\n`;
  if (plan.healthcheck.last_result) {
    md += `- **Último resultado:** ${plan.healthcheck.last_result.passed ? '✔ PASS' : '✖ FAIL'} (${plan.healthcheck.last_result.at})\n`;
    for (const r of plan.healthcheck.last_result.gates) {
      md += `  - \`${r.gate}\`: ${r.passed ? '✔ PASS' : '✖ FAIL'}\n`;
    }
  } else {
    md += `- **Último resultado:** pendiente\n`;
  }

  // Registro cronológico de eventos
  md += `\n## 4. Registro Cronológico\n\n`;
  for (const entry of plan.log) {
    md += `- \`${entry.at}\` **${entry.event}** — ${entry.detail}\n`;
  }

  return md;
}

/**
 * Persiste el estado del plan y regenera su bitácora en docs/bitacora/<PLAN-ID>.md
 *
 * @param {object} plan - Estado del plan
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {string} - Ruta absoluta de la bitácora generada
 */
export function savePhasePlan(plan, projectRoot = process.cwd()) {
  plan.updated_at = now();

  // Guardamos el estado interno en YAML
  const plansDir = path.join(projectRoot, PHASE_PATHS.plans);
  fs.mkdirSync(plansDir, { recursive: true });
  fs.writeFileSync(planPath(plan.id, projectRoot), yaml.dump(plan, { indent: 2 }), 'utf-8');

  // Regeneramos la bitácora legible en /docs
  const logsDir = path.join(projectRoot, PHASE_PATHS.logs);
  fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `${plan.id}.md`);
  fs.writeFileSync(logPath, renderPhaseLog(plan), 'utf-8');
  return logPath;
}

/**
 * Crea una tarea de corrección (fix u hotfix) heredando los gates indicados.
 *
 * @param {object} params - Parámetros de la corrección
 * @param {string} params.id - ID de la nueva tarea de corrección
 * @param {string} params.type - 'fix' u 'hotfix'
 * @param {string} params.title - Título descriptivo
 * @param {object} params.qualityGates - Gates a activar en la corrección
 * @param {object} params.commands - Comandos asociados a cada gate
 * @param {string} params.projectRoot - Directorio raíz del proyecto
 */
function createCorrectionTask({ id, type, title, qualityGates, commands, projectRoot }) {
  // Los fixes se trabajan en la rama activa: nunca creamos rama nueva (regla del workflow)
  createTask({ id, title, type, createBranch: false, projectRoot });
  // Heredamos los gates para que la corrección se valide con los mismos checks que detectaron el bug
  updateTask(id, { quality_gates: qualityGates, commands, status: 'FIXING' }, projectRoot);
}

/**
 * Activa el modo de desarrollo por fases creando un plan con una lista ordenada de features.
 *
 * @param {object} options - Parámetros del plan
 * @param {string} options.id - Identificador del plan (ej: PLAN-001)
 * @param {string} options.title - Título del plan
 * @param {Array<{ id: string, title: string }>} options.phases - Fases (features) en orden de ejecución
 * @param {object} [options.healthCommands] - Comandos del healthcheck final
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ plan: object, logPath: string }} - Plan creado y ruta de su bitácora
 */
export function startPhasedDevelopment({
  id,
  title,
  phases = [],
  healthCommands = DEFAULT_HEALTH_COMMANDS,
  projectRoot = process.cwd(),
}) {
  if (!id) {
    throw new Error('El ID del plan por fases es obligatorio (ej: PLAN-001).');
  }
  if (!title) {
    throw new Error('El título del plan por fases es obligatorio.');
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    throw new Error('Debes definir al menos una fase (feat) para el plan.');
  }

  // Solo puede haber un plan activo a la vez
  const activeId = getActivePhasePlanId(projectRoot);
  if (activeId) {
    throw new Error(`Ya hay un plan por fases activo: '${activeId}'. Complétalo antes de iniciar otro.`);
  }
  if (fs.existsSync(planPath(id, projectRoot))) {
    throw new Error(`El plan por fases '${id}' ya existe.`);
  }

  // Creamos (si no existen) las tareas feat de cada fase, sin rama propia: todo el plan vive en la rama activa
  for (const phase of phases) {
    if (!phase.id || !phase.title) {
      throw new Error('Cada fase requiere "id" y "title" (formato CLI: <TASK-ID>:<Título>).');
    }
    if (!taskExists(phase.id, projectRoot)) {
      createTask({ id: phase.id, title: phase.title, type: 'feat', createBranch: false, projectRoot });
    }
  }

  const timestamp = now();
  const plan = {
    id,
    title,
    status: 'ACTIVE',
    created_at: timestamp,
    updated_at: timestamp,
    current_phase: 0,
    phases: phases.map((p, i) => ({
      task_id: p.id,
      title: p.title,
      status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
      checks: 0,
      fixes: [],
    })),
    fixes: [],
    healthcheck: { commands: healthCommands, runs: 0, last_result: null },
    log: [],
  };

  addLog(plan, 'PLAN_START', `Modo por fases activado con ${phases.length} fase(s): ${phases.map((p) => p.id).join(' → ')}`);
  addLog(plan, 'FEAT_START', `Inicia fase 1: \`${phases[0].id}\` ${phases[0].title}`);
  updateTaskStatus(phases[0].id, 'IN_PROGRESS', projectRoot);

  // Marcamos el plan como activo
  fs.mkdirSync(path.join(projectRoot, PHASE_PATHS.plans), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, PHASE_PATHS.active), id, 'utf-8');

  const logPath = savePhasePlan(plan, projectRoot);
  return { plan, logPath };
}

/**
 * Ejecuta el "check" de la fase actual. Si pasa, avanza a la siguiente feat;
 * si falla, abre una tarea fix vinculada a la fase.
 *
 * @param {object} [options] - Parámetros
 * @param {string} [options.planId] - ID del plan (por defecto, el plan activo)
 * @param {Function} [options.gateRunner=runQualityGates] - Ejecutor de quality gates (inyectable en tests)
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ passed: boolean, phase: object, nextPhase: object|null, fixTask: string|null, diagnostics: Array<object>, readyForHealthcheck: boolean, logPath: string }}
 */
export function checkCurrentPhase({ planId = null, gateRunner = runQualityGates, projectRoot = process.cwd() } = {}) {
  const plan = getPhasePlan(planId, projectRoot);
  if (plan.status !== 'ACTIVE') {
    throw new Error(`El plan '${plan.id}' está en estado ${plan.status}; no hay fases pendientes de check. Usa: agt phase:health`);
  }

  const phase = plan.phases[plan.current_phase];
  const task = getTask(phase.task_id, projectRoot);
  phase.checks += 1;

  // Ejecutamos los quality gates de la feat actual
  const execution = gateRunner(task, projectRoot);
  const openFixes = plan.fixes.filter((f) => f.origin === phase.task_id && f.status === 'OPEN');
  let nextPhase = null;
  let fixTask = null;
  let diagnostics = [];

  if (execution.allPassed) {
    // CHECK OK: cerramos fixes abiertos de la fase, marcamos la feat como lista y avanzamos
    for (const fix of openFixes) {
      fix.status = 'RESOLVED';
      updateTaskStatus(fix.id, 'READY_FOR_PR', projectRoot);
      addLog(plan, 'FIX_RESOLVED', `\`${fix.id}\` resuelto: el check de \`${phase.task_id}\` volvió a verde`);
    }
    phase.status = 'DONE';
    updateTaskStatus(phase.task_id, 'READY_FOR_PR', projectRoot);
    addLog(plan, 'FEAT_CHECK_PASS', `Check de \`${phase.task_id}\` en verde (intento ${phase.checks})`);

    if (plan.current_phase + 1 < plan.phases.length) {
      plan.current_phase += 1;
      nextPhase = plan.phases[plan.current_phase];
      nextPhase.status = 'IN_PROGRESS';
      updateTaskStatus(nextPhase.task_id, 'IN_PROGRESS', projectRoot);
      addLog(plan, 'FEAT_START', `Inicia fase ${plan.current_phase + 1}: \`${nextPhase.task_id}\` ${nextPhase.title}`);
    } else {
      plan.status = 'HEALTHCHECK';
      addLog(plan, 'PHASES_DONE', 'Todas las fases completadas. Pendiente healthcheck final.');
    }
  } else {
    // CHECK FALLIDO: diagnosticamos y abrimos (o reutilizamos) un fix para la fase
    diagnostics = diagnoseFailure(execution.results);
    const diagnosis = diagnostics.map((d) => `[${d.category}] ${d.gate}`).join('; ');
    phase.status = 'FIXING';
    updateTaskStatus(phase.task_id, 'FIXING', projectRoot);

    if (openFixes.length > 0) {
      fixTask = openFixes[0].id;
      openFixes[0].diagnosis = diagnosis;
      addLog(plan, 'FEAT_CHECK_FAIL', `Check de \`${phase.task_id}\` sigue fallando (intento ${phase.checks}); fix abierto: \`${fixTask}\` — ${diagnosis}`);
    } else {
      fixTask = `${phase.task_id}-FIX-${phase.fixes.length + 1}`;
      createCorrectionTask({
        id: fixTask,
        type: 'fix',
        title: `Fix de ${phase.task_id}: ${phase.title}`,
        qualityGates: task.quality_gates,
        commands: task.commands,
        projectRoot,
      });
      phase.fixes.push(fixTask);
      plan.fixes.push({ id: fixTask, type: 'fix', origin: phase.task_id, status: 'OPEN', diagnosis });
      addLog(plan, 'FIX_CREATED', `Bug en check de \`${phase.task_id}\` → se crea \`${fixTask}\` — ${diagnosis}`);
    }
  }

  // Dejamos evidencia del check en el reporte de ejecución estándar de la tarea
  generateExecutionReport(
    phase.task_id,
    { success: execution.allPassed, iterations: phase.checks, results: execution.results, diagnostics },
    projectRoot
  );

  const logPath = savePhasePlan(plan, projectRoot);
  return {
    passed: execution.allPassed,
    phase,
    nextPhase,
    fixTask,
    diagnostics,
    readyForHealthcheck: plan.status === 'HEALTHCHECK',
    logPath,
  };
}

/**
 * Ejecuta el healthcheck final del plan (suite completa). Si pasa, el plan se completa
 * y se desactiva el modo por fases; si falla, se abre una tarea hotfix.
 *
 * @param {object} [options] - Parámetros
 * @param {string} [options.planId] - ID del plan (por defecto, el plan activo)
 * @param {Function} [options.gateRunner=runQualityGates] - Ejecutor de quality gates (inyectable en tests)
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ passed: boolean, results: Array<object>, hotfixTask: string|null, diagnostics: Array<object>, logPath: string }}
 */
export function runFinalHealthcheck({ planId = null, gateRunner = runQualityGates, projectRoot = process.cwd() } = {}) {
  const plan = getPhasePlan(planId, projectRoot);
  if (plan.status === 'ACTIVE') {
    const pending = plan.phases.filter((p) => p.status !== 'DONE').map((p) => p.task_id);
    throw new Error(`Aún hay fases sin check en verde: ${pending.join(', ')}. Usa: agt phase:check`);
  }
  if (plan.status === 'COMPLETED') {
    throw new Error(`El plan '${plan.id}' ya fue completado.`);
  }

  // Construimos un manifiesto virtual con los comandos del healthcheck
  const commands = plan.healthcheck.commands;
  const qualityGates = Object.fromEntries(Object.keys(commands).map((k) => [k, true]));
  const execution = gateRunner({ id: `${plan.id}-HEALTH`, quality_gates: qualityGates, commands }, projectRoot);

  plan.healthcheck.runs += 1;
  plan.healthcheck.last_result = {
    at: now(),
    passed: execution.allPassed,
    gates: execution.results.map((r) => ({ gate: r.gate, passed: r.passed })),
  };

  const openHotfixes = plan.fixes.filter((f) => f.type === 'hotfix' && f.status === 'OPEN');
  let hotfixTask = null;
  let diagnostics = [];

  if (execution.allPassed) {
    // HEALTHCHECK OK: cerramos hotfixes, completamos el plan y desactivamos el modo por fases
    for (const fix of openHotfixes) {
      fix.status = 'RESOLVED';
      updateTaskStatus(fix.id, 'READY_FOR_PR', projectRoot);
      addLog(plan, 'HOTFIX_RESOLVED', `\`${fix.id}\` resuelto: healthcheck en verde`);
    }
    plan.status = 'COMPLETED';
    addLog(plan, 'HEALTHCHECK_PASS', `Healthcheck final en verde (ejecución ${plan.healthcheck.runs}). Plan completado.`);
    const activePath = path.join(projectRoot, PHASE_PATHS.active);
    if (getActivePhasePlanId(projectRoot) === plan.id) {
      fs.rmSync(activePath, { force: true });
    }
  } else {
    // HEALTHCHECK FALLIDO: abrimos (o reutilizamos) un hotfix
    diagnostics = diagnoseFailure(execution.results);
    const diagnosis = diagnostics.map((d) => `[${d.category}] ${d.gate}`).join('; ');
    plan.status = 'HOTFIX_REQUIRED';

    if (openHotfixes.length > 0) {
      hotfixTask = openHotfixes[0].id;
      openHotfixes[0].diagnosis = diagnosis;
      addLog(plan, 'HEALTHCHECK_FAIL', `Healthcheck sigue fallando (ejecución ${plan.healthcheck.runs}); hotfix abierto: \`${hotfixTask}\` — ${diagnosis}`);
    } else {
      const count = plan.fixes.filter((f) => f.type === 'hotfix').length + 1;
      hotfixTask = `${plan.id}-HOTFIX-${count}`;
      createCorrectionTask({
        id: hotfixTask,
        type: 'hotfix',
        title: `Hotfix del healthcheck final de ${plan.id}`,
        qualityGates,
        commands,
        projectRoot,
      });
      plan.fixes.push({ id: hotfixTask, type: 'hotfix', origin: 'healthcheck', status: 'OPEN', diagnosis });
      addLog(plan, 'HOTFIX_CREATED', `Bug en healthcheck final → se crea \`${hotfixTask}\` — ${diagnosis}`);
    }
  }

  const logPath = savePhasePlan(plan, projectRoot);
  return { passed: execution.allPassed, results: execution.results, hotfixTask, diagnostics, logPath };
}

/**
 * Convierte la notación CLI "<TASK-ID>:<Título>" en un objeto de fase.
 *
 * @param {string} value - Texto en formato "AGT-0012:Login con OAuth"
 * @returns {{ id: string, title: string }} - Fase parseada
 */
export function parsePhaseArg(value) {
  const sep = value.indexOf(':');
  if (sep <= 0 || sep === value.length - 1) {
    throw new Error(`Fase inválida "${value}". Formato esperado: <TASK-ID>:<Título>`);
  }
  return { id: value.slice(0, sep).trim(), title: value.slice(sep + 1).trim() };
}
