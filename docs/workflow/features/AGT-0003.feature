# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): BUCLE AUTÓNOMO Y SELF-HEALING RUNNER
# ==============================================================================

Feature: AGT-0003 - Self-Healing Loop and Autonomous Task Execution
  # Como desarrollador del agente
  # Quiero un ejecutor de bucle cerrado
  # Para diagnosticar fallos y generar reportes automáticamente hasta tener 100% verde

  Scenario: Autonomous loop executes and produces execution report
    Given an isolated project environment
    When the user creates a task with ID "AGT-9005", title "Self Healing Verification", and type "feat"
    Then the task manifest "docs/workflow/tasks/AGT-9005.yml" should exist
    And the Gherkin feature file "docs/workflow/features/AGT-9005.feature" should exist
