// Importamos los módulos nativos de Node.js para manejo de sistema de archivos y rutas
import fs from 'node:fs';
import path from 'node:path';
// Importamos js-yaml para leer y serializar documentos YAML de manifiestos
import yaml from 'js-yaml';
// Importamos las funciones de ayuda de Git desarrolladas en nuestro módulo src/git.js
import { formatBranchName, checkoutBranch, isGitRepo } from './git.js';

/**
 * Rutas relativas estándar de los directorios de trabajo y plantillas dentro de .agents/
 */
const DIRS = {
  tasks: path.join('.agents', 'workflow', 'tasks'),
  specs: path.join('.agents', 'workflow', 'specs'),
  plans: path.join('.agents', 'workflow', 'plans'),
  tests: path.join('.agents', 'workflow', 'tests'),
  features: path.join('.agents', 'workflow', 'features'),
  executions: path.join('.agents', 'workflow', 'executions'),
  templates: path.join('.agents', 'templates'),
};

/**
 * Asegura que todos los directorios requeridos por el workflow existan en el proyecto.
 * 
 * @param {string} projectRoot - Directorio raíz del proyecto
 */
export function ensureWorkflowDirs(projectRoot = process.cwd()) {
  // Iteramos sobre cada directorio definido en el objeto DIRS
  for (const dirKey of Object.keys(DIRS)) {
    const fullPath = path.join(projectRoot, DIRS[dirKey]);
    // Si la carpeta no existe, la creamos de manera recursiva
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

/**
 * Lee el contenido de una plantilla de archivo o retorna una cadena por defecto si no existe.
 * 
 * @param {string} templateName - Nombre del archivo de plantilla (ej: 'task-manifest.yml')
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {string} - Contenido de la plantilla
 */
function readTemplate(templateName, projectRoot = process.cwd()) {
  // Construimos la ruta absoluta hacia el archivo de plantilla
  const templatePath = path.join(projectRoot, DIRS.templates, templateName);
  // Si existe el archivo, lo leemos en texto plano codificado en UTF-8
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }
  // Si no existe, retornamos una cadena vacía
  return '';
}

/**
 * Crea una nueva tarea completa: genera manifiesto YAML, especificación, plan, tests
 * y opcionalmente crea y conmuta a la nueva rama de Git correspondiente.
 * 
 * @param {object} options - Parámetros de la tarea
 * @param {string} options.id - Identificador único de la tarea (ej: AGT-0002)
 * @param {string} options.title - Título descriptivo de la tarea
 * @param {string} [options.type='feat'] - Tipo de tarea (feat, fix, refactor, docs, chore, etc.)
 * @param {string} [options.owner='team-agent'] - Responsable de la tarea
 * @param {string} [options.baseBranch='main'] - Rama base de origen
 * @param {boolean} [options.createBranch=true] - Si es true, crea la rama Git automáticamente
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {{ id: string, branch: string, files: string[], branchCreated: boolean }} - Resumen de artefactos creados
 */
export function createTask({
  id,
  title,
  type = 'feat',
  owner = 'team-agent',
  baseBranch = 'main',
  createBranch = true,
  projectRoot = process.cwd(),
}) {
  // Validamos que se proporcione un identificador de tarea
  if (!id) {
    throw new Error('El ID de la tarea es obligatorio (ej: AGT-0002).');
  }
  // Validamos que se proporcione un título descriptivo
  if (!title) {
    throw new Error('El título de la tarea es obligatorio.');
  }

  // Aseguramos que los directorios destino existan
  ensureWorkflowDirs(projectRoot);

  // Lista para almacenar las rutas de los archivos generados
  const createdFiles = [];

  // 1. GENERACIÓN DEL MANIFIESTO YAML (docs/workflow/tasks/<ID>.yml)
  const taskYamlPath = path.join(projectRoot, DIRS.tasks, `${id}.yml`);
  // Definimos la estructura del manifiesto en formato de objeto JavaScript
  const manifestData = {
    id: id,
    external_ref: '',
    title: title,
    type: type,
    status: 'PLANNED',
    priority: 'medium',
    owner: owner,
    base_branch: baseBranch,
    scope: {
      project: path.basename(projectRoot),
      modules: [],
      environments: ['local'],
    },
    requirements: [
      `Implementar ${title}`,
    ],
    acceptance_criteria: [
      `Criterio de aceptación 1 para ${title}`,
    ],
    requires_approval: false,
    quality_gates: {
      lint: false,
      typecheck: false,
      unit_tests: true,
      bdd_tests: true,
      integration_tests: false,
      e2e: false,
      build: false,
      security: false,
      smoke_tests: false,
    },
    commands: {
      install: 'pnpm install',
      unit_tests: 'pnpm test',
      bdd_tests: 'pnpm test:bdd',
    },
  };

  // Convertimos el objeto JavaScript a texto en formato YAML
  const yamlContent = yaml.dump(manifestData, { indent: 2 });
  // Guardamos el archivo YAML en disco
  fs.writeFileSync(taskYamlPath, yamlContent, 'utf-8');
  createdFiles.push(taskYamlPath);

  // 2. GENERACIÓN DE LA ESPECIFICACIÓN (docs/workflow/specs/<ID>.md)
  const specPath = path.join(projectRoot, DIRS.specs, `${id}.md`);
  // Leemos la plantilla o usamos una estructura base
  let specTemplate = readTemplate('specification.md', projectRoot);
  if (!specTemplate) {
    specTemplate = `# Especificación: ${id} - ${title}\n\n## 1. Problema y Objetivo\n\n## 2. Requerimientos\n\n## 3. Criterios de Aceptación\n`;
  } else {
    // Reemplazamos los marcadores de posición con los datos de la tarea
    specTemplate = specTemplate
      .replace(/<TASK-ID>/g, id)
      .replace(/<TITULO_DE_LA_TAREA>/g, title);
  }
  fs.writeFileSync(specPath, specTemplate, 'utf-8');
  createdFiles.push(specPath);

  // 3. GENERACIÓN DEL PLAN DE IMPLEMENTACIÓN (docs/workflow/plans/<ID>.md)
  const planPath = path.join(projectRoot, DIRS.plans, `${id}.md`);
  let planTemplate = readTemplate('implementation-plan.md', projectRoot);
  if (!planTemplate) {
    planTemplate = `# Plan de Implementación: ${id} - ${title}\n\n## 1. Cambios Propuestos\n\n## 2. Estrategia\n`;
  } else {
    planTemplate = planTemplate
      .replace(/<TASK-ID>/g, id)
      .replace(/<TITULO_DE_LA_TAREA>/g, title);
  }
  fs.writeFileSync(planPath, planTemplate, 'utf-8');
  createdFiles.push(planPath);

  // 4. GENERACIÓN DEL PLAN DE PRUEBAS (docs/workflow/tests/<ID>.md)
  const testPath = path.join(projectRoot, DIRS.tests, `${id}.md`);
  let testTemplate = readTemplate('test-plan.md', projectRoot);
  if (!testTemplate) {
    testTemplate = `# Plan de Pruebas: ${id} - ${title}\n\n## 1. Casos Unitarios\n\n## 2. Casos de Integración\n`;
  } else {
    testTemplate = testTemplate
      .replace(/<TASK-ID>/g, id)
      .replace(/<TITULO_DE_LA_TAREA>/g, title);
  }
  fs.writeFileSync(testPath, testTemplate, 'utf-8');
  createdFiles.push(testPath);

  // 5. GENERACIÓN DE LA ESPECIFICACIÓN BDD EN GHERKIN (docs/workflow/features/<ID>.feature)
  const featurePath = path.join(projectRoot, DIRS.features, `${id}.feature`);
  let featureTemplate = readTemplate('feature.feature', projectRoot);
  if (!featureTemplate) {
    featureTemplate = `Feature: ${id} - ${title}\n\n  Scenario: Successful execution\n    Given the system is ready\n    When the action is triggered\n    Then the result is successful\n`;
  } else {
    featureTemplate = featureTemplate
      .replace(/<TASK-ID>/g, id)
      .replace(/<TITULO_DE_LA_TAREA>/g, title);
  }
  fs.writeFileSync(featurePath, featureTemplate, 'utf-8');
  createdFiles.push(featurePath);

  // 6. AUTOMATIZACIÓN DE RAMA GIT
  // Calculamos el nombre estandarizado de la rama: <type>/<id>-<slug>
  const branchName = formatBranchName(type, id, title);
  let branchResult = { created: false, branch: branchName };

  // Si se solicitó crear la rama y estamos en un repositorio de Git válido
  if (createBranch && isGitRepo(projectRoot)) {
    try {
      // Conmutamos o creamos la nueva rama de Git
      branchResult = checkoutBranch(branchName, { createIfNotExists: true, cwd: projectRoot });
    } catch (gitErr) {
      // Si falla Git, registramos la advertencia pero no abortamos la creación de los archivos
      console.warn(`[WARN] No se pudo crear/conmutar a la rama Git: ${gitErr.message}`);
    }
  }

  // Retornamos el resultado con los artefactos creados y el estado de la rama
  return {
    id,
    branch: branchName,
    files: createdFiles,
    branchCreated: branchResult.created,
  };
}

/**
 * Lee y analiza el manifiesto YAML de una tarea existente.
 * 
 * @param {string} id - Identificador de la tarea (ej: AGT-0001)
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Objeto JavaScript con los datos del manifiesto
 */
export function getTask(id, projectRoot = process.cwd()) {
  // Construimos la ruta al manifiesto YAML
  const taskYamlPath = path.join(projectRoot, DIRS.tasks, `${id}.yml`);
  // Si no existe, arrojamos un error explicativo
  if (!fs.existsSync(taskYamlPath)) {
    throw new Error(`No se encontró el manifiesto para la tarea '${id}' en ${taskYamlPath}`);
  }

  // Leemos y parseamos el contenido YAML
  const fileContent = fs.readFileSync(taskYamlPath, 'utf-8');
  return yaml.load(fileContent);
}

/**
 * Obtiene la lista completa de todas las tareas presentes en docs/workflow/tasks/.
 * 
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {Array<object>} - Colección de tareas con su metadata
 */
export function listTasks(projectRoot = process.cwd()) {
  const tasksDir = path.join(projectRoot, DIRS.tasks);
  // Si el directorio no existe, retornamos una lista vacía
  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  // Leemos todos los archivos con extensión .yml o .yaml
  const files = fs.readdirSync(tasksDir).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

  const tasks = [];
  // Recorremos cada archivo de manifiesto
  for (const file of files) {
    try {
      const filePath = path.join(tasksDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = yaml.load(content);
      if (data && data.id) {
        tasks.push(data);
      }
    } catch {
      // Ignoramos archivos corruptos o ilegibles
    }
  }

  // Retornamos la lista ordenada por ID
  return tasks.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Actualiza el estado ('status') de una tarea en su manifiesto YAML.
 * 
 * @param {string} id - Identificador de la tarea
 * @param {string} newStatus - Nuevo estado (ej: 'IN_PROGRESS', 'READY_FOR_PR', 'DONE')
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Manifiesto actualizado
 */
export function updateTaskStatus(id, newStatus, projectRoot = process.cwd()) {
  const taskYamlPath = path.join(projectRoot, DIRS.tasks, `${id}.yml`);
  // Obtenemos los datos actuales
  const taskData = getTask(id, projectRoot);
  // Actualizamos el campo status
  taskData.status = newStatus;
  // Guardamos nuevamente el archivo serializado en YAML
  fs.writeFileSync(taskYamlPath, yaml.dump(taskData, { indent: 2 }), 'utf-8');
  return taskData;
}
