@echo off
REM Fix pgvector installation - Run as Administrator
REM Right-click this file and select "Run as administrator"

echo Fixing pgvector installation...
echo.

set "PG_PATH=C:\Program Files\PostgreSQL\17"
set "SOURCE=%PG_PATH%\share\extension\vector.v0.8.1-pg17"

REM Copy extension files
echo Copying extension files...
xcopy /Y /E "%SOURCE%\share\extension\*" "%PG_PATH%\share\extension\"

REM Copy DLL
echo Copying DLL...
copy /Y "%SOURCE%\lib\vector.dll" "%PG_PATH%\lib\"

REM Copy header files (optional)
echo Copying header files...
if not exist "%PG_PATH%\include\server\extension\vector" mkdir "%PG_PATH%\include\server\extension\vector"
xcopy /Y /E "%SOURCE%\include\server\extension\vector\*" "%PG_PATH%\include\server\extension\vector\"

echo.
echo Installation fixed!
echo.
echo Next steps:
echo 1. Connect to your PostgreSQL database
echo 2. Run: CREATE EXTENSION IF NOT EXISTS vector;
echo 3. Verify with: SELECT extname, extversion FROM pg_extension WHERE extname='vector';
echo.
pause
