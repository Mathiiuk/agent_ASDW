# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): FIX COMPATIBILIDAD PNPM V11 CON NODE 22+
# ==============================================================================

Feature: AGT-0008 - Compatibilidad de pnpm v11 en GitHub Actions
  # Como ingeniero de DevOps
  # Quiero que los workflows de CI/CD utilicen Node 22 y 24
  # Para asegurar compatibilidad nativa con pnpm v11 y el módulo node:sqlite

  Scenario: CI/CD configurations enforce Node 22 and 24
    Given an isolated project environment
    When the user creates a task with ID "AGT-9010", title "Node Version Verification", and type "fix"
    Then the task manifest ".agents/workflow/tasks/AGT-9010.yml" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9010.feature" should exist
