# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): MEMORIA GRAPHIFY Y AHORRO DE TOKENS
# ==============================================================================

Feature: AGT-0007 - Memoria Graphify para Ahorro de Tokens y Aprendizaje
  # Como desarrollador y asistente de IA
  # Quiero un grafo de conocimiento y memoria persistente
  # Para entender el contexto del proyecto en pocos tokens y evitar errores previos

  Scenario: Building knowledge graph generates context and dependency graph
    Given an isolated project environment
    When the user creates a task with ID "AGT-9009", title "Knowledge Graph Test", and type "feat"
    Then the task manifest ".agents/workflow/tasks/AGT-9009.yml" should exist
    And the Gherkin feature file ".agents/workflow/features/AGT-9009.feature" should exist
