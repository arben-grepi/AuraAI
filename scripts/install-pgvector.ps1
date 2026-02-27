# Install pgvector extension for PostgreSQL 17 on Windows
# This script downloads and installs the pre-built pgvector binary

$ErrorActionPreference = "Stop"

# Configuration
$PostgreSQLPath = "C:\Program Files\PostgreSQL\17"
$ExtensionPath = Join-Path $PostgreSQLPath "share\extension"
$DownloadUrl = "https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/0.8.1_17.6/pgvector-0.8.1-pg17-windows-x64.zip"
$TempZip = Join-Path $env:TEMP "pgvector.zip"
$TempExtract = Join-Path $env:TEMP "pgvector-extract"

Write-Host "Installing pgvector extension for PostgreSQL 17..." -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL path exists
if (-not (Test-Path $PostgreSQLPath)) {
    Write-Host "Error: PostgreSQL installation not found at: $PostgreSQLPath" -ForegroundColor Red
    Write-Host "Please update the `$PostgreSQLPath variable in this script to match your installation." -ForegroundColor Yellow
    exit 1
}

# Check if extension directory exists
if (-not (Test-Path $ExtensionPath)) {
    Write-Host "Error: Extension directory not found at: $ExtensionPath" -ForegroundColor Red
    exit 1
}

# Download the zip file
Write-Host "Downloading pgvector binary..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing
    Write-Host "Download completed." -ForegroundColor Green
} catch {
    Write-Host "Error downloading pgvector: $_" -ForegroundColor Red
    Write-Host "Please download manually from: https://github.com/andreiramani/pgvector_pgsql_windows/releases/tag/0.8.1_17.6" -ForegroundColor Yellow
    exit 1
}

# Extract the zip file
Write-Host "Extracting files..." -ForegroundColor Yellow
if (Test-Path $TempExtract) {
    Remove-Item $TempExtract -Recurse -Force
}
Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force

# Find the extension files (they might be in a subdirectory)
$ExtractedFiles = Get-ChildItem -Path $TempExtract -Recurse -File
$ExtensionFiles = $ExtractedFiles | Where-Object { $_.Extension -in @('.sql', '.control', '.dll') }

if ($ExtensionFiles.Count -eq 0) {
    Write-Host "Error: No extension files found in the downloaded archive." -ForegroundColor Red
    exit 1
}

# Copy files to PostgreSQL extension directory
Write-Host "Copying files to PostgreSQL extension directory..." -ForegroundColor Yellow
foreach ($file in $ExtensionFiles) {
    $destPath = Join-Path $ExtensionPath $file.Name
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
}

# Cleanup
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
Remove-Item $TempExtract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Connect to your PostgreSQL database" -ForegroundColor White
Write-Host "2. Run: CREATE EXTENSION IF NOT EXISTS vector;" -ForegroundColor White
Write-Host "3. Verify with: SELECT extname, extversion FROM pg_extension WHERE extname='vector';" -ForegroundColor White
Write-Host ""
Write-Host "Then you can run your Prisma migration again:" -ForegroundColor Cyan
Write-Host "  npx prisma migrate deploy" -ForegroundColor White
