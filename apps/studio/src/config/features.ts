/**
 * Feature Flags - Controla funcionalidades que dependem de migrations
 * 
 *  IMPORTANTE: Estas features requerem migrations aplicadas no Supabase
 * Ver APPLY_MIGRATIONS.md para instruções
 */

export const FEATURES = {
  /**
   * Versionamento de Projetos
   * Requer: tabela project_versions (migration 20260127000001)
   * Status: DESABILITADO até migration ser aplicada
   */
  ENABLE_VERSIONING: false,

  /**
   * Detecção de Conflitos
   * Requer: tabela conflict_resolutions (migration 20260127000002)
   * Status: DESABILITADO até migration ser aplicada
   */
  ENABLE_CONFLICT_DETECTION: false,

  /**
   * Logs de Atividade
   * Requer: tabela activity_logs (migration 20260127000002)
   * Status: DESABILITADO até migration ser aplicada
   */
  ENABLE_ACTIVITY_LOGS: false,
};

/**
 * Habilitar todas as features após aplicar migrations:
 * 1. Aplicar migrations (ver APPLY_MIGRATIONS.md)
 * 2. Mudar todos os flags acima para true
 * 3. Commitar e dar push
 */
