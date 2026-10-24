import fs from 'node:fs';
import path from 'node:path';

/**
 * Variable de entorno que fija la raíz del proyecto sobre la que opera el agente.
 * Útil para clientes MCP que lanzan el servidor desde otro directorio (ej: Claude Desktop).
 */
export const PROJECT_ROOT_ENV = 'AGT_PROJECT_ROOT';

/**
 * Resuelve el directorio raíz del proyecto con la prioridad:
 * argumento explícito > variable AGT_PROJECT_ROOT > directorio de trabajo actual.
 *
 * @param {string} [explicitRoot] - Ruta indicada explícitamente (argumento de tool o flag --root)
 * @param {object} [env=process.env] - Variables de entorno (inyectable en tests)
 * @returns {string} - Ruta absoluta del proyecto
 */
export function resolveProjectRoot(explicitRoot, env = process.env) {
  const candidate = explicitRoot || env[PROJECT_ROOT_ENV] || process.cwd();
  const absolute = path.resolve(candidate);

  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new Error(`La raíz del proyecto no existe o no es un directorio: ${absolute}`);
  }
  return absolute;
}
