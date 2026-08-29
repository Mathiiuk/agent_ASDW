# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): CI/CD CON GITHUB ACTIONS Y QUALITY GATES
# ==============================================================================

Feature: AGT-0006 - Implementacion Completa de CI/CD con GitHub Actions
  # Como ingeniero de DevOps y desarrollador
  # Quiero pipelines automatizados de CI/CD en GitHub Actions
  # Para validar Quality Gates, ejecutar pruebas en cada PR y automatizar releases

  Scenario: Project initialization includes CI/CD pipeline template
    Given an isolated project environment
    When the user creates a task with ID "AGT-9008", title "CI Pipeline Verification", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9008.yml" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9008.feature" should exist
