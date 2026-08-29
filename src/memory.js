// Importamos módulos nativos de sistema de archivos y rutas
import fs from 'node:fs';
import path from 'node:path';
// Importamos funciones del gestor de tareas
import { listTasks } from './task-manager.js';

/**
 * Rutas estándar para los archivos del sistema de memoria Graphify
 */
export const MEMORY_PATHS = {
  dir: path.join('.agents', 'memory'),
  graph: path.join('.agents', 'memory', 'graph.json'),
  context: path.join('.agents', 'memory', 'context.md'),
  lessons: path.join('.agents', 'memory', 'lessons.json'),
};

/**
 * Asegura que el directorio de memoria exista dentro de .agents/
 * 
 * @param {string} projectRoot - Directorio raíz del proyecto
 */
export function ensureMemoryDir(projectRoot = process.cwd()) {
  const memDir = path.join(projectRoot, MEMORY_PATHS.dir);
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true });
  }
}

/**
 * Extrae los módulos importados en un archivo JavaScript mediante expresiones regulares.
 * 
 * @param {string} content - Contenido del archivo de código fuente
 * @returns {string[]} - Lista de rutas relativas o nombres de paquetes importados
 */
function extractImports(content) {
  const imports = [];
  // Regex para capturar imports estáticos: import ... from '...'
  const importRegex = /import\s+(?:[\w\s{},*]+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Escanea recursivamente un directorio para recopilar archivos de código fuente.
 * 
 * @param {string} dir - Directorio a escanear
 * @param {string[]} extensions - Extensiones permitidas (ej: ['.js', '.ts', '.jsx', '.tsx'])
 * @returns {string[]} - Lista de rutas absolutas de archivos encontrados
 */
function scanFiles(dir, extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.feature']) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Ignoramos node_modules y .git
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Construye el Grafo de Conocimiento (Knowledge Graph) del proyecto.
 * Mapea módulos, dependencias, pruebas, tareas y genera un resumen condensado para ahorro de tokens.
 * 
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Grafo de conocimiento con nodos, aristas y métricas
 */
export function buildKnowledgeGraph(projectRoot = process.cwd()) {
  ensureMemoryDir(projectRoot);

  const nodes = [];
  const edges = [];

  // 1. ESCANEAMOS ARCHIVOS FUENTE EN src/, bin/, tests/
  const scanDirs = ['src', 'bin', 'tests'];
  const allFiles = [];

  for (const sub of scanDirs) {
    const fullSub = path.join(projectRoot, sub);
    allFiles.push(...scanFiles(fullSub));
  }

  // 2. CONSTRUIMOS NODOS Y RELACIONES DE CÓDIGO
  for (const filePath of allFiles) {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = extractImports(content);
    const isTest = relativePath.startsWith('tests/');
    const isCli = relativePath.startsWith('bin/');

    const node = {
      id: relativePath,
      label: path.basename(filePath),
      type: isTest ? 'test' : isCli ? 'cli' : 'module',
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      lineCount: content.split('\n').length,
      imports,
    };

    nodes.push(node);

    // Creamos aristas de dependencia
    for (const imp of imports) {
      edges.push({
        from: relativePath,
        to: imp,
        relation: 'depends_on',
      });
    }
  }

  // 3. INCORPORAMOS TAREAS DEL WORKFLOW AL GRAFO
  const tasks = listTasks(projectRoot);
  for (const task of tasks) {
    const taskNodeId = `task:${task.id}`;
    nodes.push({
      id: taskNodeId,
      label: `${task.id}: ${task.title}`,
      type: 'task',
      status: task.status,
      taskType: task.type,
    });

    edges.push({
      from: taskNodeId,
      to: `.agents/workflow/tasks/${task.id}.yml`,
      relation: 'manifested_by',
    });
  }

  // 4. LEEMOS LECCIONES PREVIAS (SI EXISTEN)
  const lessonsPath = path.join(projectRoot, MEMORY_PATHS.lessons);
  let lessons = [];
  if (fs.existsSync(lessonsPath)) {
    try {
      lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf-8'));
    } catch {
      lessons = [];
    }
  }

  const graphData = {
    updatedAt: new Date().toISOString(),
    project: path.basename(projectRoot),
    metrics: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalTasks: tasks.length,
      totalLessons: lessons.length,
    },
    nodes,
    edges,
    lessons,
  };

  // Guardamos graph.json
  const graphFile = path.join(projectRoot, MEMORY_PATHS.graph);
  fs.writeFileSync(graphFile, JSON.stringify(graphData, null, 2), 'utf-8');

  // 5. GENERAMOS CONTEXTO CONDENSADO EN MARKDOWN (.agents/memory/context.md)
  generateCompactContext(graphData, projectRoot);

  return graphData;
}

/**
 * Genera un archivo Markdown de alta densidad y bajo consumo de tokens con la arquitectura del proyecto.
 * 
 * @param {object} graphData - Datos serializados del grafo
 * @param {string} projectRoot - Directorio raíz del proyecto
 */
function generateCompactContext(graphData, projectRoot = process.cwd()) {
  const contextFile = path.join(projectRoot, MEMORY_PATHS.context);

  let md = `# 🧠 Contexto y Memoria del Proyecto: ${graphData.project}\n\n`;
  md += `> **Última sincronización:** ${graphData.updatedAt} | **Nodos:** ${graphData.metrics.totalNodes} | **Tareas:** ${graphData.metrics.totalTasks}\n\n`;

  md += `## 📦 Mapa de Módulos y Dependencias\n\n`;
  const modules = graphData.nodes.filter((n) => n.type === 'module' || n.type === 'cli');
  md += `| Módulo | Líneas | Dependencias Principales |\n`;
  md += `|---|---|---|\n`;
  for (const mod of modules) {
    const deps = mod.imports.slice(0, 3).join(', ') || 'ninguna';
    md += `| \`${mod.id}\` | ${mod.lineCount} | ${deps} |\n`;
  }

  md += `\n## 📋 Tareas Registradas\n\n`;
  const tasks = graphData.nodes.filter((n) => n.type === 'task');
  for (const t of tasks) {
    md += `- **${t.label}** \`[${t.status}]\`\n`;
  }

  if (graphData.lessons.length > 0) {
    md += `\n## 💡 Lecciones Aprendidas y Anti-Patrones a Evitar\n\n`;
    for (const l of graphData.lessons) {
      md += `- **[${l.category}]** ${l.lesson} *(Solución: ${l.solution})*\n`;
    }
  }

  fs.writeFileSync(contextFile, md, 'utf-8');
}

/**
 * Registra un aprendizaje, corrección de bug o trampa en la memoria persistente del proyecto.
 * 
 * @param {object} options - Datos de la lección
 * @param {string} options.lesson - Descripción de la trampa o error encontrado
 * @param {string} [options.category='BUG_FIX'] - Categoría (BUG_FIX, BEST_PRACTICE, ARCHITECTURE, SECURITY)
 * @param {string} [options.solution=''] - Solución aplicada para no repetir el error
 * @param {string} [options.projectRoot=process.cwd()] - Directorio raíz del proyecto
 * @returns {object} - Registro creado
 */
export function recordLesson({
  lesson,
  category = 'BUG_FIX',
  solution = '',
  projectRoot = process.cwd(),
}) {
  ensureMemoryDir(projectRoot);
  const lessonsPath = path.join(projectRoot, MEMORY_PATHS.lessons);

  let lessons = [];
  if (fs.existsSync(lessonsPath)) {
    try {
      lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf-8'));
    } catch {
      lessons = [];
    }
  }

  const newEntry = {
    id: `LES-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    category,
    lesson,
    solution,
  };

  lessons.push(newEntry);
  fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2), 'utf-8');

  // Re-sincronizamos el grafo y el contexto condensado
  buildKnowledgeGraph(projectRoot);

  return newEntry;
}

/**
 * Realiza una consulta semántica al grafo de memoria para obtener contexto relevante en pocos tokens.
 * 
 * @param {string} keyword - Palabra clave a buscar (ej: "git", "turnos", "oauth")
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {{ matchedNodes: object[], matchedLessons: object[], relatedEdges: object[] }} - Resultados de la consulta
 */
export function queryMemory(keyword, projectRoot = process.cwd()) {
  const graphPath = path.join(projectRoot, MEMORY_PATHS.graph);

  // Si no existe el grafo, lo construimos al vuelo
  let graphData;
  if (!fs.existsSync(graphPath)) {
    graphData = buildKnowledgeGraph(projectRoot);
  } else {
    graphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  }

  const lowerKey = (keyword || '').toLowerCase();

  // Filtramos nodos coincidentes
  const matchedNodes = graphData.nodes.filter(
    (n) => n.id.toLowerCase().includes(lowerKey) || (n.label && n.label.toLowerCase().includes(lowerKey))
  );

  // Filtramos lecciones coincidentes
  const matchedLessons = graphData.lessons.filter(
    (l) => l.lesson.toLowerCase().includes(lowerKey) || l.category.toLowerCase().includes(lowerKey)
  );

  // Extraemos aristas vinculadas a los nodos encontrados
  const matchedIds = new Set(matchedNodes.map((n) => n.id));
  const relatedEdges = graphData.edges.filter((e) => matchedIds.has(e.from) || matchedIds.has(e.to));

  return {
    query: keyword,
    matchedNodes,
    matchedLessons,
    relatedEdges,
  };
}
