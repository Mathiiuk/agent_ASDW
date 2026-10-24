import { execSync } from 'node:child_process';

/**
 * Convierte un texto con espacios, mayúsculas o caracteres especiales en un 'slug' limpio y seguro para ramas de Git.
 * Ejemplo: "Nueva autenticación con OAuth2!" -> "nueva-autenticacion-con-oauth2"
 * 
 * @param {string} text - Texto original a convertir en slug
 * @returns {string} - Texto sanitizado en minúsculas y separado por guiones
 */
export function slugify(text) {
  // Si no se proporciona texto, retornamos una cadena vacía
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Genera el nombre estandarizado de una rama de Git a partir del tipo, ID y título de la tarea.
 * Formato resultante: <tipo>/<id>-<slug>
 * Ejemplo: feat/AGT-0001-cli-git-automation
 * 
 * @param {string} type - Tipo de tarea (feat, fix, refactor, docs, chore, etc.)
 * @param {string} id - Identificador de la tarea (ej: AGT-0001)
 * @param {string} title - Título descriptivo de la tarea
 * @returns {string} - Nombre formateado de la rama Git
 */
export function formatBranchName(type, id, title) {
  const branchType = (type || 'feat').toLowerCase();
  const cleanId = (id || 'TASK').trim();
  const slug = slugify(title);

  // Si hay slug, lo concatenamos al ID; de lo contrario solo usamos el ID
  const branchSuffix = slug ? `${cleanId}-${slug}` : cleanId;

  return `${branchType}/${branchSuffix}`;
}

/**
 * Ejecuta un comando de Git de forma síncrona en el directorio de trabajo especificado.
 * 
 * @param {string} command - Comando de Git a ejecutar (ej: 'git status')
 * @param {string} cwd - Directorio donde se ejecuta el comando (por defecto el directorio actual)
 * @returns {string} - Salida estándar en texto limpio
 */
function runGit(command, cwd = process.cwd()) {
  return execSync(command, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'], // Ocultamos errores directos para manejarlos en JS
  }).trim();
}

/**
 * Verifica si el directorio actual es un repositorio de Git válido.
 * 
 * @param {string} cwd - Directorio a inspeccionar
 * @returns {boolean} - True si es un repo Git, False en caso contrario
 */
export function isGitRepo(cwd = process.cwd()) {
  try {
    const output = runGit('git rev-parse --is-inside-work-tree', cwd);
    return output === 'true';
  } catch {
    // Si el comando falla, no es un repositorio Git
    return false;
  }
}

/**
 * Obtiene el nombre de la rama actual en el repositorio Git.
 * 
 * @param {string} cwd - Directorio de trabajo
 * @returns {string} - Nombre de la rama activa (ej: 'main' o 'feat/AGT-0001')
 */
export function getCurrentBranch(cwd = process.cwd()) {
  let branch = runGit('git branch --show-current', cwd);
  
  // Fallback para entornos CI en "detached HEAD" (ej. GitHub Actions)
  if (!branch) {
    try {
      branch = runGit('git rev-parse --abbrev-ref HEAD', cwd);
      if (branch === 'HEAD') {
        // Sigue detached, usar variable de entorno de GitHub o short hash
        branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || runGit('git rev-parse --short HEAD', cwd);
      }
    } catch {
      branch = '';
    }
  }
  return branch;
}

/**
 * Comprueba si existen cambios no commiteados o sin guardar en el árbol de trabajo.
 * 
 * @param {string} cwd - Directorio de trabajo
 * @returns {boolean} - True si hay cambios pendientes, False si está limpio
 */
export function hasUncommittedChanges(cwd = process.cwd()) {
  const status = runGit('git status --short', cwd);
  // Si la salida no está vacía, existen cambios sin confirmar
  return status.length > 0;
}

/**
 * Comprueba si una rama de Git existe localmente.
 * 
 * @param {string} branchName - Nombre de la rama a verificar
 * @param {string} cwd - Directorio de trabajo
 * @returns {boolean} - True si la rama existe localmente
 */
export function branchExists(branchName, cwd = process.cwd()) {
  try {
    runGit(`git rev-parse --verify refs/heads/${branchName}`, cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Conmuta a una rama de Git. Si no existe y 'createIfNotExists' es true, crea la rama y cambia a ella.
 * 
 * @param {string} branchName - Nombre de la rama destino
 * @param {object} options - Opciones de configuración
 * @param {boolean} options.createIfNotExists - Si es true, crea la rama si no existe
 * @param {string} options.cwd - Directorio de trabajo
 * @returns {{ success: boolean, branch: string, created: boolean }} - Resultado de la operación
 */
export function checkoutBranch(branchName, { createIfNotExists = true, cwd = process.cwd() } = {}) {
  const exists = branchExists(branchName, cwd);

  // Si ya estamos en esa misma rama, no hacemos nada adicional
  const current = getCurrentBranch(cwd);
  if (current === branchName) {
    return { success: true, branch: branchName, created: false };
  }

  if (exists) {
    // Si la rama ya existe, simplemente conmutamos a ella
    runGit(`git checkout ${branchName}`, cwd);
    return { success: true, branch: branchName, created: false };
  }

  if (createIfNotExists) {
    // Si no existe y se solicitó crearla, usamos checkout -b
    runGit(`git checkout -b ${branchName}`, cwd);
    return { success: true, branch: branchName, created: true };
  }

  throw new Error(`La rama '${branchName}' no existe y no se autorizó su creación.`);
}
