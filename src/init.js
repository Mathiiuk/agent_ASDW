// Importamos los módulos nativos de Node.js para manejo de archivos, rutas y URLs de módulos ESM
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Obtenemos la ruta del archivo actual (__filename) y del directorio (__dirname) en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// La raíz del paquete 'agente-dev' es el directorio padre de 'src/'
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/**
 * Copia recursivamente el contenido de un directorio origen a un directorio destino.
 * 
 * @param {string} src - Ruta del directorio de origen
 * @param {string} dest - Ruta del directorio de destino
 */
function copyDirRecursive(src, dest) {
  // Si el destino no existe, lo creamos
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Leemos todas las entradas del directorio origen
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Si es subdirectorio, llamada recursiva
      copyDirRecursive(srcPath, destPath);
    } else {
      // Si es archivo, copiamos sobrescribiendo si es necesario
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Inicializa el ecosistema del Agente en cualquier proyecto destino.
 * Copia la carpeta .agents/ (reglas, skills, templates, estructura de workflow) y archivos de configuración.
 * 
 * @param {object} options - Opciones de inicialización
 * @param {string} [options.targetDir=process.cwd()] - Directorio destino donde se inicializará el agente
 * @param {boolean} [options.copyCucumber=true] - Si es true, copia cucumber.json si no existe
 * @returns {{ targetDir: string, copiedFolders: string[], createdWorkflowDirs: string[] }} - Resumen de la inicialización
 */
export function initProject({ targetDir = process.cwd(), copyCucumber = true } = {}) {
  const sourceAgentsDir = path.join(PACKAGE_ROOT, '.agents');
  const targetAgentsDir = path.join(targetDir, '.agents');

  // Validamos que el paquete contenga la carpeta .agents de origen
  if (!fs.existsSync(sourceAgentsDir)) {
    throw new Error(`No se encontró la carpeta base .agents en el paquete: ${sourceAgentsDir}`);
  }

  // 1. Aseguramos la existencia de .agents en el proyecto destino
  if (!fs.existsSync(targetAgentsDir)) {
    fs.mkdirSync(targetAgentsDir, { recursive: true });
  }

  const copiedFolders = [];

  // 2. Copiamos las subcarpetas esenciales: rules, skills, templates, examples
  const foldersToCopy = ['rules', 'skills', 'templates', 'examples'];

  for (const folder of foldersToCopy) {
    const srcSubdir = path.join(sourceAgentsDir, folder);
    const destSubdir = path.join(targetAgentsDir, folder);

    if (fs.existsSync(srcSubdir)) {
      copyDirRecursive(srcSubdir, destSubdir);
      copiedFolders.push(folder);
    }
  }

  // 3. Creamos la estructura limpia de directorios para el workflow de tareas
  const workflowSubdirs = ['tasks', 'specs', 'plans', 'tests', 'features', 'executions', 'guides'];
  const createdWorkflowDirs = [];

  for (const sub of workflowSubdirs) {
    const workflowPath = path.join(targetAgentsDir, 'workflow', sub);
    if (!fs.existsSync(workflowPath)) {
      fs.mkdirSync(workflowPath, { recursive: true });
      createdWorkflowDirs.push(sub);
    }
  }

  // 4. Copiamos cucumber.json si se solicita y no existe en el destino
  if (copyCucumber) {
    const srcCucumber = path.join(PACKAGE_ROOT, 'cucumber.json');
    const destCucumber = path.join(targetDir, 'cucumber.json');

    if (fs.existsSync(srcCucumber) && !fs.existsSync(destCucumber)) {
      fs.copyFileSync(srcCucumber, destCucumber);
    }
  }

  // Retornamos el balance de lo copiado e inicializado
  return {
    targetDir,
    copiedFolders,
    createdWorkflowDirs,
  };
}
