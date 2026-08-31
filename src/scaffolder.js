import fs from 'node:fs';
import path from 'node:path';

/**
 * Parsea un archivo .feature y genera un esqueleto de código para Cucumber (JS).
 * 
 * @param {string} taskId - Identificador de la tarea (ej: AGT-0001)
 * @param {string} projectRoot - Directorio raíz del proyecto
 * @returns {object} - Resultado de la operación con la ruta del archivo generado
 */
export function generateBddScaffold(taskId, projectRoot = process.cwd()) {
  if (!taskId) {
    throw new Error('El ID de la tarea es obligatorio para generar el scaffolding.');
  }

  const featurePath = path.join(projectRoot, '.agents', 'workflow', 'features', `${taskId}.feature`);
  
  if (!fs.existsSync(featurePath)) {
    return { success: false, message: `No se encontró el archivo feature: ${featurePath}` };
  }

  const content = fs.readFileSync(featurePath, 'utf-8');
  const lines = content.split('\n');

  // Regex para atrapar Given, When, Then, And, But
  const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.*)$/;
  const steps = new Set(); // Usamos un Set para evitar pasos duplicados

  for (const line of lines) {
    const match = line.match(stepRegex);
    if (match) {
      let keyword = match[1].trim();
      // 'And' y 'But' usualmente se mapean a la misma función anterior,
      // pero para el scaffolding los convertimos genéricamente a la importación base
      // (Cucumber permite usar Given/When/Then para cualquiera).
      if (keyword === 'And' || keyword === 'But') {
        keyword = 'Given'; // Por convención de import, aunque la keyword original está en el texto
      }
      
      const text = match[2].trim();
      
      // Sanitizar el texto para usarlo como string literal
      const sanitizedText = text.replace(/'/g, "\\'");
      
      steps.add({
        keyword,
        text: sanitizedText
      });
    }
  }

  if (steps.size === 0) {
    return { success: false, message: 'No se encontraron pasos (Given, When, Then) en el archivo feature.' };
  }

  // Generamos el código JS del esqueleto
  let jsCode = `import { Given, When, Then } from '@cucumber/cucumber';\nimport assert from 'node:assert';\n\n`;

  for (const step of steps) {
    // Usamos keyword base (Given, When, Then) en código real
    // (Por convención, si es And/But usamos Given o ignoramos la keyword estricta,
    //  aquí forzamos Given, When o Then basándonos en mapeos comunes).
    let importKw = ['Given', 'When', 'Then'].includes(step.keyword) ? step.keyword : 'Given';
    
    jsCode += `${importKw}('${step.text}', async function () {
  // TODO: Implementar el paso
  // throw new Error('Paso no implementado');
});\n\n`;
  }

  const stepsDir = path.join(projectRoot, 'tests', 'bdd', 'steps');
  if (!fs.existsSync(stepsDir)) {
    fs.mkdirSync(stepsDir, { recursive: true });
  }

  const outFilePath = path.join(stepsDir, `${taskId}.steps.js`);
  fs.writeFileSync(outFilePath, jsCode, 'utf-8');

  return {
    success: true,
    stepsCount: steps.size,
    filePath: outFilePath
  };
}
