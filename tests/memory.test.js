// Importamos las utilidades de testing de Vitest
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Importamos módulos de sistema de archivos para crear entornos temporales de prueba
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// Importamos las funciones del módulo de memoria
import { buildKnowledgeGraph, recordLesson, queryMemory } from '../src/memory.js';

describe('Módulo de Memoria y Grafo de Conocimiento (src/memory.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));

    // Creamos una estructura simulada con src/ y .agents/
    const srcDir = path.join(tempDir, 'src');
    const tasksDir = path.join(tempDir, '.agents', 'workflow', 'tasks');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(tasksDir, { recursive: true });

    // Archivo de prueba 1
    fs.writeFileSync(
      path.join(srcDir, 'auth.js'),
      `import { db } from './db.js';\nexport function login() {}\n`,
      'utf-8'
    );

    // Archivo de prueba 2
    fs.writeFileSync(
      path.join(srcDir, 'db.js'),
      `export const db = {};\n`,
      'utf-8'
    );

    // Tarea simulada
    fs.writeFileSync(
      path.join(tasksDir, 'AGT-0001.yml'),
      `id: AGT-0001\ntitle: Auth Module\ntype: feat\nstatus: DONE\n`,
      'utf-8'
    );
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('debe construir el grafo de conocimiento y generar graph.json y context.md', () => {
    const graph = buildKnowledgeGraph(tempDir);

    expect(graph.metrics.totalNodes).toBeGreaterThanOrEqual(3);
    expect(graph.metrics.totalTasks).toBe(1);

    const graphJson = path.join(tempDir, '.agents', 'memory', 'graph.json');
    const contextMd = path.join(tempDir, '.agents', 'memory', 'context.md');

    expect(fs.existsSync(graphJson)).toBe(true);
    expect(fs.existsSync(contextMd)).toBe(true);

    const contextContent = fs.readFileSync(contextMd, 'utf-8');
    expect(contextContent).toContain('Contexto y Memoria del Proyecto');
    expect(contextContent).toContain('src/auth.js');
    expect(contextContent).toContain('AGT-0001: Auth Module');
  });

  it('debe registrar lecciones aprendidas y persistirlas en lessons.json', () => {
    const entry = recordLesson({
      lesson: 'Nunca usar sessionStorage para guardar tokens JWT',
      category: 'SECURITY',
      solution: 'Almacenar en cookies HttpOnly y SameSite=Strict',
      projectRoot: tempDir,
    });

    expect(entry.id).toBeDefined();
    expect(entry.category).toBe('SECURITY');

    const lessonsJson = path.join(tempDir, '.agents', 'memory', 'lessons.json');
    expect(fs.existsSync(lessonsJson)).toBe(true);

    const lessons = JSON.parse(fs.readFileSync(lessonsJson, 'utf-8'));
    expect(lessons).toHaveLength(1);
    expect(lessons[0].lesson).toContain('sessionStorage');
  });

  it('debe consultar la memoria semánticamente por palabra clave', () => {
    recordLesson({
      lesson: 'Evitar N+1 queries al buscar turnos de pacientes',
      category: 'PERFORMANCE',
      solution: 'Usar inner join con índices',
      projectRoot: tempDir,
    });

    const resultAuth = queryMemory('auth', tempDir);
    expect(resultAuth.matchedNodes.some((n) => n.id.includes('auth'))).toBe(true);

    const resultPerf = queryMemory('turnos', tempDir);
    expect(resultPerf.matchedLessons.some((l) => l.lesson.includes('turnos'))).toBe(true);
  });
});
