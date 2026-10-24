import path from 'node:path';
import { getActivePhasePlanId, getPhasePlan } from './phase-runner.js';

/**
 * Rutas relativas de los artefactos de una tarea que la IA debe leer y completar
 *
 * @param {string} id - ID de la tarea
 * @returns {object} - Rutas de manifiesto, spec, plan, plan de pruebas, feature BDD y reporte
 */
function taskArtifacts(id) {
  const base = path.posix.join('.agents', 'workflow');
  return {
    manifest: `${base}/tasks/${id}.yml`,
    spec: `${base}/specs/${id}.md`,
    plan: `${base}/plans/${id}.md`,
    tests: `${base}/tests/${id}.md`,
    feature: `${base}/features/${id}.feature`,
    report: `${base}/executions/${id}.md`,
  };
}

/**
 * Calcula la siguiente acción concreta del flujo por fases a partir del estado persistido.
 * Pensado para que un agente de IA trabaje en bucle: llamar a next_step, ejecutar la acción y repetir
 * hasta recibir done = true.
 *
 * @param {object} [options] - Parámetros
 * @param {string} [options.planId] - ID del plan (por defecto, el plan activo)
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ action: string, done: boolean, instructions: string, tool?: string, cli?: string, planId?: string, task?: string, progress?: object }}
 */
export function getNextStep({ planId = null, projectRoot = process.cwd() } = {}) {
  const id = planId || getActivePhasePlanId(projectRoot);
  if (!id) {
    return {
      action: 'NO_ACTIVE_PLAN',
      done: true,
      instructions: 'No hay un plan por fases activo. Para una entrega de varias features, crea uno con start_phased_plan (agt phase:start).',
      tool: 'start_phased_plan',
      cli: 'agt phase:start <PLAN-ID> -t "<Título>" -p "<TASK-ID>:<Título>"',
    };
  }

  const plan = getPhasePlan(id, projectRoot);
  const doneCount = plan.phases.filter((p) => p.status === 'DONE').length;
  const common = {
    planId: plan.id,
    planStatus: plan.status,
    progress: { done: doneCount, total: plan.phases.length },
    log: `docs/bitacora/${plan.id}.md`,
  };

  if (plan.status === 'COMPLETED') {
    return { ...common, action: 'DONE', done: true, instructions: `El plan ${plan.id} está completado. Revisa y commitea la bitácora junto con el código.` };
  }

  if (plan.status === 'BLOCKED') {
    return {
      ...common,
      action: 'BLOCKED',
      done: true,
      instructions: `El plan ${plan.id} está bloqueado: ${plan.blocked_reason}. Se requiere intervención humana; reanuda con agt phase:resume.`,
      cli: 'agt phase:resume',
    };
  }

  if (plan.status === 'HEALTHCHECK') {
    return {
      ...common,
      action: 'RUN_HEALTHCHECK',
      done: false,
      instructions: 'Todas las fases están en verde. Ejecuta el healthcheck final.',
      tool: 'run_final_healthcheck',
      cli: 'agt phase:health',
    };
  }

  if (plan.status === 'HOTFIX_REQUIRED') {
    const hotfix = plan.fixes.find((f) => f.type === 'hotfix' && f.status === 'OPEN');
    return {
      ...common,
      action: 'FIX_HOTFIX',
      done: false,
      task: hotfix.id,
      diagnosis: hotfix.diagnosis,
      artifacts: taskArtifacts(hotfix.id),
      instructions: `El healthcheck final falló (${hotfix.diagnosis}). Ejecuta los comandos del healthcheck, localiza la causa raíz, corrígela y vuelve a ejecutar el healthcheck.`,
      healthCommands: plan.healthcheck.commands,
      tool: 'run_final_healthcheck',
      cli: 'agt phase:health',
    };
  }

  // Plan ACTIVE: feat en curso o fix abierto de la fase actual
  const phase = plan.phases[plan.current_phase];
  const openFix = plan.fixes.find((f) => f.origin === phase.task_id && f.status === 'OPEN');

  if (openFix) {
    return {
      ...common,
      action: 'FIX_BUG',
      done: false,
      task: openFix.id,
      phaseTask: phase.task_id,
      diagnosis: openFix.diagnosis,
      artifacts: { ...taskArtifacts(openFix.id), report: taskArtifacts(phase.task_id).report },
      instructions: `El check de ${phase.task_id} falló (${openFix.diagnosis}). Lee el reporte, corrige la causa raíz y vuelve a ejecutar el check de la fase.`,
      tool: 'check_current_phase',
      cli: 'agt phase:check',
    };
  }

  return {
    ...common,
    action: 'IMPLEMENT_FEATURE',
    done: false,
    task: phase.task_id,
    title: phase.title,
    phaseNumber: plan.current_phase + 1,
    artifacts: taskArtifacts(phase.task_id),
    instructions: `Implementa la fase ${plan.current_phase + 1}/${plan.phases.length} "${phase.title}" (${phase.task_id}): completa spec, plan y escenarios BDD, escribe los tests y el código, y ejecuta el check de la fase.`,
    tool: 'check_current_phase',
    cli: 'agt phase:check',
  };
}
