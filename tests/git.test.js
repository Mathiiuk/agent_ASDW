import { describe, it, expect } from 'vitest';
import { slugify, formatBranchName, isGitRepo, getCurrentBranch } from '../src/git.js';

describe('Módulo de Git (src/git.js)', () => {
  describe('slugify()', () => {
    it('debe convertir texto simple con espacios en minúsculas y guiones', () => {
      const resultado = slugify('Mi Nueva Tarea de Prueba');
      expect(resultado).toBe('mi-nueva-tarea-de-prueba');
    });

    it('debe remover acentos y caracteres diacríticos correctamente', () => {
      const resultado = slugify('Configuración de Autenticación y Verificación');
      expect(resultado).toBe('configuracion-de-autenticacion-y-verificacion');
    });

    it('debe eliminar caracteres especiales y puntuación', () => {
      const resultado = slugify('Fix: Error al guardar datos en BD #123 (Urgente!)');
      expect(resultado).toBe('fix-error-al-guardar-datos-en-bd-123-urgente');
    });

    it('debe retornar cadena vacía si la entrada es nula o indefinida', () => {
      expect(slugify(null)).toBe('');
      expect(slugify(undefined)).toBe('');
      expect(slugify('')).toBe('');
    });
  });

  describe('formatBranchName()', () => {
    it('debe formatear la rama con el formato estandarizado <type>/<id>-<slug>', () => {
      const branch = formatBranchName('feat', 'AGT-0002', 'Nueva funcionalidad CLI');
      expect(branch).toBe('feat/AGT-0002-nueva-funcionalidad-cli');
    });

    it('debe usar "feat" por defecto si no se especifica el tipo', () => {
      const branch = formatBranchName(null, 'AGT-0003', 'Tarea sin tipo');
      expect(branch).toBe('feat/AGT-0003-tarea-sin-tipo');
    });

    it('debe funcionar correctamente si no hay título', () => {
      const branch = formatBranchName('fix', 'AGT-0004', '');
      expect(branch).toBe('fix/AGT-0004');
    });
  });

  describe('Entorno Git real', () => {
    it('debe detectar que el directorio actual es un repositorio Git', () => {
      expect(isGitRepo()).toBe(true);
    });

    it('debe devolver una rama actual no vacía', () => {
      const currentBranch = getCurrentBranch();
      expect(typeof currentBranch).toBe('string');
      expect(currentBranch.length).toBeGreaterThan(0);
    });
  });
});
