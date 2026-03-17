# Robust Cherry-pick Script
$ErrorActionPreference = "Continue" # Don't stop on git error

$hashes = @("6a916ca", "35c5334", "a76067a", "b4bde92", "f42805e", "3b390a1", "0dca7d8", "158574b")

# Ensure we are currently in the middle of a cherry-pick or start clean
git cherry-pick --abort 2>$null

Write-Host "Resetting to bc4d127..."
git reset --hard bc4d127

foreach ($h in $hashes) {
    Write-Host "Cherry-picking $h..."
    git cherry-pick $h
    
    # Check if there was a conflict
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Conflict detected in $h, resolving in favor of cherry-pick (theirs)..."
        git checkout --theirs .
        git add .
        $env:GIT_EDITOR = "true" # Prevents editor from opening
        git cherry-pick --continue
    }
}

Write-Host "Done! History on master:"
git log --oneline -n 12
