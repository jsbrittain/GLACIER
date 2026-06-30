#!/usr/bin/env nextflow
nextflow.enable.dsl=2

process OOMER {
  debug true
  tag "oom simulation"

  script:
  """
  echo "Simulating out-of-memory error: process killed (exit code 137)"
  exit 137
  """
}

workflow {
  OOMER()
}
