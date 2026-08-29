// Importamos las utilidades de testing de Vitest
import { describe, it, expect } from 'vitest';
// Importamos las funciones de validación
import { validateManifest, runQualityGates } from '../src/validator.js';

describe('Módulo de Validación y Quality Gates (src/validator.js)', () => {
  describe('validateManifest()', () => {
    it('debe validar exitosamente un manifiesto bien estructurado', () => {
      const manifestValido = {
        id: 'AGT-0001',
        title: 'Título de Prueba',
        type: 'feat',
        status: 'PLANNED',
        quality_gates: {
          unit_tests: true,
        },
      };

      const resultado = validateManifest(manifestValido);
      expect(resultado.valid).toBe(true);
      expect(resultado.errors).toHaveLength(0);
    });

    it('debe rechazar un manifiesto al que le faltan campos obligatorios', () => {
      const manifestInvalido = {
        title: 'Falta el ID',
      };

      const resultado = validateManifest(manifestInvalido);
      expect(resultado.valid).toBe(false);
      expect(resultado.errors.some((err) => err.includes('"id"'))).toBe(true);
      expect(resultado.errors.some((err) => err.includes('"type"'))).toBe(true);
      expect(resultado.errors.some((err) => err.includes('"status"'))).toBe(true);
    });

    it('debe rechazar tipos de tarea no permitidos', () => {
      const manifestTipoInvalido = {
        id: 'AGT-0001',
        title: 'Prueba',
        type: 'tipo_inexistente',
        status: 'PLANNED',
        quality_gates: {},
      };

      const resultado = validateManifest(manifestTipoInvalido);
      expect(resultado.valid).toBe(false);
      expect(resultado.errors.some((err) => err.includes('type'))).toBe(true);
    });
  });

  describe('runQualityGates()', () => {
    it('debe ejecutar comandos exitosos y retornar allPassed: true', () => {
      const manifest = {
        id: 'TEST-QG',
        quality_gates: {
          echo_test: true,
        },
        commands: {
          echo_test: 'node -e "process.exit(0)"',
        },
      };

      const resultado = runQualityGates(manifest);
      expect(resultado.allPassed).toBe(true);
      expect(resultado.results[0].passed).toBe(true);
    });

    it('debe capturar comandos fallidos y retornar allPassed: false', () => {
      const manifest = {
        id: 'TEST-QG-FAIL',
        quality_gates: {
          failing_check: true,
        },
        commands: {
          failing_check: 'node -e "process.exit(1)"',
        },
      };

      const resultado = runQualityGates(manifest);
      expect(resultado.allPassed).toBe(false);
      expect(resultado.results[0].passed).toBe(false);
    });
  });
});
