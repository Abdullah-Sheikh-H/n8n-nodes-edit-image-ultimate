#!/usr/bin/env pwsh
# ============================================================
#  publish.ps1  —  n8n-nodes-edit-image-pro publish script
#  Usage:
#    .\publish.ps1              # patch bump  (0.2.0 -> 0.2.1)
#    .\publish.ps1 -Bump minor  # minor bump  (0.2.0 -> 0.3.0)
#    .\publish.ps1 -Bump major  # major bump  (0.2.0 -> 1.0.0)
#    .\publish.ps1 -DryRun      # simulate publish, nothing uploaded
#    .\publish.ps1 -SkipLogin   # skip npm login (already logged in)
# ============================================================
param(
    [ValidateSet('patch','minor','major')]
    [string]$Bump = 'patch',

    [switch]$DryRun,

    [switch]$SkipLogin
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── helpers ─────────────────────────────────────────────────
function Write-Step([string]$msg) {
    Write-Host "`n▶  $msg" -ForegroundColor Cyan
}
function Write-Success([string]$msg) {
    Write-Host "✅  $msg" -ForegroundColor Green
}
function Write-Fail([string]$msg) {
    Write-Host "❌  $msg" -ForegroundColor Red
    exit 1
}

# ── 0. Dry-run banner ────────────────────────────────────────
if ($DryRun) {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║         DRY RUN — nothing published       ║" -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Yellow
}

# ── 1. Check Node + npm ──────────────────────────────────────
Write-Step "Checking environment..."
$nodeVer = node --version 2>&1
$npmVer  = npm --version  2>&1
Write-Host "  Node: $nodeVer  |  npm: $npmVer"
if ($LASTEXITCODE -ne 0) { Write-Fail "Node.js is not installed or not in PATH" }
Write-Success "Environment OK"

# ── 2. npm login ─────────────────────────────────────────────
if (-not $SkipLogin) {
    Write-Step "Logging into npm..."
    Write-Host "  (A browser window or OTP prompt will appear)"
    npm login
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm login failed" }
    Write-Success "Logged in"
} else {
    Write-Step "Skipping npm login (--SkipLogin flag set)"
    $whoami = npm whoami 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Fail "Not logged in to npm. Run without -SkipLogin." }
    Write-Success "Already logged in as: $whoami"
}

# ── 3. Clean old build ───────────────────────────────────────
Write-Step "Cleaning previous build..."
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
Write-Success "dist/ cleaned"

# ── 4. Install dependencies ──────────────────────────────────
Write-Step "Installing dependencies..."
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }
Write-Success "Dependencies installed"

# ── 5. Build (TypeScript + icons) ───────────────────────────
Write-Step "Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build failed — fix TypeScript errors above" }
Write-Success "Build succeeded"

# ── 6. Verify dist contents ──────────────────────────────────
Write-Step "Verifying dist output..."
$nodeJs = "dist/nodes/EditImagePlus/EditImagePlus.node.js"
if (-not (Test-Path $nodeJs)) { Write-Fail "Missing compiled file: $nodeJs" }
Write-Success "dist/ looks correct"

# ── 7. Version bump ──────────────────────────────────────────
Write-Step "Bumping version ($Bump)..."
$oldVer = (Get-Content package.json | ConvertFrom-Json).version
npm version $Bump --no-git-tag-version
if ($LASTEXITCODE -ne 0) { Write-Fail "npm version bump failed" }
$newVer = (Get-Content package.json | ConvertFrom-Json).version
Write-Success "Version: $oldVer → $newVer"

# ── 8. Preview what will be published ────────────────────────
Write-Step "Package contents preview:"
npm pack --dry-run 2>&1 | ForEach-Object { Write-Host "  $_" }

# ── 9. Publish (or dry-run) ──────────────────────────────────
Write-Step "Publishing to npm..."
if ($DryRun) {
    Write-Host "  DRY RUN: would publish n8n-nodes-edit-image-pro@$newVer" -ForegroundColor Yellow
    npm pack  # creates a local .tgz for inspection
    Write-Host ""
    Write-Host "  Tarball created locally. Inspect it with:" -ForegroundColor Yellow
    Write-Host "  tar tzf n8n-nodes-edit-image-pro-$newVer.tgz" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Reverting version bump (dry-run only)..." -ForegroundColor Yellow
    npm version $oldVer --no-git-tag-version | Out-Null
} else {
    npm publish --access public
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm publish failed" }

    # ── 10. Git tag + commit ─────────────────────────────────
    Write-Step "Creating git tag v$newVer..."
    git add package.json package-lock.json
    git commit -m "chore: release v$newVer"
    git tag "v$newVer"
    Write-Success "Git tag v$newVer created"

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║   🎉  Published n8n-nodes-edit-image-pro@$newVer to npm  ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  npm page : https://www.npmjs.com/package/n8n-nodes-edit-image-pro" -ForegroundColor Cyan
    Write-Host "  Push tags: git push origin master --tags" -ForegroundColor Cyan
    Write-Host ""
}
