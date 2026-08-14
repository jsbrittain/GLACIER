// Resolve the default Nextflow execution profile from the set of profiles
// defined in a workflow's nextflow.config. GLACIER is a Docker/Nextflow
// orchestrator, so prefer a `docker` profile when the workflow defines one;
// otherwise fall back to Nextflow's implicit `standard` profile, then the
// first available profile.
export const defaultProfileFrom = (profiles: string[]): string => {
  if (profiles.includes('docker')) return 'docker';
  if (profiles.includes('standard')) return 'standard';
  return profiles[0] || 'standard';
};
