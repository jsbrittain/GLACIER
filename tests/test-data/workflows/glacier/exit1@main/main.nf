#!/usr/bin/env nextflow
nextflow.enable.dsl=2

process FAILER {
  debug true
  tag "always fails"

  script:
  """
  echo "This process will exit with code 1"
  exit 1
  """
}

workflow {
  FAILER()
}
