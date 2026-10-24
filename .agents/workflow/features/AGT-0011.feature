# ==============================================================================
# ESPECIFICACIÓN BDD (GHERKIN): MODO DE DESARROLLO POR FASES
# ==============================================================================
# Flujo: feat + check → siguiente feat; bug en check → fix;
# healthcheck final; bug en healthcheck → hotfix; todo en docs/bitacora/.
# ==============================================================================

Feature: AGT-0011 - Modo de desarrollo por fases con healthcheck y bitacora
  # Como líder técnico
  # Quiero desarrollar un plan en fases con un check por cada feat
  # Para detectar bugs temprano y dejar trazabilidad completa en una bitácora

  Background:
    Given a phased plan "PLAN-BDD" with phases "BDD-0001:Login" and "BDD-0002:Dashboard"

  Scenario: Passing checks advance through every feat until the healthcheck
    When the phase check passes
    Then the current phase should be "BDD-0002"
    When the phase check passes
    Then the phased plan status should be "HEALTHCHECK"
    When the final healthcheck passes
    Then the phased plan status should be "COMPLETED"
    And the phased mode should be inactive
    And the log "docs/bitacora/PLAN-BDD.md" should mention "HEALTHCHECK_PASS"

  Scenario: A failing phase check opens a fix task
    When the phase check fails
    Then a "fix" task "BDD-0001-FIX-1" should exist
    And the current phase should be "BDD-0001"
    And the log "docs/bitacora/PLAN-BDD.md" should mention "FIX_CREATED"

  Scenario: A failing final healthcheck opens a hotfix task
    When the phase check passes
    And the phase check passes
    And the final healthcheck fails
    Then a "hotfix" task "PLAN-BDD-HOTFIX-1" should exist
    And the phased plan status should be "HOTFIX_REQUIRED"
