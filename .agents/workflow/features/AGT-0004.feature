# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): CONSOLIDACIÓN DE ARTEFACTOS DENTRO DE .AGENTS/
# ==============================================================================

Feature: AGT-0004 - Consolidacion de Artefactos y Plantillas dentro de .agents
  # Como desarrollador del proyecto
  # Quiero que todos los artefactos de workflow y plantillas residan en .agents/
  # Para mantener la raíz del repositorio limpia y organizada

  Scenario: Task generation places all artifacts inside .agents directory
    Given an isolated project environment
    When the user creates a task with ID "AGT-9006", title "Clean Root Structure", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9006.yml" should exist
    And the specification document ".agents/workflow/specs/AGT-9006.md" should exist
    And the implementation plan ".agents/workflow/plans/AGT-9006.md" should exist
    And the test plan ".agents/workflow/tests/AGT-9006.md" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9006.feature" should exist
