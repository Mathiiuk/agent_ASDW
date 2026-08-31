import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { listTasks } from './task-manager.js';

/**
 * Genera una nueva versión de release, procesando tareas en estado DONE
 * que no hayan sido publicadas previamente.
 * 
 * @param {string} version - Versión a liberar (ej: v1.0.0)
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Resumen de la release generada
 */
export function generateRelease(version, projectRoot = process.cwd()) {
  if (!version) {
    throw new Error('Debes proporcionar una versión (ej: v1.2.0)');
  }

  // 1. Obtener todas las tareas y filtrar las DONE que no están en un release
  const allTasks = listTasks(projectRoot);
  const tasksToRelease = allTasks.filter(
    (task) => task.status === 'DONE' && !task.released_in
  );

  if (tasksToRelease.length === 0) {
    return { success: false, message: 'No hay tareas nuevas en estado DONE para liberar.' };
  }

  // 2. Clasificar las tareas por tipo
  const categories = {
    feat: { title: '🚀 Funcionalidades (Features)', items: [] },
    fix: { title: '🐛 Correcciones (Fixes)', items: [] },
    refactor: { title: '♻️ Refactorización', items: [] },
    docs: { title: '📝 Documentación', items: [] },
    chore: { title: '📦 Mantenimiento', items: [] },
    other: { title: '🔧 Otras Tareas', items: [] }
  };

  for (const task of tasksToRelease) {
    const type = task.type || 'other';
    const targetCategory = categories[type] ? categories[type] : categories.other;
    
    // Formato de línea: - [AGT-001] Título de la tarea (@owner)
    targetCategory.items.push(`- **[${task.id}]** ${task.title} _(@${task.owner || 'team'})_`);
  }

  // 3. Generar el bloque Markdown para el Changelog
  const dateStr = new Date().toISOString().split('T')[0];
  let releaseBlock = `## [${version}] - ${dateStr}\n\n`;

  for (const cat of Object.values(categories)) {
    if (cat.items.length > 0) {
      releaseBlock += `### ${cat.title}\n`;
      releaseBlock += cat.items.join('\n') + '\n\n';
    }
  }

  // 4. Actualizar (o crear) el archivo CHANGELOG.md en la raíz
  const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
  let currentChangelog = '';
  if (fs.existsSync(changelogPath)) {
    currentChangelog = fs.readFileSync(changelogPath, 'utf-8');
  }

  // Insertar el nuevo bloque al inicio (después del título principal si lo hay, o directamente al principio)
  if (currentChangelog.startsWith('# Changelog')) {
    currentChangelog = currentChangelog.replace('# Changelog\n', `# Changelog\n\n${releaseBlock}`);
  } else {
    currentChangelog = `# Changelog\n\n${releaseBlock}${currentChangelog}`;
  }
  
  fs.writeFileSync(changelogPath, currentChangelog, 'utf-8');

  // 5. Actualizar el estado de los manifiestos YAML de las tareas
  const tasksDir = path.join(projectRoot, '.agents', 'workflow', 'tasks');
  for (const task of tasksToRelease) {
    task.released_in = version;
    const taskYamlPath = path.join(tasksDir, `${task.id}.yml`);
    fs.writeFileSync(taskYamlPath, yaml.dump(task, { indent: 2 }), 'utf-8');
  }

  // 6. Actualizar versión en package.json (Si existe)
  const pkgPath = path.join(projectRoot, 'package.json');
  let pkgUpdated = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      pkg.version = version.replace(/^v/, ''); // Remover la 'v' inicial si la tiene
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      pkgUpdated = true;
    } catch (e) {
      // Ignorar si el JSON está malformado
    }
  }

  return {
    success: true,
    version,
    tasksCount: tasksToRelease.length,
    changelogPath,
    pkgUpdated
  };
}
