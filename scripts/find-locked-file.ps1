# Find which process is locking the Prisma query engine file
# Requires running as Administrator for full functionality

$ErrorActionPreference = "Stop"

$LockedFile = "C:\Users\ledio\Documents\GitHub\ai-chat\app\generated\prisma\query_engine-windows.dll.node"

Write-Host "Finding processes locking the file..." -ForegroundColor Cyan
Write-Host "File: $LockedFile" -ForegroundColor Yellow
Write-Host ""

# Method 1: Use openfiles (requires admin)
Write-Host "Method 1: Checking with openfiles (requires admin)..." -ForegroundColor Yellow
try {
    $result = openfiles /query /fo csv | ConvertFrom-Csv -ErrorAction SilentlyContinue
    $locked = $result | Where-Object { $_.'Accessed By' -like "*query_engine*" -or $_.'Files' -like "*query_engine*" }
    if ($locked) {
        Write-Host "Found processes:" -ForegroundColor Green
        $locked | Format-Table -AutoSize
    } else {
        Write-Host "No matches found with openfiles." -ForegroundColor Yellow
    }
} catch {
    Write-Host "openfiles requires Administrator privileges. Trying alternative method..." -ForegroundColor Yellow
}

# Method 2: Check Node.js processes
Write-Host ""
Write-Host "Method 2: Checking Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es):" -ForegroundColor Yellow
    $nodeProcesses | Select-Object Id, ProcessName, Path, StartTime | Format-Table -AutoSize
    
    Write-Host ""
    Write-Host "To stop all Node.js processes, run:" -ForegroundColor Cyan
    Write-Host "  Stop-Process -Name node -Force" -ForegroundColor White
    Write-Host ""
    Write-Host "Or stop specific processes by ID:" -ForegroundColor Cyan
    foreach ($proc in $nodeProcesses) {
        Write-Host "  Stop-Process -Id $($proc.Id) -Force" -ForegroundColor Gray
    }
} else {
    Write-Host "No Node.js processes found." -ForegroundColor Green
}

# Method 3: Try to get file handle info (requires Handle.exe from Sysinternals)
Write-Host ""
Write-Host "Method 3: For detailed file handle information:" -ForegroundColor Yellow
Write-Host "Download Handle.exe from: https://learn.microsoft.com/en-us/sysinternals/downloads/handle" -ForegroundColor Cyan
Write-Host "Then run: handle.exe query_engine-windows.dll.node" -ForegroundColor White

Write-Host ""
Write-Host "Alternative solution: Rename the file instead of deleting it" -ForegroundColor Cyan
Write-Host "  Rename-Item -Path '$LockedFile' -NewName 'query_engine-windows.dll.node.old' -Force" -ForegroundColor White
