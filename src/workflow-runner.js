// Importamos los módulos nativos de sistema de archivos y rutas
import fs from 'node:fs';
import path from 'node:path';
// Importamos las utilidades de tareas y validación existentes en nuestro motor
import { getTask, updateTaskStatus } from './task-manager.js';
import { runQualityGates } from './validator.js';

/**
 * Analiza los resultados fallidos de los Quality Gates para extraer un diagnóstico estructurado.
 * 
 * @param {Array<object>} results - Colección de resultados de los Quality Gates ejecutados
 * @returns {Array<object>} - Diagnóstico estructurado con tipo de error, comando y sugerencia
 */
export function diagnoseFailure(results) {
  const failedGates = results.filter((r) => !r.passed);

  return failedGates.map((failure) => {
    const errorText = failure.error || failure.output || '';
    let errorCategory = 'UNKNOWN_ERROR';
    let suggestion = 'Revisar la salida de la terminal y los logs detallados.';

    // Clasificación del error mediante expresiones regulares sobre la salida de error
    if (/AssertionError|AssertionError|assert/i.test(errorText)) {
      errorCategory = 'ASSERTION_FAILURE';
      suggestion = 'Una aserción de prueba falló. Ajustar la lógica del código fuente para cumplir el caso de prueba.';
    } else if (/SyntaxError/i.test(errorText)) {
      errorCategory = 'SYNTAX_ERROR';
      suggestion = 'Error de sintaxis en el archivo. Corregir formato, llaves o palabras clave.';
    } else if (/Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i.test(errorText)) {
      errorCategory = 'IMPORT_ERROR';
      suggestion = 'Falta un módulo o archivo importado. Verificar la ruta del import o instalar el paquete con pnpm.';
    } else if (/Gate .* activado pero no tiene comando/i.test(errorText)) {
      errorCategory = 'CONFIG_ERROR';
      suggestion = 'Configurar el comando correspondiente en la sección "commands" del manifiesto YAML.';
    }

    return {
      gate: failure.gate,
      command: failure.command,
      category: errorCategory,
      rawError: errorText,
      suggestion,
    };
  });
}

/**
 * Genera automáticamente el archivo de reporte de ejecución en docs/workflow/executions/<ID>.md
 * 
 * @param {string} id - Identificador de la tarea
 * @param {object} summary - Resumen de la ejecución (iteraciones, estado, resultados)
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {string} - Ruta absoluta del archivo de reporte generado
 */
export function generateExecutionReport(id, summary, projectRoot = process.cwd()) {
  const executionsDir = path.join(projectRoot, 'docs', 'workflow', 'executions');
  // Aseguramos que el directorio de ejecuciones exista
  if (!fs.existsSync(executionsDir)) {
    fs.mkdirSync(executionsDir, { recursive: true });
  }

  const reportPath = path.join(executionsDir, `${id}.md`);
  const timestamp = new Date().toISOString();

  // Redactamos el contenido del reporte en formato Markdown
  let markdown = `# Reporte de Ejecución Automatizada - ${id}\n\n`;
  markdown += `## 1. Resumen General\n`;
  markdown += `- **ID de Tarea:** ${id}\n`;
  markdown += `- **Estado Final:** ${summary.success ? 'READY_FOR_PR (SUCCESS)' : 'FIXING (REQUIRES_ATTENTION)'}\n`;
  markdown += `- **Fecha y Hora (UTC):** ${timestamp}\n`;
  markdown += `- **Total de Iteraciones (Self-Healing Loop):** ${summary.iterations}\n\n`;

  markdown += `## 2. Resultados de Quality Gates\n`;
  for (const item of summary.results) {
    const statusIcon = item.passed ? '✔ PASS' : '✖ FAIL';
    markdown += `- **${item.gate}**: \`${statusIcon}\` (Comando: \`${item.command}\`)\n`;
    if (!item.passed && item.error) {
      markdown += `  - *Detalle del error:* \`${item.error.split('\n')[0]}\`\n`;
    }
  }

  markdown += `\n## 3. Diagnóstico y Trazabilidad\n`;
  if (summary.success) {
    markdown += `Todos los Quality Gates pasaron satisfactoriamente en ${summary.iterations} iteración(es).\n`;
  } else {
    markdown += `Se alcanzó el límite de intentos sin lograr que todos los gates estuvieran en verde. Diagnóstico generado:\n\n`;
    summary.diagnostics.forEach((diag) => {
      markdown += `- **Gate ${diag.gate}** [${diag.category}]: ${diag.suggestion}\n`;
    });
  }

  // Guardamos el reporte en disco
  fs.writeFileSync(reportPath, markdown, 'utf-8');
  return reportPath;
}

/**
 * Ejecuta el bucle autónomo de verificación y auto-reparación de una tarea.
 * 
 * @param {object} options - Parámetros de ejecución
 * @param {string} options.id - Identificador de la tarea (ej: AGT-0003)
 * @param {number} [options.maxRetries=3] - Máximo número de intentos de re-evaluación
 * @param {Function} [options.fixHandler] - Función asíncrona opcional que aplica correcciones automáticas
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {Promise<{ success: boolean, iterations: number, results: Array<object>, diagnostics: Array<object>, reportPath: string }>} - Resumen del bucle
 */
export async function runTaskLoop({
  id,
  maxRetries = 3,
  fixHandler = null,
  projectRoot = process.cwd(),
}) {
  // Obtenemos los datos actuales de la tarea
  const task = getTask(id, projectRoot);
  let iteration = 0;
  let allPassed = false;
  let lastResults = [];
  let diagnostics = [];

  // Actualizamos el estado a IN_PROGRESS al iniciar la ejecución
  updateTaskStatus(id, 'IN_PROGRESS', projectRoot);

  // Iniciamos el bucle cerrado
  while (iteration < maxRetries && !allPassed) {
    iteration++;

    // Transición a VERIFYING para evaluar los quality gates
    updateTaskStatus(id, 'VERIFYING', projectRoot);
    const gateExecution = runQualityGates(task, projectRoot);
    lastResults = gateExecution.results;
    allPassed = gateExecution.allPassed;

    if (allPassed) {
      // Si todos los gates pasaron, la tarea queda lista para Pull Request
      updateTaskStatus(id, 'READY_FOR_PR', projectRoot);
      break;
    }

    // Si falló algún gate, diagnosticamos la causa
    diagnostics = diagnoseFailure(lastResults);
    updateTaskStatus(id, 'FIXING', projectRoot);

    // Si se especificó un controlador de auto-reparación y quedan intentos disponibles
    if (fixHandler && typeof fixHandler === 'function' && iteration < maxRetries) {
      await fixHandler(diagnostics, { iteration, maxRetries, projectRoot });
    }
  }

  // Generamos el reporte final con la evidencia
  const reportPath = generateExecutionReport(
    id,
    {
      success: allPassed,
      iterations: iteration,
      results: lastResults,
      diagnostics,
    },
    projectRoot
  );

  return {
    success: allPassed,
    iterations: iteration,
    results: lastResults,
    diagnostics,
    reportPath,
  };
}
