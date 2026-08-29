// Importamos execSync para ejecutar los comandos de los quality gates en la shell
import { execSync } from 'node:child_process';

/**
 * Estados válidos que puede tener una tarea según la máquina de estados del workflow
 */
export const VALID_STATUSES = [
  'BACKLOG',
  'ANALYSIS',
  'PLANNED',
  'WAITING_APPROVAL',
  'READY',
  'IN_PROGRESS',
  'VERIFYING',
  'FIXING',
  'READY_FOR_PR',
  'PR_OPEN',
  'APPROVED',
  'MERGED',
  'DEPLOYING',
  'MONITORING',
  'DONE',
  'INCIDENT',
  'ROLLBACK',
];

/**
 * Tipos de tareas admitidos en las convenciones del repositorio
 */
export const VALID_TYPES = [
  'feat',
  'fix',
  'hotfix',
  'refactor',
  'security',
  'test',
  'docs',
  'chore',
];

/**
 * Valida que un manifiesto de tarea cumpla con la estructura y campos obligatorios.
 * 
 * @param {object} manifest - Objeto con los datos del manifiesto YAML
 * @returns {{ valid: boolean, errors: string[] }} - Resultado de la validación
 */
export function validateManifest(manifest) {
  const errors = [];

  // Verificamos que el objeto exista
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['El manifiesto es nulo o no es un objeto válido.'] };
  }

  // Validación de campo 'id'
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('El campo obligatorio "id" falta o no es un string.');
  }

  // Validación de campo 'title'
  if (!manifest.title || typeof manifest.title !== 'string') {
    errors.push('El campo obligatorio "title" falta o no es un string.');
  }

  // Validación de campo 'type'
  if (!manifest.type || !VALID_TYPES.includes(manifest.type.toLowerCase())) {
    errors.push(`El campo "type" es inválido. Debe ser uno de: ${VALID_TYPES.join(', ')}.`);
  }

  // Validación de campo 'status'
  if (!manifest.status || !VALID_STATUSES.includes(manifest.status.toUpperCase())) {
    errors.push(`El campo "status" es inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}.`);
  }

  // Validación de quality_gates
  if (!manifest.quality_gates || typeof manifest.quality_gates !== 'object') {
    errors.push('El campo "quality_gates" debe ser un objeto con los gates requeridos.');
  }

  // Retornamos si es válido y la lista de posibles errores encontrados
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Ejecuta los Quality Gates configurados en el manifiesto de una tarea.
 * 
 * @param {object} taskManifest - Manifiesto de la tarea a verificar
 * @param {string} projectRoot - Directorio de trabajo
 * @returns {{ allPassed: boolean, results: Array<{ gate: string, command: string, passed: boolean, output: string, error?: string }> }} - Resultados
 */
export function runQualityGates(taskManifest, projectRoot = process.cwd()) {
  const gates = taskManifest.quality_gates || {};
  const commands = taskManifest.commands || {};
  const results = [];
  let allPassed = true;

  // Recorremos los quality gates activados en el manifiesto (valor true)
  for (const [gateName, isEnabled] of Object.entries(gates)) {
    if (isEnabled) {
      // Buscamos el comando asociado al gate (ej: unit_tests -> commands.unit_tests)
      const command = commands[gateName];

      if (!command) {
        // Si el gate está activo pero no hay comando asignado, se marca como advertencia/fallo
        results.push({
          gate: gateName,
          command: 'N/A',
          passed: false,
          output: '',
          error: `Gate "${gateName}" activado pero no tiene comando configurado en "commands".`,
        });
        allPassed = false;
        continue;
      }

      try {
        // Ejecutamos el comando del gate
        const output = execSync(command, {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Registramos el resultado exitoso
        results.push({
          gate: gateName,
          command,
          passed: true,
          output: output.trim(),
        });
      } catch (err) {
        // Capturamos la salida de error
        const errorOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + err.message;
        results.push({
          gate: gateName,
          command,
          passed: false,
          output: '',
          error: errorOutput.trim(),
        });
        allPassed = false;
      }
    }
  }

  // Retornamos el balance general de todos los gates
  return {
    allPassed,
    results,
  };
}
