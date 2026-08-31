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
  runTaskLoop,
  initProject,
  buildKnowledgeGraph,
  recordLesson,
  queryMemory,
  generateRelease,
  generateBddScaffold,
  startMcpServer,
} from '../src/index.js';

// Inicializamos el programa CLI
const program = new Command();

// Configuramos metadatos básicos de la CLI
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
      console.log(pc.cyan(`\n🤖 [Agente Workflow] Inicializando ecosistema en: ${pc.bold(cwd)}...`));

      const result = initProject({
        targetDir: cwd,
        copyCucumber: options.cucumber !== false,
        copyCi: options.ci !== false,
      });

      console.log(pc.green(`✔ ¡Proyecto inicializado con éxito!`));
      console.log(pc.dim('Carpetas configuradas en .agents/:'));
      result.copiedFolders.forEach((f) => console.log(pc.dim(`  📁 .agents/${f}/`)));
      console.log(pc.dim('Estructura de workflow creada:'));
      result.createdWorkflowDirs.forEach((w) => console.log(pc.dim(`  📂 .agents/workflow/${w}/`)));

      if (result.ciCreated) {
        console.log(pc.cyan(`🚀 Pipeline de CI/CD creado en: ${pc.bold('.github/workflows/ci.yml')}`));
      }

      console.log(pc.yellow('\n👉 Siguiente paso para comenzar tu primera tarea:'));
      console.log(pc.white(`   agt task:new TSK-0001 -t "Mi primera funcionalidad" --type feat\n`));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al inicializar el proyecto: ${error.message}\n`));
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
      console.log(pc.cyan(`\n🔄 [Self-Healing Loop] Iniciando bucle para tarea: ${pc.bold(id)} (Máx. reintentos: ${maxRetries})...`));

      const loopResult = await runTaskLoop({
        id,
        maxRetries,
      });

      console.log(pc.dim(`\nReporte generado en: ${loopResult.reportPath}`));

      if (loopResult.success) {
        console.log(pc.green(`\n🎉 [ÉXITO] Todos los Quality Gates pasaron en ${loopResult.iterations} iteración(es).`));
        console.log(pc.yellow(`Estado de ${pc.bold(id)} actualizado a: READY_FOR_PR\n`));
      } else {
        console.log(pc.red(`\n⚠️ [FALLO] No se superaron los Quality Gates tras ${loopResult.iterations} iteración(es).`));
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
      console.error(pc.red(`\n✖ Error en bucle autónomo: ${error.message}\n`));
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
      console.log(pc.cyan('\n🧠 [Graphify Memory] Sincronizando grafo de conocimiento del proyecto...'));
      const graph = buildKnowledgeGraph();

      console.log(pc.green('✔ Grafo de memoria sincronizado exitosamente.'));
      console.log(pc.white(`  📦 Nodos mapeados: ${pc.bold(graph.metrics.totalNodes)}`));
      console.log(pc.white(`  🔗 Dependencias/Aristas: ${pc.bold(graph.metrics.totalEdges)}`));
      console.log(pc.white(`  📋 Tareas indexadas: ${pc.bold(graph.metrics.totalTasks)}`));
      console.log(pc.white(`  💡 Lecciones registradas: ${pc.bold(graph.metrics.totalLessons)}`));
      console.log(pc.dim('\nArchivos actualizados:'));
      console.log(pc.dim('  📄 .agents/memory/graph.json'));
      console.log(pc.dim('  📄 .agents/memory/context.md\n'));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al sincronizar memoria: ${error.message}\n`));
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
  .action((keyword) => {
    try {
      console.log(pc.cyan(`\n🔍 [Graphify Memory] Buscando contexto para: ${pc.bold(keyword)}...\n`));
      const res = queryMemory(keyword);

      if (res.matchedNodes.length === 0 && res.matchedLessons.length === 0) {
        console.log(pc.yellow(`No se encontraron coincidencias directas para "${keyword}".\n`));
        return;
      }

      if (res.matchedNodes.length > 0) {
        console.log(pc.green(`📦 Módulos/Nodos Coincidentes (${res.matchedNodes.length}):`));
        res.matchedNodes.forEach((n) => {
          console.log(`  - ${pc.bold(n.id)} [${pc.dim(n.type)}]`);
        });
        console.log();
      }

      if (res.matchedLessons.length > 0) {
        console.log(pc.yellow(`💡 Lecciones y Trampas Conocidas (${res.matchedLessons.length}):`));
        res.matchedLessons.forEach((l) => {
          console.log(`  - [${l.category}] ${pc.white(l.lesson)} -> ${pc.dim(l.solution)}`);
        });
        console.log();
      }
    } catch (error) {
      console.error(pc.red(`\n✖ Error en consulta de memoria: ${error.message}\n`));
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

      console.log(pc.green(`\n✔ Lección registrada en memoria: [${entry.id}]`));
      console.log(pc.white(`  Categoría: ${entry.category}`));
      console.log(pc.white(`  Lección: ${entry.lesson}`));
      if (entry.solution) {
        console.log(pc.dim(`  Solución: ${entry.solution}`));
      }
      console.log(pc.dim('\nGrafo de memoria y context.md sincronizados automáticamente.\n'));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al registrar lección: ${error.message}\n`));
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
      console.log(pc.cyan(`\n📦 Generando Release: ${pc.bold(version)}...`));
      const res = generateRelease(version);

      if (!res.success) {
        console.log(pc.yellow(`\n⚠️  ${res.message}\n`));
        return;
      }

      console.log(pc.green(`\n✔ Release ${pc.bold(res.version)} completado.`));
      console.log(pc.white(`  Tareas procesadas: ${res.tasksCount}`));
      console.log(pc.dim(`  Changelog actualizado en: ${res.changelogPath}`));
      if (res.pkgUpdated) {
        console.log(pc.dim(`  package.json actualizado a la versión ${res.version}`));
      }
      console.log();
    } catch (error) {
      console.error(pc.red(`\n✖ Error al generar release: ${error.message}\n`));
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
      console.log(pc.cyan(`\n🔨 Generando Scaffold BDD para: ${pc.bold(id)}...`));
      const res = generateBddScaffold(id);

      if (!res.success) {
        console.log(pc.yellow(`\n⚠️  ${res.message}\n`));
        return;
      }

      console.log(pc.green(`\n✔ Scaffold generado exitosamente.`));
      console.log(pc.white(`  Pasos extraídos: ${res.stepsCount}`));
      console.log(pc.dim(`  Archivo creado en: ${res.filePath}\n`));
    } catch (error) {
      console.error(pc.red(`\n✖ Error al generar scaffolding: ${error.message}\n`));
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

// Parseamos los argumentos recibidos por la línea de comandos
program.parse(process.argv);
