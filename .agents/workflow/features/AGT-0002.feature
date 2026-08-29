# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): INTEGRACIÓN DE MOTOR BDD CON CUCUMBER Y GHERKIN
# ==============================================================================

Feature: AGT-0002 - Integracion de Motor BDD con Gherkin y Cucumber
  # Como desarrollador del agente de desarrollo
  # Quiero integrar Gherkin y Cucumber.js en el ciclo de vida del workflow
  # Para definir criterios de aceptación formales ejecutables como Quality Gates

  Scenario: Creating a task automatically includes a Gherkin .feature template
    Given an isolated project environment
    When the user creates a task with ID "AGT-9003", title "BDD Feature Generation", and type "feat"
    Then the Gherkin feature file ".agents/workflow/features/AGT-9003.feature" should exist
    And the task manifest ".agents/workflow/tasks/AGT-9003.yml" should exist

  Scenario: BDD tests Quality Gate is enabled by default in task manifests
    Given an isolated project environment
    When the user creates a task with ID "AGT-9004", title "Quality Gate Check", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9004.yml" should exist
