// Importamos las funciones Given, When, Then, Before, After de Cucumber
import { Given, When, Then, Before, After } from '@cucumber/cucumber';
// Importamos módulos de Node.js para crear entornos de prueba temporales aislados
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
// Importamos las funciones del módulo task-manager de nuestro agente
import { createTask, getTask, updateTaskStatus } from '../../../src/task-manager.js';

// Variable de contexto para almacenar el directorio temporal de cada escenario
let tempDir;
let lastError;
let currentTaskId;

// Hook que se ejecuta antes de cada escenario de Cucumber
Before(function () {
  // Creamos un directorio temporal único para aislar los archivos generados
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdd-test-'));
  lastError = null;
  currentTaskId = null;
});

// Hook que se ejecuta después de cada escenario de Cucumber
After(function () {
  // Limpiamos y eliminamos el directorio temporal
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// GIVEN: Inicializa el entorno aislado
Given('an isolated project environment', function () {
  // Verificamos que el directorio temporal exista y sea accesible
  assert.strictEqual(fs.existsSync(tempDir), true, 'El directorio temporal debe existir');
});

// WHEN: El usuario crea una nueva tarea con ID, título y tipo
When(
  'the user creates a task with ID {string}, title {string}, and type {string}',
  function (id, title, type) {
    currentTaskId = id;
    // Ejecutamos la función createTask apuntando al directorio temporal
    createTask({
      id,
      title,
      type,
      createBranch: false, // Desactivamos creación de rama en tests unitarios para no ensuciar el git real
      projectRoot: tempDir,
    });
  }
);

// THEN: Verifica la existencia del manifiesto de la tarea
Then('the task manifest {string} should exist', function (relativePath) {
  const fullPath = path.join(tempDir, relativePath);
  assert.strictEqual(fs.existsSync(fullPath), true, `El manifiesto debe existir en: ${fullPath}`);
});

// THEN: Verifica la existencia del documento de especificación
Then('the specification document {string} should exist', function (relativePath) {
  const fullPath = path.join(tempDir, relativePath);
  assert.strictEqual(fs.existsSync(fullPath), true, `La especificación debe existir en: ${fullPath}`);
});

// THEN: Verifica la existencia del plan de implementación
Then('the implementation plan {string} should exist', function (relativePath) {
  const fullPath = path.join(tempDir, relativePath);
  assert.strictEqual(fs.existsSync(fullPath), true, `El plan de implementación debe existir en: ${fullPath}`);
});

// THEN: Verifica la existencia del plan de pruebas
Then('the test plan {string} should exist', function (relativePath) {
  const fullPath = path.join(tempDir, relativePath);
  assert.strictEqual(fs.existsSync(fullPath), true, `El plan de pruebas debe existir en: ${fullPath}`);
});

// THEN: Verifica la existencia del archivo de especificación BDD en Gherkin (.feature)
Then('the Gherkin feature file {string} should exist', function (relativePath) {
  const fullPath = path.join(tempDir, relativePath);
  assert.strictEqual(fs.existsSync(fullPath), true, `El archivo .feature debe existir en: ${fullPath}`);
});

// WHEN: Intento de crear una tarea sin ID obligatorio
When('the user attempts to create a task without an ID', function () {
  try {
    createTask({
      id: '',
      title: 'Tarea Inválida',
      createBranch: false,
      projectRoot: tempDir,
    });
  } catch (err) {
    // Capturamos el error para evaluarlo en el siguiente paso
    lastError = err;
  }
});

// THEN: Verifica que la creación falle con el mensaje de error adecuado
Then('the task creation should fail with an error stating the ID is mandatory', function () {
  assert.notStrictEqual(lastError, null, 'Debe ocurrir un error al omitir el ID');
  assert.match(lastError.message, /El ID de la tarea es obligatorio/);
});

// GIVEN: Precondición con una tarea creada en estado inicial
Given('a task {string} with initial status {string}', function (id, status) {
  currentTaskId = id;
  createTask({
    id,
    title: 'Tarea de Prueba de Estados',
    type: 'feat',
    createBranch: false,
    projectRoot: tempDir,
  });

  if (status !== 'PLANNED') {
    updateTaskStatus(id, status, tempDir);
  }
});

// WHEN: Se actualiza el estado de la tarea
When('the task status is updated to {string}', function (newStatus) {
  updateTaskStatus(currentTaskId, newStatus, tempDir);
});

// THEN: Verifica que el estado persista en el manifiesto YAML
Then('the task manifest should reflect the new status {string}', function (expectedStatus) {
  const taskData = getTask(currentTaskId, tempDir);
  assert.strictEqual(taskData.status, expectedStatus, `El estado esperado era ${expectedStatus} pero se obtuvo ${taskData.status}`);
});
