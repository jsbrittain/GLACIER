#!/usr/bin/env nextflow
nextflow.enable.dsl=2

process TIMEOUTER {
  debug true
  tag "timeout simulation"

  script:
  """
  echo "Simulating timeout: process killed (exit code 124)"
  exit 124
  """
}

workflow {
  TIMEOUTER()
}
