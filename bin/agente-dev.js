#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  formatBranchName,
  checkoutBranch,
  validateManifest,
  runQualityGates,
  runTaskLoop,
  initProject,
  buildKnowledgeGraph,
  recordLesson,
  queryMemory,
  generateRelease,
  generateBddScaffold,
  startMcpServer,
  startPhasedDevelopment,
  checkCurrentPhase,
  runFinalHealthcheck,
  getPhasePlan,
  parsePhaseArg,
  DEFAULT_HEALTH_COMMANDS,
} from '../src/index.js';

/**
 * Acumula valores de una opción repetible de Commander (ej: -p A -p B)
 *
 * @param {string} value - Valor recibido
 * @param {string[]} previous - Valores acumulados
 * @returns {string[]} - Lista actualizada
 */
function collect(value, previous) {
  return previous.concat([value]);
}

const program = new Command();

program
  .name('agt')
  .description('CLI del Agente de Workflow Autónomo - Orquestador de Tareas y Ramas Git')
  .version('1.0.0');

/**
 * COMANDO: init
 * Inicializa el ecosistema del Agente (.agents/rules, skills, templates, workflow) en el directorio actual.
 */
program
  .command('init')
  .description('Inicializa el ecosistema del agente (.agents/) y CI/CD en el proyecto actual')
  .option('--no-cucumber', 'No copiar la configuración de cucumber.json')
  .option('--no-ci', 'No copiar el workflow de CI/CD para GitHub Actions')
  .action((options) => {
    try {
      const cwd = process.cwd();
      console.log(pc.cyan(`\nInicializando en: ${pc.bold(cwd)}`));

      const result = initProject({
        targetDir: cwd,
        copyCucumber: options.cucumber !== false,
        copyCi: options.ci !== false,
      });

      console.log(pc.green(`Proyecto inicializado.`));
      console.log(pc.dim('Carpetas configuradas en .agents/:'));
      result.copiedFolders.forEach((f) => console.log(pc.dim(`  .agents/${f}/`)));
      console.log(pc.dim('Estructura de workflow creada:'));
      result.createdWorkflowDirs.forEach((w) => console.log(pc.dim(`  .agents/workflow/${w}/`)));

      if (result.ciCreated) {
        console.log(pc.cyan(`Pipeline de CI/CD creado en: ${pc.bold('.github/workflows/ci.yml')}`));
      }

      console.log(pc.yellow('\nSiguiente paso:'));
      console.log(pc.white(`  agt task:new TSK-0001 -t "Mi primera funcionalidad" --type feat\n`));
    } catch (error) {
      console.error(pc.red(`\nError al inicializar el proyecto: ${error.message}\n`));
      process.exit(1);
    }
  });

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
      console.log(pc.cyan(`\nCreando tarea: ${pc.bold(id)}`));

      const result = createTask({
        id,
        title: options.title,
        type: options.type,
        owner: options.owner,
        baseBranch: options.base,
        createBranch: options.branch !== false,
      });

      console.log(pc.green(`Tarea ${pc.bold(id)} creada.`));
      console.log(pc.dim('Archivos generados:'));
      result.files.forEach((file) => console.log(pc.dim(`  ${file}`)));

      if (options.branch !== false) {
        console.log(pc.yellow(`Rama Git activa: ${pc.bold(result.branch)}`));
      }

      console.log(pc.magenta('\nSiguiente paso: completar la especificación y el plan en .agents/workflow/\n'));
    } catch (error) {
      console.error(pc.red(`\nError al crear la tarea: ${error.message}\n`));
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
      const task = getTask(id);
      const branchName = formatBranchName(task.type, task.id, task.title);

      console.log(pc.cyan(`\nConmutando a la rama: ${pc.bold(branchName)}`));
      const res = checkoutBranch(branchName, { createIfNotExists: true });

      if (res.created) {
        console.log(pc.green(`Rama creada y conmutada: ${pc.bold(branchName)}\n`));
      } else {
        console.log(pc.green(`Conmutado a la rama existente: ${pc.bold(branchName)}\n`));
      }
    } catch (error) {
      console.error(pc.red(`\nError con la rama Git: ${error.message}\n`));
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
      console.log(pc.cyan(`\nVerificando tarea: ${pc.bold(id)}`));
      const task = getTask(id);

      // 1. Validar estructura del manifiesto
      const validation = validateManifest(task);
      if (!validation.valid) {
        console.log(pc.red('Errores en la estructura del manifiesto YAML:'));
        validation.errors.forEach((err) => console.log(pc.red(`  - ${err}`)));
        process.exit(1);
      }

      console.log(pc.green('Estructura de manifiesto YAML válida.'));

      // 2. Ejecutar comandos de Quality Gates
      console.log(pc.cyan('Ejecutando gates activos...'));
      const gatesResult = runQualityGates(task);

      for (const item of gatesResult.results) {
        if (item.passed) {
          console.log(pc.green(`  [PASS] ${item.gate} -> ${pc.dim(item.command)}`));
        } else {
          console.log(pc.red(`  [FAIL] ${item.gate} -> ${pc.dim(item.command)}`));
          if (item.error) {
            console.log(pc.dim(`    ${item.error}`));
          }
        }
      }

      if (gatesResult.allPassed) {
        console.log(pc.green(`\nTodos los Quality Gates pasaron para ${pc.bold(id)}.\n`));
      } else {
        console.log(pc.red(`\nAlgunos Quality Gates fallaron. Revisa los errores antes de continuar.\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(pc.red(`\nError en verificación: ${error.message}\n`));
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
        console.log(pc.yellow('\nNo hay tareas registradas en .agents/workflow/tasks/.\n'));
        return;
      }

      console.log(pc.cyan(`\nTareas registradas (${tasks.length}):\n`));
      for (const t of tasks) {
        const statusColor = t.status === 'DONE' ? pc.green : t.status === 'IN_PROGRESS' ? pc.yellow : pc.blue;
        const displayTitle = (t.title || t.summary || 'Sin título').substring(0, 65);
        console.log(`  ${pc.bold(t.id.padEnd(12))} [${statusColor(t.status.padEnd(12))}] ${pc.white(displayTitle)} (${pc.dim(t.type)})`);
      }
      console.log();
    } catch (error) {
      console.error(pc.red(`\nError al listar tareas: ${error.message}\n`));
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
        console.log(pc.green(`\nEstado de ${pc.bold(id)} actualizado a: ${pc.bold(updated.status)}\n`));
      } else {
        const task = getTask(id);
        console.log(pc.cyan(`\nTarea: ${pc.bold(task.id)} | Estado actual: ${pc.yellow(task.status)}\n`));
      }
    } catch (error) {
      console.error(pc.red(`\nError al procesar estado: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: task:loop <id> (o task:run)
 * Ejecuta el bucle cerrado autónomo con diagnóstico de fallos y generación de reporte.
 */
program
  .command('task:loop <id>')
  .alias('task:run')
  .description('Ejecuta el bucle cerrado autónomo con diagnóstico y reporte final')
  .option('-m, --max-retries <n>', 'Número máximo de iteraciones de reintento', '3')
  .action(async (id, options) => {
    try {
      const maxRetries = parseInt(options.maxRetries, 10) || 3;
      console.log(pc.cyan(`\nIniciando bucle para tarea: ${pc.bold(id)} (máx. reintentos: ${maxRetries})`));

      const loopResult = await runTaskLoop({
        id,
        maxRetries,
      });

      console.log(pc.dim(`\nReporte generado en: ${loopResult.reportPath}`));

      if (loopResult.success) {
        console.log(pc.green(`\nÉxito: todos los Quality Gates pasaron en ${loopResult.iterations} iteración(es).`));
        console.log(pc.yellow(`Estado de ${pc.bold(id)} actualizado a: READY_FOR_PR\n`));
      } else {
        console.log(pc.red(`\nFallo: no se superaron los Quality Gates tras ${loopResult.iterations} iteración(es).`));
        if (loopResult.diagnostics.length > 0) {
          console.log(pc.yellow('\nDiagnóstico de causas:'));
          loopResult.diagnostics.forEach((d) => {
            console.log(pc.red(`  - [${d.category}] Gate "${d.gate}": ${pc.white(d.suggestion)}`));
          });
        }
        console.log();
        process.exit(1);
      }
    } catch (error) {
      console.error(pc.red(`\nError en bucle autónomo: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: memory:sync (o memory:build)
 * Escanea el proyecto y reconstruye el grafo de conocimiento Graphify y el contexto condensado.
 */
program
  .command('memory:sync')
  .alias('memory:build')
  .description('Escanea el código y reconstruye el grafo de conocimiento (.agents/memory/)')
  .action(() => {
    try {
      console.log(pc.cyan('\nSincronizando grafo de conocimiento...'));
      const graph = buildKnowledgeGraph();

      console.log(pc.green('Grafo de memoria sincronizado.'));
      console.log(pc.white(`  Nodos mapeados: ${pc.bold(graph.metrics.totalNodes)}`));
      console.log(pc.white(`  Dependencias/Aristas: ${pc.bold(graph.metrics.totalEdges)}`));
      console.log(pc.white(`  Tareas indexadas: ${pc.bold(graph.metrics.totalTasks)}`));
      console.log(pc.white(`  Lecciones registradas: ${pc.bold(graph.metrics.totalLessons)}`));
      console.log(pc.dim('\nArchivos actualizados:'));
      console.log(pc.dim('  .agents/memory/graph.json'));
      console.log(pc.dim('  .agents/memory/context.md\n'));
    } catch (error) {
      console.error(pc.red(`\nError al sincronizar memoria: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: memory:query <keyword>
 * Consulta el grafo de memoria para obtener contexto relevante en pocos tokens.
 */
program
  .command('memory:query <keyword>')
  .description('Consulta contexto y dependencias relevantes en el grafo de memoria')
  .option('-l, --limit <n>', 'Máximo de coincidencias por categoría', '15')
  .action((keyword, options) => {
    try {
      const limit = parseInt(options.limit, 10) || 15;
      console.log(pc.cyan(`\nBuscando contexto para: ${pc.bold(keyword)}\n`));
      const res = queryMemory(keyword, process.cwd(), limit);

      if (res.matchedNodes.length === 0 && res.matchedLessons.length === 0) {
        console.log(pc.yellow(`Sin coincidencias para "${keyword}".\n`));
        return;
      }

      if (res.matchedNodes.length > 0) {
        console.log(pc.green(`Módulos/Nodos coincidentes (${res.matchedNodes.length} de ${res.totalMatches.nodes}):`));
        res.matchedNodes.forEach((n) => {
          console.log(`  - ${pc.bold(n.id)} [${pc.dim(n.type)}]`);
        });
        console.log();
      }

      if (res.matchedLessons.length > 0) {
        console.log(pc.yellow(`Lecciones y trampas conocidas (${res.matchedLessons.length} de ${res.totalMatches.lessons}):`));
        res.matchedLessons.forEach((l) => {
          console.log(`  - [${l.category}] ${pc.white(l.lesson)} -> ${pc.dim(l.solution)}`);
        });
        console.log();
      }

      if (res.truncated) {
        console.log(pc.dim(`Resultado recortado a ${limit} por categoría. Usa --limit para ver más.\n`));
      }
    } catch (error) {
      console.error(pc.red(`\nError en consulta de memoria: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: memory:learn
 * Registra una nueva lección aprendida o trampa evitada en la memoria del proyecto.
 */
program
  .command('memory:learn')
  .description('Registra una lección o trampa en la memoria persistente del proyecto')
  .requiredOption('-l, --lesson <lesson>', 'Descripción de la lección o error superado')
  .option('-c, --category <category>', 'Categoría (BUG_FIX, BEST_PRACTICE, SECURITY, ARCHITECTURE)', 'BUG_FIX')
  .option('-s, --solution <solution>', 'Solución aplicada para prevenirlo', '')
  .action((options) => {
    try {
      const entry = recordLesson({
        lesson: options.lesson,
        category: options.category,
        solution: options.solution,
      });

      console.log(pc.green(`\nLección registrada: [${entry.id}]`));
      console.log(pc.white(`  Categoría: ${entry.category}`));
      console.log(pc.white(`  Lección: ${entry.lesson}`));
      if (entry.solution) {
        console.log(pc.dim(`  Solución: ${entry.solution}`));
      }
      console.log(pc.dim('\nGrafo de memoria y context.md sincronizados.\n'));
    } catch (error) {
      console.error(pc.red(`\nError al registrar lección: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: release <version>
 * Analiza tareas completadas y genera un CHANGELOG.md automático.
 */
program
  .command('release <version>')
  .description('Genera una release, actualizando CHANGELOG.md y package.json')
  .action((version) => {
    try {
      console.log(pc.cyan(`\nGenerando release: ${pc.bold(version)}`));
      const res = generateRelease(version);

      if (!res.success) {
        console.log(pc.yellow(`\n${res.message}\n`));
        return;
      }

      console.log(pc.green(`\nRelease ${pc.bold(res.version)} completada.`));
      console.log(pc.white(`  Tareas procesadas: ${res.tasksCount}`));
      console.log(pc.dim(`  Changelog actualizado en: ${res.changelogPath}`));
      if (res.pkgUpdated) {
        console.log(pc.dim(`  package.json actualizado a la versión ${res.version}`));
      }
      console.log();
    } catch (error) {
      console.error(pc.red(`\nError al generar release: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: test:scaffold <id>
 * Genera el código base de Step Definitions (Cucumber) a partir de un .feature.
 */
program
  .command('test:scaffold <id>')
  .description('Genera el código base de Cucumber (JS) desde un archivo .feature')
  .action((id) => {
    try {
      console.log(pc.cyan(`\nGenerando scaffold BDD para: ${pc.bold(id)}`));
      const res = generateBddScaffold(id);

      if (!res.success) {
        console.log(pc.yellow(`\n${res.message}\n`));
        return;
      }

      console.log(pc.green(`\nScaffold generado.`));
      console.log(pc.white(`  Pasos extraídos: ${res.stepsCount}`));
      console.log(pc.dim(`  Archivo creado en: ${res.filePath}\n`));
    } catch (error) {
      console.error(pc.red(`\nError al generar scaffolding: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: phase:start <planId>
 * Activa el modo de desarrollo por fases con una lista ordenada de features.
 */
program
  .command('phase:start <planId>')
  .description('Activa el modo de desarrollo por fases (feat + check → siguiente feat)')
  .requiredOption('-t, --title <title>', 'Título del plan por fases')
  .option('-p, --phase <TASK-ID:Título>', 'Fase (feat) en orden; repetible', collect, [])
  .option('--health <gate=comando>', 'Comando del healthcheck final; repetible (por defecto: pnpm test y pnpm test:bdd)', collect, [])
  .action((planId, options) => {
    try {
      const phases = options.phase.map(parsePhaseArg);
      // Si se definieron comandos de healthcheck propios, reemplazan a los de por defecto
      let healthCommands = DEFAULT_HEALTH_COMMANDS;
      if (options.health.length > 0) {
        healthCommands = {};
        for (const entry of options.health) {
          const sep = entry.indexOf('=');
          if (sep <= 0) {
            throw new Error(`Healthcheck inválido "${entry}". Formato esperado: <gate>=<comando>`);
          }
          healthCommands[entry.slice(0, sep).trim()] = entry.slice(sep + 1).trim();
        }
      }

      const { plan, logPath } = startPhasedDevelopment({ id: planId, title: options.title, phases, healthCommands });

      console.log(pc.green(`\n✔ Modo por fases activado: ${pc.bold(plan.id)} (${plan.phases.length} fase(s))`));
      plan.phases.forEach((p, i) => console.log(pc.dim(`  ${i + 1}. ${p.task_id} - ${p.title}`)));
      console.log(pc.yellow(`\n🔨 Fase actual: ${pc.bold(plan.phases[0].task_id)}. Al terminarla ejecuta: agt phase:check`));
      console.log(pc.dim(`📓 Bitácora: ${logPath}\n`));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al iniciar el modo por fases: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: phase:check [planId]
 * Verifica la feat actual; si pasa avanza a la siguiente, si falla abre un fix.
 */
program
  .command('phase:check [planId]')
  .description('Ejecuta el check de la fase actual (avanza o abre un fix)')
  .action((planId) => {
    try {
      const res = checkCurrentPhase({ planId });

      if (res.passed) {
        console.log(pc.green(`\n✔ Check en verde para ${pc.bold(res.phase.task_id)}.`));
        if (res.nextPhase) {
          console.log(pc.yellow(`🔨 Siguiente feat: ${pc.bold(res.nextPhase.task_id)} - ${res.nextPhase.title}`));
        } else {
          console.log(pc.cyan(`🏁 Todas las fases completadas. Ejecuta el healthcheck final: agt phase:health`));
        }
      } else {
        console.log(pc.red(`\n✖ Check fallido para ${pc.bold(res.phase.task_id)}. Fix abierto: ${pc.bold(res.fixTask)}`));
        res.diagnostics.forEach((d) => console.log(pc.red(`  - [${d.category}] ${d.gate}: ${pc.white(d.suggestion)}`)));
        console.log(pc.yellow(`\nCorrige el bug y vuelve a ejecutar: agt phase:check`));
      }
      console.log(pc.dim(`📓 Bitácora: ${res.logPath}\n`));
      if (!res.passed) {
        process.exit(1);
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error en el check de fase: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: phase:health [planId]
 * Healthcheck final del plan; si falla abre un hotfix.
 */
program
  .command('phase:health [planId]')
  .description('Ejecuta el healthcheck final del plan (completa o abre un hotfix)')
  .action((planId) => {
    try {
      const res = runFinalHealthcheck({ planId });

      res.results.forEach((r) => {
        const line = `  ${r.passed ? '✔ [PASS]' : '✖ [FAIL]'} ${r.gate} -> ${pc.dim(r.command)}`;
        console.log(r.passed ? pc.green(line) : pc.red(line));
      });

      if (res.passed) {
        console.log(pc.green(`\n🎉 Healthcheck final en verde. Plan completado y modo por fases desactivado.`));
      } else {
        console.log(pc.red(`\n🚑 Healthcheck fallido. Hotfix abierto: ${pc.bold(res.hotfixTask)}`));
        console.log(pc.yellow(`Corrige el bug y vuelve a ejecutar: agt phase:health`));
      }
      console.log(pc.dim(`📓 Bitácora: ${res.logPath}\n`));
      if (!res.passed) {
        process.exit(1);
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error en el healthcheck: ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: phase:status [planId]
 * Muestra el estado del plan por fases activo.
 */
program
  .command('phase:status [planId]')
  .description('Muestra el estado del plan por fases (activo por defecto)')
  .action((planId) => {
    try {
      const plan = getPhasePlan(planId);
      console.log(pc.cyan(`\n📋 Plan ${pc.bold(plan.id)}: ${plan.title} [${pc.yellow(plan.status)}]\n`));
      plan.phases.forEach((p, i) => {
        const color = p.status === 'DONE' ? pc.green : p.status === 'FIXING' ? pc.red : p.status === 'IN_PROGRESS' ? pc.yellow : pc.dim;
        console.log(`  ${i + 1}. ${pc.bold(p.task_id.padEnd(14))} [${color(p.status.padEnd(11))}] ${p.title}`);
      });
      const open = plan.fixes.filter((f) => f.status === 'OPEN');
      if (open.length > 0) {
        console.log(pc.red(`\n  Correcciones abiertas: ${open.map((f) => `${f.id} (${f.type})`).join(', ')}`));
      }
      console.log(pc.dim(`\n📓 Bitácora: docs/bitacora/${plan.id}.md\n`));
    } catch (error) {
      console.error(pc.red(`\n✖ ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * COMANDO: mcp
 * Inicia el servidor MCP nativo (Protocolo JSON-RPC por stdio).
 * IDEs y clientes de IA (Cursor, Antigravity) conectan a este proceso.
 */
program
  .command('mcp')
  .description('Inicia el Servidor Model Context Protocol (MCP) por stdio')
  .action(async () => {
    try {
      // Importante: No imprimir nada por console.log/console.error usando stdout,
      // ya que stdio se usa exclusivamente para el protocolo JSON-RPC.
      await startMcpServer();
    } catch (error) {
      process.exit(1);
    }
  });

program.parse(process.argv);
