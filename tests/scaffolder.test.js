import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { generateBddScaffold } from '../src/scaffolder.js';

vi.mock('node:fs');

describe('BDD Scaffolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe rechazar si no hay taskId', () => {
    expect(() => generateBddScaffold()).toThrow('El ID de la tarea es obligatorio');
  });

  it('debe abortar si el feature no existe', () => {
    fs.existsSync.mockReturnValue(false);
    const res = generateBddScaffold('AGT-999', '/mock');
    expect(res.success).toBe(false);
    expect(res.message).toContain('No se encontró el archivo feature');
  });

  it('debe parsear Given, When, Then, And y generar el JS', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(`Feature: Prueba
  Scenario: Test 1
    Given el usuario "Alice" existe
    And está logueado
    When hace clic en 'comprar'
    Then el carrito se actualiza
    But el stock no cambia
    `);

    const res = generateBddScaffold('AGT-001', '/mock');
    
    expect(res.success).toBe(true);
    expect(res.stepsCount).toBe(5);
    
    // Verificar que se escribió el archivo
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writtenContent = fs.writeFileSync.mock.calls[0][1];
    
    // Debe incluir los imports base
    expect(writtenContent).toContain('import { Given, When, Then }');
    
    // Debe haber transformado las keywords correctamente
    expect(writtenContent).toContain("Given('el usuario \"Alice\" existe'");
    expect(writtenContent).toContain("Given('está logueado'"); // And se transformó en Given
    expect(writtenContent).toContain("When('hace clic en \\'comprar\\''"); // Escapó comillas
    expect(writtenContent).toContain("Then('el carrito se actualiza'");
    expect(writtenContent).toContain("Given('el stock no cambia'"); // But se transformó en Given
  });
});
