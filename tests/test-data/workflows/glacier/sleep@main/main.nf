#!/usr/bin/env nextflow
nextflow.enable.dsl=2

// default if not provided
params.sleep_time = params.sleep_time ?: 5

process SLEEPER {
  debug true
  tag "sleep for ${sleep_time}s"

  input:
    val sleep_time

  script:
  """
  set -euo pipefail
  SLEEP_SECS=${sleep_time}   # Groovy puts 10 here

  echo "Sleeping for \${SLEEP_SECS} seconds..."
  for (( i=1; i<=\${SLEEP_SECS}; i++ )); do
    echo "  \$i..."
    sleep 1
  done
  echo "Done!"
  """
}

workflow {
  // pass params via a channel (convert to int to be safe)
  def sleep_ch = Channel.of(params.sleep_time as int)
  SLEEPER(sleep_ch)
}
