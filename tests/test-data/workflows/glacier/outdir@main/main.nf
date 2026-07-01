#!/usr/bin/env nextflow
nextflow.enable.dsl=2

params.outdir = "./results"

process WRITE_OUTPUT {
    publishDir "${params.outdir}", mode: 'copy'

    output:
    path "output.txt"

    script:
    """
    echo "output from ${params.message}" > output.txt
    """
}

process WRITE_REPORT {
    publishDir "${params.outdir}", mode: 'copy'

    output:
    path "report.html"

    script:
    """
    cat > report.html << EOF
<html>
<body>
<h1>Test Report</h1>
<p>Instance: ${params.message}</p>
</body>
</html>
EOF
    """
}

workflow {
    WRITE_OUTPUT()
    WRITE_REPORT()
}
