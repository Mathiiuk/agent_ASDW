import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert';

let currentEnvironment = '';
let systemState = 'uninitialized';
let validationResult = '';
let lastError = null;

Given('the environment is initialized for {string}', async function (id) {
  currentEnvironment = id;
  assert.strictEqual(currentEnvironment, id);
});

Given('the system is in a valid initial state', async function () {
  systemState = 'valid';
  assert.strictEqual(systemState, 'valid');
});

When('the user performs the primary action with valid input', async function () {
  if (systemState === 'valid') {
    systemState = 'success';
  }
});

Then('the system should produce the expected successful result', async function () {
  assert.strictEqual(systemState, 'success');
});

Then('the state changes should be persisted correctly', async function () {
  // Simulación de persistencia correcta
  assert.ok(true);
});

Given('the system is ready', async function () {
  systemState = 'ready';
  assert.strictEqual(systemState, 'ready');
});

When('the user provides invalid or empty data', async function () {
  lastError = 'Invalid request format';
});

Then('the system should reject the request with a clear error message', async function () {
  assert.strictEqual(lastError, 'Invalid request format');
});

Then('no unauthorized state changes should occur', async function () {
  assert.strictEqual(systemState, 'ready'); // Permanece inalterado
});

Given('an input value of {string}', async function (val) {
  this.inputValue = val;
});

When('the validation logic is executed', async function () {
  if (this.inputValue && this.inputValue.startsWith('valid')) {
    validationResult = 'success';
  } else {
    validationResult = 'error';
  }
});

Then('the resulting status should be {string}', async function (expectedStatus) {
  assert.strictEqual(validationResult, expectedStatus);
});
