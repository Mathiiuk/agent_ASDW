# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): FLUJO DE TAREAS Y RAMAS GIT DEL AGENTE
# ==============================================================================
# Este archivo define los criterios de aceptación formales para la creación
# y gestión de tareas en el ecosistema del agente de desarrollo.
# ==============================================================================

Feature: Task Lifecycle and Git Branch Automation
  # Como desarrollador del proyecto
  # Quiero utilizar el CLI del agente para crear tareas estructuradas
  # Para que se generen automáticamente los artefactos de workflow y las ramas Git

  # ----------------------------------------------------------------------------
  # Escenario 1: Creación exitosa de tarea y sus 5 artefactos de workflow
  # ----------------------------------------------------------------------------
  Scenario: Creating a new task generates all workflow artifacts and branch
    Given an isolated project environment
    When the user creates a task with ID "AGT-9001", title "OAuth Authentication Flow", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9001.yml" should exist
    And the specification document ".agents/workflow/specs/AGT-9001.md" should exist
    And the implementation plan ".agents/workflow/plans/AGT-9001.md" should exist
    And the test plan ".agents/workflow/tests/AGT-9001.md" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9001.feature" should exist

  # ----------------------------------------------------------------------------
  # Escenario 2: Validación de datos obligatorios al crear tarea
  # ----------------------------------------------------------------------------
  Scenario: Creating a task without required fields fails gracefully
    Given an isolated project environment
    When the user attempts to create a task without an ID
    Then the task creation should fail with an error stating the ID is mandatory

  # ----------------------------------------------------------------------------
  # Escenario 3: Consulta y actualización del estado de una tarea
  # ----------------------------------------------------------------------------
  Scenario: Updating task status reflects in the YAML manifest
    Given a task "AGT-9002" with initial status "PLANNED"
    When the task status is updated to "IN_PROGRESS"
    Then the task manifest should reflect the new status "IN_PROGRESS"
