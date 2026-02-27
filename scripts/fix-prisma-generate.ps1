# Fix Prisma generate permission error
# This script removes the locked query engine file and regenerates Prisma client

$ErrorActionPreference = "Stop"

$PrismaOutputPath = "app\generated\prisma"
$LockedFile = Join-Path $PrismaOutputPath "query_engine-windows.dll.node"

Write-Host "Fixing Prisma generate permission error..." -ForegroundColor Cyan
Write-Host ""

# Check if the locked file exists
if (Test-Path $LockedFile) {
    Write-Host "Found locked file: $LockedFile" -ForegroundColor Yellow
    
    # Try to remove the file
    try {
        Remove-Item -Path $LockedFile -Force -ErrorAction Stop
        Write-Host "Successfully removed locked file." -ForegroundColor Green
    } catch {
        Write-Host "Warning: Could not remove file. It may be locked by a running process." -ForegroundColor Yellow
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please:" -ForegroundColor Cyan
        Write-Host "1. Stop any running Node.js dev servers (npm run dev, etc.)" -ForegroundColor White
        Write-Host "2. Close any IDEs or editors that might have the file open" -ForegroundColor White
        Write-Host "3. Try running this script again" -ForegroundColor White
        Write-Host ""
        Write-Host "Or manually delete the file:" -ForegroundColor Yellow
        Write-Host "  Remove-Item -Path '$LockedFile' -Force" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "Locked file not found. Checking for temp files..." -ForegroundColor Yellow
    
    # Check for temp files
    $TempFiles = Get-ChildItem -Path $PrismaOutputPath -Filter "*.tmp*" -ErrorAction SilentlyContinue
    if ($TempFiles) {
        Write-Host "Found temp files, removing..." -ForegroundColor Yellow
        $TempFiles | Remove-Item -Force
        Write-Host "Temp files removed." -ForegroundColor Green
    }
}

# Try to remove the entire directory and regenerate
Write-Host ""
Write-Host "Removing Prisma generated directory..." -ForegroundColor Yellow
if (Test-Path $PrismaOutputPath) {
    try {
        Remove-Item -Path $PrismaOutputPath -Recurse -Force -ErrorAction Stop
        Write-Host "Directory removed successfully." -ForegroundColor Green
    } catch {
        Write-Host "Warning: Could not remove directory completely." -ForegroundColor Yellow
        Write-Host "Some files may still be locked. Try stopping Node.js processes first." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Now run: npx prisma generate" -ForegroundColor Cyan
