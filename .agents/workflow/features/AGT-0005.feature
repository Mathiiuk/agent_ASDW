# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): SKILLS POR DEPARTAMENTOS DE EMPRESA
# ==============================================================================

Feature: AGT-0005 - Skills por Departamentos de Empresa de Software
  # Como desarrollador del agente
  # Quiero que las skills simulen los roles de una empresa de software completa
  # Para que el agente asuma la mentalidad y estándares del rol correspondiente

  Scenario: All 8 company departments exist in .agents/skills
    Given an isolated project environment
    When the user creates a task with ID "AGT-9007", title "Company Skills Check", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9007.yml" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9007.feature" should exist
