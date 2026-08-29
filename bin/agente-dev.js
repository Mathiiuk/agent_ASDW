#!/usr/bin/env node

// Importamos la librería Commander para gestionar los argumentos y comandos de la CLI
import { Command } from 'commander';
// Importamos picocolors para formatear y colorear la salida en la terminal
import pc from 'picocolors';
// Importamos las funciones del núcleo de nuestro agente
import {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  formatBranchName,
  checkoutBranch,
  validateManifest,
  runQualityGates,
} from '../src/index.js';

// Inicializamos el programa CLI
const program = new Command();

// Configuramos metadatos básicos de la CLI
program
  .name('agt')
  .description('CLI del Agente de Workflow Autónomo - Orquestador de Tareas y Ramas Git')
  .version('1.0.0');

/**
 * COMANDO: task:new <id>
 * Crea una nueva tarea completa (manifiesto, spec, plan, tests) y conmuta a una rama Git.
 */
program
  .command('task:new <id>')
  .description('Crea una nueva tarea y genera su rama de Git automáticamente')
  .requiredOption('-t, --title <title>', 'Título descriptivo de la tarea')
  .option('--type <type>', 'Tipo de tarea (feat, fix, refactor, docs, chore, etc.)', 'feat')
  .option('--owner <owner>', 'Responsable de la tarea', 'team-agent')
  .option('--base <base>', 'Rama base de Git', 'main')
  .option('--no-branch', 'No crear ni cambiar la rama de Git automáticamente')
  .action((id, options) => {
    try {
      console.log(pc.cyan(`\n🤖 [Agente Workflow] Creando nueva tarea: ${pc.bold(id)}...`));

      // Invocamos la función del gestor de tareas
      const result = createTask({
        id,
        title: options.title,
        type: options.type,
        owner: options.owner,
        baseBranch: options.base,
        createBranch: options.branch !== false,
      });

      console.log(pc.green(`✔ Tarea ${pc.bold(id)} creada exitosamente.`));
      console.log(pc.dim('Archivos generados:'));
      result.files.forEach((file) => console.log(pc.dim(`  📄 ${file}`)));

      if (options.branch !== false) {
        console.log(pc.yellow(`🌿 Rama Git activa: ${pc.bold(result.branch)}`));
      }

      console.log(pc.magenta('\nSiguiente paso: Completa la especificación y el plan en docs/workflow/\n'));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al crear la tarea: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: task:branch <id>
 * Conmuta o crea la rama de Git correspondiente a una tarea existente.
 */
program
  .command('task:branch <id>')
  .description('Conmuta a la rama de Git correspondiente a la tarea especificada')
  .action((id) => {
    try {
      // Obtenemos los datos de la tarea existente
      const task = getTask(id);
      // Formateamos el nombre de la rama
      const branchName = formatBranchName(task.type, task.id, task.title);

      console.log(pc.cyan(`\n🌿 Conmutando a la rama: ${pc.bold(branchName)}...`));
      // Cambiamos a la rama o la creamos si no existe
      const res = checkoutBranch(branchName, { createIfNotExists: true });

      if (res.created) {
        console.log(pc.green(`✔ Rama creada y conmutada: ${pc.bold(branchName)}\n`));
      } else {
        console.log(pc.green(`✔ Conmutado a la rama existente: ${pc.bold(branchName)}\n`));
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error con la rama Git: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: task:verify <id>
 * Ejecuta los Quality Gates y valida el manifiesto de la tarea.
 */
program
  .command('task:verify <id>')
  .description('Ejecuta los Quality Gates configurados en el manifiesto de la tarea')
  .action((id) => {
    try {
      console.log(pc.cyan(`\n🛡️ [Quality Gates] Verificando tarea: ${pc.bold(id)}...`));
      const task = getTask(id);

      // 1. Validar estructura del manifiesto
      const validation = validateManifest(task);
      if (!validation.valid) {
        console.log(pc.red('✖ Errores en la estructura del manifiesto YAML:'));
        validation.errors.forEach((err) => console.log(pc.red(`  - ${err}`)));
        process.exit(1);
      }

      console.log(pc.green('✔ Estructura de manifiesto YAML válida.'));

      // 2. Ejecutar comandos de Quality Gates
      console.log(pc.cyan('Ejecutando gates activos...'));
      const gatesResult = runQualityGates(task);

      for (const item of gatesResult.results) {
        if (item.passed) {
          console.log(pc.green(`  ✔ [PASS] ${item.gate} -> ${pc.dim(item.command)}`));
        } else {
          console.log(pc.red(`  ✖ [FAIL] ${item.gate} -> ${pc.dim(item.command)}`));
          if (item.error) {
            console.log(pc.dim(`    ${item.error}`));
          }
        }
      }

      if (gatesResult.allPassed) {
        console.log(pc.green(`\n🎉 Todos los Quality Gates pasaron exitosamente para ${pc.bold(id)}.\n`));
      } else {
        console.log(pc.red(`\n⚠️ Algunos Quality Gates fallaron. Revisa los errores antes de continuar.\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error en verificación: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: task:list
 * Lista todas las tareas registradas en docs/workflow/tasks/.
 */
program
  .command('task:list')
  .description('Lista todas las tareas registradas en el workflow')
  .action(() => {
    try {
      const tasks = listTasks();
      if (tasks.length === 0) {
        console.log(pc.yellow('\nNo hay tareas registradas en docs/workflow/tasks/.\n'));
        return;
      }

      console.log(pc.cyan(`\n📋 Tareas registradas (${tasks.length}):\n`));
      for (const t of tasks) {
        const statusColor = t.status === 'DONE' ? pc.green : t.status === 'IN_PROGRESS' ? pc.yellow : pc.blue;
        console.log(`  ${pc.bold(t.id.padEnd(12))} [${statusColor(t.status.padEnd(12))}] ${pc.white(t.title)} (${pc.dim(t.type)})`);
      }
      console.log();
    } catch (error) {
      console.error(pc.red(`\n✖ Error al listar tareas: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: task:status <id> [newStatus]
 * Muestra o actualiza el estado de una tarea.
 */
program
  .command('task:status <id> [newStatus]')
  .description('Consulta o actualiza el estado de una tarea')
  .action((id, newStatus) => {
    try {
      if (newStatus) {
        const updated = updateTaskStatus(id, newStatus.toUpperCase());
        console.log(pc.green(`\n✔ Estado de ${pc.bold(id)} actualizado a: ${pc.bold(updated.status)}\n`));
      } else {
        const task = getTask(id);
        console.log(pc.cyan(`\nTarea: ${pc.bold(task.id)} | Estado actual: ${pc.yellow(task.status)}\n`));
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error al procesar estado: ${error.message}\n`));
      process.exit(1);
    }
  });

// Parseamos los argumentos recibidos por la línea de comandos
program.parse(process.argv);
