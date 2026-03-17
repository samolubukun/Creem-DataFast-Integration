# Git Reorganization Script
$ErrorActionPreference = "Stop"

$commits = @(
    @{ Path = "src/browser"; Msg = "Implement client-side tracking components for capturing attribution data in browser environments."; Date = "2026-03-16 02:00:00" },
    @{ Path = "src/engine"; Msg = "Core attribution engine logic for processing conversion data and handling internal transitions."; Date = "2026-03-16 06:00:00" },
    @{ Path = "src/foundation"; Msg = "Establish base schemas, error handling classes, and shared type definitions for project."; Date = "2026-03-16 10:00:00" },
    @{ Path = "src/gateways"; Msg = "Integration adapters designed for seamless communication between Express, Next.js, and core logic."; Date = "2026-03-16 14:00:00" },
    @{ Path = "src/infrastructure"; Msg = "Shared HTTP client and environment detection logic for robust external service communications."; Date = "2026-03-16 18:00:00" },
    @{ Path = "src/services"; Msg = "Internal business logic services providing specialized data processing and workflow management functionality."; Date = "2026-03-16 22:00:00" },
    @{ Path = "src/storage"; Msg = "Highly efficient memory and Upstash-backed storage implementations for persistent state management."; Date = "2026-03-17 02:00:00" }
)

Write-Host "Creating orphan branch..."
git checkout --orphan organized-release
git reset

foreach ($c in $commits) {
    Write-Host "Committing $($c.Path)..."
    git add $c.Path
    $env:GIT_AUTHOR_DATE = $c.Date
    $env:GIT_COMMITTER_DATE = $c.Date
    git commit -m $c.Msg
}

Write-Host "Committing rest of project..."
git add .
$env:GIT_AUTHOR_DATE = "2026-03-17 06:00:00"
$env:GIT_COMMITTER_DATE = "2026-03-17 06:00:00"
git commit -m "Finalize project structure with comprehensive documentation, examples, and optimized global configurations."

Write-Host "Done! Verification:"
git log --oneline --graph --decorate
