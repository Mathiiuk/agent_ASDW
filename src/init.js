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
 * @param {boolean} [options.copyCi=true] - Si es true, copia .github/workflows/ci.yml si no existe
 * @returns {{ targetDir: string, copiedFolders: string[], createdWorkflowDirs: string[], ciCreated: boolean }} - Resumen de la inicialización
 */
export function initProject({ targetDir = process.cwd(), copyCucumber = true, copyCi = true } = {}) {
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

  // 5. Copiamos el pipeline de CI/CD (.github/workflows/ci.yml) si se solicita
  let ciCreated = false;
  if (copyCi) {
    const targetGithubDir = path.join(targetDir, '.github', 'workflows');
    const targetCiFile = path.join(targetGithubDir, 'ci.yml');
    const templateCiFile = path.join(sourceAgentsDir, 'templates', 'ci-workflow.yml');

    if (!fs.existsSync(targetCiFile) && fs.existsSync(templateCiFile)) {
      if (!fs.existsSync(targetGithubDir)) {
        fs.mkdirSync(targetGithubDir, { recursive: true });
      }
      fs.copyFileSync(templateCiFile, targetCiFile);
      ciCreated = true;
    }
  }

  // 6. Integración NATIVA Universal (Antigravity, Cursor, Windsurf, Cline y Genérico)
  const aiInstructionContent = `# Workspace AI Rules

Estás operando en un entorno de desarrollo estructurado para Agentes de IA.

> [!IMPORTANT]
> 1. Debes seguir ESTRICTAMENTE las directrices del flujo de trabajo definidas en:
>    **[.agents/rules/master-workflow.md](.agents/rules/master-workflow.md)**
> 2. Antes de realizar cambios importantes, DEBES leer el contexto del proyecto en:
>    **[.agents/memory/context.md](.agents/memory/context.md)**

Para ejecutar tareas, asume los roles especializados (Frontend, Backend, DevOps, etc.) definidos en la carpeta \`.agents/skills/\`.
`;

  // Archivos clave leídos por los IDEs y extensiones más populares
  const aiIntegrationFiles = [
    'AGENTS.md',        // Antigravity 2.0
    '.cursorrules',     // Cursor IDE
    '.windsurfrules',   // Windsurf IDE
    '.clinerules',      // Cline / Roo Code (VS Code)
    'AI.md'             // Genérico (para adjuntar a ChatGPT, Claude, etc.)
  ];

  for (const filename of aiIntegrationFiles) {
    const targetFile = path.join(targetDir, filename);
    if (!fs.existsSync(targetFile)) {
      fs.writeFileSync(targetFile, aiInstructionContent, 'utf-8');
    }
  }
  // 7. Integración con Scripts de package.json (Aparecen en la sidebar del IDE)
  let packageScriptsAdded = false;
  const targetPackageJson = path.join(targetDir, 'package.json');
  if (fs.existsSync(targetPackageJson)) {
    try {
      const pkgData = fs.readFileSync(targetPackageJson, 'utf-8');
      const pkg = JSON.parse(pkgData);
      pkg.scripts = pkg.scripts || {};
      
      const agentScripts = {
        "agt:task": "agt task:new",
        "agt:loop": "agt task:loop",
        "agt:memory": "agt memory:sync"
      };

      for (const [key, val] of Object.entries(agentScripts)) {
        if (!pkg.scripts[key]) {
          pkg.scripts[key] = val;
          packageScriptsAdded = true;
        }
      }

      if (packageScriptsAdded) {
        fs.writeFileSync(targetPackageJson, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch (e) {
      // Ignorar de forma segura si package.json está malformado
    }
  }

  // 8. Integración con VS Code (Command Palette / Tasks)
  let vscodeTasksCreated = false;
  const vscodeDir = path.join(targetDir, '.vscode');
  const tasksJsonPath = path.join(vscodeDir, 'tasks.json');
  
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  
  if (!fs.existsSync(tasksJsonPath)) {
    const tasksConfig = {
      "version": "2.0.0",
      "tasks": [
        { "label": "🤖 Agente: Nueva Tarea", "type": "shell", "command": "agt task:new", "problemMatcher": [] },
        { "label": "🤖 Agente: Bucle Autónomo", "type": "shell", "command": "agt task:loop", "problemMatcher": [] },
        { "label": "🤖 Agente: Sincronizar Memoria", "type": "shell", "command": "agt memory:sync", "problemMatcher": [] }
      ]
    };
    fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksConfig, null, 2) + '\n', 'utf-8');
    vscodeTasksCreated = true;
  }
  // 9. Git Pre-commit Hook (El Guardián)
  let gitHookCreated = false;
  const gitHooksDir = path.join(targetDir, '.git', 'hooks');
  
  if (fs.existsSync(path.join(targetDir, '.git'))) {
    if (!fs.existsSync(gitHooksDir)) {
      fs.mkdirSync(gitHooksDir, { recursive: true });
    }
    
    const preCommitPath = path.join(gitHooksDir, 'pre-commit');
    if (!fs.existsSync(preCommitPath)) {
      const preCommitScript = `#!/bin/sh
# 🤖 Agente Dev - Guardian Pre-commit Hook
# Este hook verifica automáticamente si estás en la rama de una tarea
# y bloquea el commit si los Quality Gates fallan.

BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
TASK_ID=$(echo "$BRANCH_NAME" | grep -oE 'AGT-[0-9]+' || echo "")

if [ ! -z "$TASK_ID" ]; then
  echo "🤖 [Agente Dev] Tarea detectada: $TASK_ID. Ejecutando Quality Gates antes del commit..."
  
  if command -v agt >/dev/null 2>&1; then
    agt task:verify "$TASK_ID"
  elif command -v npx >/dev/null 2>&1; then
    npx agt task:verify "$TASK_ID"
  else
    echo "⚠️ [Agente Dev] No se encontró el CLI 'agt' o 'npx'. Saltando verificación."
    exit 0
  fi
  
  if [ $? -ne 0 ]; then
    echo "❌ [Agente Dev] Quality Gates fallidos. Commit abortado."
    echo "💡 Ejecuta 'agt task:loop $TASK_ID' para diagnosticar y auto-reparar."
    exit 1
  fi
  
  echo "✅ [Agente Dev] Quality Gates verificados."
fi

exit 0
`;
      fs.writeFileSync(preCommitPath, preCommitScript, 'utf-8');
      try {
        fs.chmodSync(preCommitPath, 0o755);
      } catch (e) {
        // Ignorar en sistemas que no soporten chmod (como Windows puro)
      }
      gitHookCreated = true;
    }
  }

  // Retornamos el balance de lo copiado e inicializado
  return {
    targetDir,
    copiedFolders,
    createdWorkflowDirs,
    ciCreated,
    packageScriptsAdded,
    vscodeTasksCreated,
    gitHookCreated
  };
}
