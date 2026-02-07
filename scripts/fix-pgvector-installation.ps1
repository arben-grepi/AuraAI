# Fix pgvector installation - move files from subfolder to correct PostgreSQL directories
# Run this script as Administrator

$ErrorActionPreference = "Stop"

$PostgreSQLPath = "C:\Program Files\PostgreSQL\17"
$SourceFolder = Join-Path $PostgreSQLPath "share\extension\vector.v0.8.1-pg17"

Write-Host "Fixing pgvector installation..." -ForegroundColor Cyan
Write-Host ""

# Check if source folder exists
if (-not (Test-Path $SourceFolder)) {
    Write-Host "Error: Source folder not found at: $SourceFolder" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL directories exist
$ExtensionPath = Join-Path $PostgreSQLPath "share\extension"
$LibPath = Join-Path $PostgreSQLPath "lib"
$IncludePath = Join-Path $PostgreSQLPath "include\server\extension"

if (-not (Test-Path $ExtensionPath)) {
    Write-Host "Error: Extension directory not found at: $ExtensionPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LibPath)) {
    Write-Host "Error: Lib directory not found at: $LibPath" -ForegroundColor Red
    exit 1
}

# Copy extension files (.sql, .control) to share/extension
Write-Host "Copying extension files to share\extension..." -ForegroundColor Yellow
$ExtensionSource = Join-Path $SourceFolder "share\extension"
if (Test-Path $ExtensionSource) {
    $ExtensionFiles = Get-ChildItem -Path $ExtensionSource -File
    foreach ($file in $ExtensionFiles) {
        $destPath = Join-Path $ExtensionPath $file.Name
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
    }
    Write-Host "  Extension files copied successfully." -ForegroundColor Green
} else {
    Write-Host "  Warning: Extension source folder not found." -ForegroundColor Yellow
}

# Copy DLL to lib directory
Write-Host "Copying DLL to lib directory..." -ForegroundColor Yellow
$LibSource = Join-Path $SourceFolder "lib\vector.dll"
if (Test-Path $LibSource) {
    $destPath = Join-Path $LibPath "vector.dll"
    Copy-Item -Path $LibSource -Destination $destPath -Force
    Write-Host "  Copied: vector.dll" -ForegroundColor Gray
    Write-Host "  DLL copied successfully." -ForegroundColor Green
} else {
    Write-Host "  Warning: vector.dll not found in lib folder." -ForegroundColor Yellow
}

# Copy header files (optional but recommended)
Write-Host "Copying header files to include directory..." -ForegroundColor Yellow
$IncludeSource = Join-Path $SourceFolder "include\server\extension\vector"
if (Test-Path $IncludeSource) {
    $IncludeDest = Join-Path $PostgreSQLPath "include\server\extension\vector"
    if (-not (Test-Path $IncludeDest)) {
        New-Item -ItemType Directory -Path $IncludeDest -Force | Out-Null
    }
    $HeaderFiles = Get-ChildItem -Path $IncludeSource -File
    foreach ($file in $HeaderFiles) {
        $destPath = Join-Path $IncludeDest $file.Name
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
    }
    Write-Host "  Header files copied successfully." -ForegroundColor Green
} else {
    Write-Host "  Warning: Header files not found (optional)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation fixed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Files have been moved to:" -ForegroundColor Cyan
Write-Host "  Extension files: $ExtensionPath" -ForegroundColor White
Write-Host "  DLL file: $LibPath\vector.dll" -ForegroundColor White
if (Test-Path $IncludeDest) {
    Write-Host "  Header files: $IncludeDest" -ForegroundColor White
}
Write-Host ""
Write-Host "You can now remove the source folder:" -ForegroundColor Yellow
Write-Host "  Remove-Item -Path '$SourceFolder' -Recurse -Force" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Connect to your PostgreSQL database" -ForegroundColor White
Write-Host "2. Run: CREATE EXTENSION IF NOT EXISTS vector;" -ForegroundColor White
Write-Host "3. Verify with: SELECT extname, extversion FROM pg_extension WHERE extname='vector';" -ForegroundColor White
