@echo off
setlocal enabledelayedexpansion

:: ---------------------------------------------------------------------------
::  Alchemy League Map Downloader — Desktop Extract Edition
:: ---------------------------------------------------------------------------
::
::  SAFETY:
::  - The AoE2 installation must exist.
::  - resources\_common\random-map-scripts must exist.
::  - DEST_PATH must resolve to the exact expected Alchemy map directory.
::  - If DEST_PATH does not exist, only that exact directory is created.
::  - Deletion is performed only after all destination safety checks pass.
::  - A drive root or empty/unresolved destination always aborts the script.
::
::  FIX (this version):
::  - AOE2_PATH is now normalized to a canonical backslash path as soon as
::    it is validated (via %%~fC), regardless of whether it came from the
::    registry or from Steam's libraryfolders.vdf (which can contain "/"
::    or mixed separators). This prevents DEST_PATH / EXPECTED_DEST from
::    ending up with mixed slashes, which previously caused the final
::    %%~fD-normalized comparison in :delete_old_files to fail and abort
::    with "SAFETY ABORT: deletion target is not the expected Alchemy
::    map directory." even though the folder was correct.
:: ---------------------------------------------------------------------------

set "TARGET_FOLDER=resources\_common\random-map-scripts\Current_Alchemy_League_Maps_DO_NOT_DISTRIBUTE"
set "BASE_URL=https://raw.githubusercontent.com/Alchemy-AOE-Community/Alchemy-AOE-Community.github.io/main/site/resources"
set "ABOUT_URL=https://raw.githubusercontent.com/f-istvan/aoe2-Custom-Map-Downloader/main/about.txt"

goto :main

:: ---------------------------------------------------------------------------
:: FATAL ERROR HANDLER
:: ---------------------------------------------------------------------------

:die
echo.
echo ======================================================
echo  ERROR: %*
echo  Aborting for safety.
echo ======================================================
echo.
pause
exit /b 1


:: ---------------------------------------------------------------------------
:: MAIN
:: ---------------------------------------------------------------------------

:main
echo Alchemy League Map Downloader - Desktop Extract Edition
echo.

if defined AOE2_PATH (
    :: Normalize even a user-supplied AOE2_PATH env var for consistency.
    for %%C in ("!AOE2_PATH!") do set "AOE2_PATH=%%~fC"
    set "DEST_PATH=!AOE2_PATH!\!TARGET_FOLDER!"
) else (
    call :find_aoe_path
    if errorlevel 1 exit /b 1
)

:: Validate AoE2 installation and safely create destination if necessary.
call :prepare_dest_path
if errorlevel 1 exit /b 1

:: Delete only after destination has passed all safety checks.
call :delete_old_files
if errorlevel 1 exit /b 1

call :open_maps_folder
if errorlevel 1 exit /b 1

call :download_and_extract_maps
if errorlevel 1 exit /b 1

call :download_about
if errorlevel 1 exit /b 1

echo.
echo ======================================================
echo  Done. Maps installed successfully.
echo ======================================================
echo.
echo Location:
echo !DEST_PATH!
echo.
pause
exit /b 0


:: ---------------------------------------------------------------------------
:: FIND AOE2 INSTALLATION
:: ---------------------------------------------------------------------------

:find_aoe_path

set "AOE2_PATH="
set "STEAM_PATH="

echo Searching for Age of Empires II: Definitive Edition...
echo.

:: ---------------------------------------------------------------------------
:: 1. Steam uninstall registry entry
::    Check both normal and WOW6432Node locations.
:: ---------------------------------------------------------------------------

for %%R in (
    "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App 813780"
    "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Steam App 813780"
    "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App 813780"
) do (
    if not defined AOE2_PATH (
        for /f "tokens=2,*" %%A in ('reg query %%R /v InstallLocation 2^>nul ^| find /i "InstallLocation"') do (
            call :validate_aoe_path "%%B"
        )
    )
)

if defined AOE2_PATH goto :aoe_found


:: ---------------------------------------------------------------------------
:: 2. Find Steam installation
:: ---------------------------------------------------------------------------

for %%R in (
    "HKCU\Software\Valve\Steam"
    "HKLM\SOFTWARE\Valve\Steam"
    "HKLM\SOFTWARE\WOW6432Node\Valve\Steam"
) do (
    if not defined STEAM_PATH (
        for /f "tokens=2,*" %%A in ('reg query %%R /v SteamPath 2^>nul ^| find /i "SteamPath"') do (
            set "STEAM_PATH=%%B"
        )
    )

    if not defined STEAM_PATH (
        for /f "tokens=2,*" %%A in ('reg query %%R /v InstallPath 2^>nul ^| find /i "InstallPath"') do (
            set "STEAM_PATH=%%B"
        )
    )
)


:: ---------------------------------------------------------------------------
:: 3. Check Steam's default library
:: ---------------------------------------------------------------------------

if defined STEAM_PATH (
    call :validate_aoe_path "!STEAM_PATH!\steamapps\common\AoE2DE"
)

if defined AOE2_PATH goto :aoe_found


:: ---------------------------------------------------------------------------
:: 4. Search all Steam libraries from libraryfolders.vdf
:: ---------------------------------------------------------------------------

if defined STEAM_PATH (
    set "LIBRARY_FILE=!STEAM_PATH!\steamapps\libraryfolders.vdf"

    if exist "!LIBRARY_FILE!" (
        echo Searching Steam libraries...
        echo.

        for /f "tokens=1,2" %%A in ('findstr /r /c:"^[\xEF\xBB\xBF \t]*\"path\"" "!LIBRARY_FILE!" 2^>nul') do (
            if not defined AOE2_PATH (
                set "LIBRARY_PATH=%%B"

                :: Remove quotes from the VDF value.
                set "LIBRARY_PATH=!LIBRARY_PATH:"=!"

                :: Steam VDF uses escaped backslashes.
                set "LIBRARY_PATH=!LIBRARY_PATH:\\=\!"

                echo Checking:
                echo   !LIBRARY_PATH!\steamapps\common\AoE2DE

                call :validate_aoe_path "!LIBRARY_PATH!\steamapps\common\AoE2DE"
            )
        )
    )
)

if defined AOE2_PATH goto :aoe_found


:: ---------------------------------------------------------------------------
:: 5. Microsoft Store / Xbox installation
:: ---------------------------------------------------------------------------

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$pkg = Get-AppxPackage -Name 'Microsoft.MSPhoenix' -ErrorAction SilentlyContinue; " ^
    "if ($pkg) { $pkg.InstallLocation }"`) do (
    if not defined AOE2_PATH (
        call :validate_aoe_path "%%I"
    )
)

if defined AOE2_PATH goto :aoe_found


:: ---------------------------------------------------------------------------
:: Nothing found
:: ---------------------------------------------------------------------------

call :die "Could not locate AoE2DE installation."
exit /b 1


:: ---------------------------------------------------------------------------
:: INSTALLATION FOUND
:: ---------------------------------------------------------------------------

:aoe_found

set "DEST_PATH=!AOE2_PATH!\!TARGET_FOLDER!"

echo Found AoE2DE:
echo   !AOE2_PATH!
echo.

exit /b 0


:: ---------------------------------------------------------------------------
:: VALIDATE AOE2 INSTALLATION PATH
::
:: %~1 = candidate installation directory
::
:: NOTE: AOE2_PATH is normalized here with %%~fC so that regardless of the
:: source (registry value, Steam libraryfolders.vdf with "/" separators,
:: PowerShell output, etc.) it always ends up as a clean, fully-qualified
:: backslash path. This keeps it consistent with the %%~fD-normalized
:: comparisons used later in :delete_old_files.
:: ---------------------------------------------------------------------------

:validate_aoe_path

set "CANDIDATE=%~1"

if not defined CANDIDATE exit /b 1
if not exist "!CANDIDATE!\" exit /b 1

:: AoE2DE Steam installs normally contain AoE2DE_s.exe.
:: Add/change additional checks here if Microsoft Store differs.
if exist "!CANDIDATE!\AoE2DE_s.exe" (
    for %%C in ("!CANDIDATE!") do set "AOE2_PATH=%%~fC"
    exit /b 0
)

:: Fallback validation using characteristic game directories.
if exist "!CANDIDATE!\resources\" (
    if exist "!CANDIDATE!\widgetui\" (
        for %%C in ("!CANDIDATE!") do set "AOE2_PATH=%%~fC"
        exit /b 0
    )
)

exit /b 1



:: ---------------------------------------------------------------------------
:: PREPARE AND VALIDATE DESTINATION
::
:: The destination itself may be missing.
::
:: The parent directory MUST exist:
::
::   AoE2DE
::     \resources
::       \_common
::         \random-map-scripts       <-- MUST EXIST
::           \Current_Alchemy...     <-- may be created
::
:: This prevents a malformed/empty path from causing mkdir/del to operate
:: somewhere dangerous.
:: ---------------------------------------------------------------------------

:prepare_dest_path

if not defined AOE2_PATH (
    call :die "AOE2_PATH is not set."
    exit /b 1
)

if "!AOE2_PATH!"=="" (
    call :die "AOE2_PATH is empty."
    exit /b 1
)

if not exist "!AOE2_PATH!\" (
    call :die "AoE2 installation directory does not exist: !AOE2_PATH!"
    exit /b 1
)

set "MAP_PARENT=!AOE2_PATH!\resources\_common\random-map-scripts"
set "EXPECTED_DEST=!MAP_PARENT!\Current_Alchemy_League_Maps_DO_NOT_DISTRIBUTE"

:: The known AoE2 map-script directory MUST already exist.
if not exist "!MAP_PARENT!\" (
    call :die "Expected AoE2 random-map-scripts directory does not exist: !MAP_PARENT!"
    exit /b 1
)

:: DEST_PATH must match the expected location exactly.
if /i not "!DEST_PATH!"=="!EXPECTED_DEST!" (
    call :die "Safety check failed: destination is not the expected AoE2 map directory."
    exit /b 1
)

:: Resolve the destination to an absolute path.
for %%D in ("!DEST_PATH!") do set "DEST_FULL=%%~fD"

if not defined DEST_FULL (
    call :die "Safety check failed: could not resolve destination path."
    exit /b 1
)

if "!DEST_FULL!"=="" (
    call :die "Safety check failed: resolved destination path is empty."
    exit /b 1
)

:: Never allow the destination to be a drive root.
for %%D in ("!DEST_FULL!") do (
    if "%%~dD\"=="%%~fD" (
        call :die "Safety check failed: destination is a drive root."
        exit /b 1
    )
)

:: If the destination folder was deleted, safely recreate ONLY this folder.
if not exist "!DEST_PATH!\" (
    echo Destination folder not found. Creating it...
    mkdir "!DEST_PATH!" 2>nul

    if not exist "!DEST_PATH!\" (
        call :die "Could not create destination directory: !DEST_PATH!"
        exit /b 1
    )
)

:: Final existence check.
if not exist "!DEST_PATH!\" (
    call :die "Safety check failed: destination directory does not exist."
    exit /b 1
)

echo Destination validated:
echo   !DEST_PATH!
echo.

exit /b 0


:: ---------------------------------------------------------------------------
:: OPEN MAPS FOLDER
:: ---------------------------------------------------------------------------

:open_maps_folder

if not exist "!DEST_PATH!\" (
    call :die "Destination directory disappeared: !DEST_PATH!"
    exit /b 1
)

start "" explorer "!DEST_PATH!\.."

exit /b 0


:: ---------------------------------------------------------------------------
:: DELETE OLD MAP FILES
::
:: Defense-in-depth: repeat the critical checks immediately before deletion.
:: ---------------------------------------------------------------------------

:delete_old_files

if not defined DEST_PATH (
    call :die "Safety check failed: DEST_PATH is undefined before deletion."
    exit /b 1
)

if "!DEST_PATH!"=="" (
    call :die "Safety check failed: DEST_PATH is empty before deletion."
    exit /b 1
)

if not exist "!DEST_PATH!\" (
    call :die "Safety check failed: destination does not exist before deletion."
    exit /b 1
)

set "DELETE_CHECK="
for %%D in ("!DEST_PATH!") do set "DELETE_CHECK=%%~fD"

if not defined DELETE_CHECK (
    call :die "Safety check failed: could not resolve deletion path."
    exit /b 1
)

if "!DELETE_CHECK!"=="" (
    call :die "Safety check failed: resolved deletion path is empty."
    exit /b 1
)

:: Verify again that this is not a drive root.
for %%D in ("!DELETE_CHECK!") do (
    if "%%~dD\"=="%%~fD" (
        call :die "SAFETY ABORT: deletion target is a drive root."
        exit /b 1
    )
)

:: Verify the deletion target is still EXACTLY the expected directory.
if /i not "!DELETE_CHECK!"=="!EXPECTED_DEST!" (
    call :die "SAFETY ABORT: deletion target is not the expected Alchemy map directory."
    exit /b 1
)

echo Removing previous Alchemy League map files...

del /q "!DEST_PATH!\*.rms" 2>nul
del /q "!DEST_PATH!\*.rms2" 2>nul
del /q "!DEST_PATH!\*.png" 2>nul
del /q "!DEST_PATH!\about.txt" 2>nul

echo Old map files removed.
echo.

exit /b 0


:: ---------------------------------------------------------------------------
:: DOWNLOAD AND EXTRACT MAPS
:: ---------------------------------------------------------------------------

:download_and_extract_maps

set "latest=0"
set "season=9"

:scan_loop

set "TEST_URL=!BASE_URL!/ALS!season!/Map_Archive.zip"
set "TEST_ZIP=%TEMP%\als_test_!RANDOM!.zip"

echo Checking season !season!...

curl -L "!TEST_URL!" -o "!TEST_ZIP!" >nul 2>nul

if not exist "!TEST_ZIP!" (
    goto scan_done
)

for %%A in ("!TEST_ZIP!") do (
    if %%~zA==0 (
        del /q "!TEST_ZIP!" >nul 2>nul
        goto scan_done
    )
)

:: Verify that the downloaded file is a readable archive.
tar -tf "!TEST_ZIP!" >nul 2>nul

if errorlevel 1 (
    del /q "!TEST_ZIP!" >nul 2>nul
    goto scan_done
)

set "latest=!season!"
set /a season+=1

del /q "!TEST_ZIP!" >nul 2>nul

goto scan_loop


:scan_done

if !latest!==0 (
    call :die "No valid season ZIPs found."
    exit /b 1
)

echo Latest valid season: !latest!
echo.

set "ZIP_URL=!BASE_URL!/ALS!latest!/Map_Archive.zip"
set "TMP_ZIP=%TEMP%\alchemy_maps_!RANDOM!.zip"
set "TMP_EXTRACT=%USERPROFILE%\Desktop\AlchemyExtract"


:: ---------------------------------------------------------------------------
:: DOWNLOAD LATEST ARCHIVE
:: ---------------------------------------------------------------------------

echo Downloading latest map archive...

curl -L "!ZIP_URL!" -o "!TMP_ZIP!" >nul 2>nul

if not exist "!TMP_ZIP!" (
    call :die "Map ZIP could not be downloaded."
    exit /b 1
)

for %%A in ("!TMP_ZIP!") do (
    if %%~zA==0 (
        call :die "ZIP downloaded but is empty."
        exit /b 1
    )
)

tar -tf "!TMP_ZIP!" >nul 2>nul

if errorlevel 1 (
    call :die "Downloaded map archive is not a valid ZIP archive."
    exit /b 1
)


:: ---------------------------------------------------------------------------
:: PREPARE TEMP EXTRACTION DIRECTORY
:: ---------------------------------------------------------------------------

if exist "!TMP_EXTRACT!\" (
    rmdir /s /q "!TMP_EXTRACT!" 2>nul

    if exist "!TMP_EXTRACT!\" (
        call :die "Could not remove previous Desktop extraction folder."
        exit /b 1
    )
)

mkdir "!TMP_EXTRACT!" 2>nul

if not exist "!TMP_EXTRACT!\" (
    call :die "Could not create Desktop extraction folder."
    exit /b 1
)


:: ---------------------------------------------------------------------------
:: EXTRACT
:: ---------------------------------------------------------------------------

echo Extracting map archive...

tar -xf "!TMP_ZIP!" -C "!TMP_EXTRACT!"

if errorlevel 1 (
    call :die "tar extraction failed."
    exit /b 1
)


:: ---------------------------------------------------------------------------
:: DESTINATION SAFETY CHECK BEFORE COPYING
:: ---------------------------------------------------------------------------

if not defined DEST_PATH (
    call :die "Safety check failed: DEST_PATH disappeared before copying."
    exit /b 1
)

if "!DEST_PATH!"=="" (
    call :die "Safety check failed: DEST_PATH became empty before copying."
    exit /b 1
)

if not exist "!DEST_PATH!\" (
    call :die "Safety check failed: destination disappeared before copying."
    exit /b 1
)

if /i not "!DEST_PATH!"=="!EXPECTED_DEST!" (
    call :die "Safety check failed: destination changed before copying."
    exit /b 1
)


:: ---------------------------------------------------------------------------
:: COPY RMS FILES
:: ---------------------------------------------------------------------------

set "COPIED_RMS=0"

for /f "delims=" %%F in ('dir /s /b "!TMP_EXTRACT!\*.rms" 2^>nul') do (

    copy /y "%%F" "!DEST_PATH!\%%~nxF" >nul

    if not errorlevel 1 (
        if exist "!DEST_PATH!\%%~nxF" (
            set /a COPIED_RMS+=1
        )
    )
)


:: ---------------------------------------------------------------------------
:: COPY RMS2 FILES
:: ---------------------------------------------------------------------------

for /f "delims=" %%F in ('dir /s /b "!TMP_EXTRACT!\*.rms2" 2^>nul') do (

    copy /y "%%F" "!DEST_PATH!\%%~nxF" >nul

    if not errorlevel 1 (
        if exist "!DEST_PATH!\%%~nxF" (
            set /a COPIED_RMS+=1
        )
    )
)


:: ---------------------------------------------------------------------------
:: COPY PNG FILES
:: ---------------------------------------------------------------------------

for /f "delims=" %%F in ('dir /s /b "!TMP_EXTRACT!\*.png" 2^>nul') do (

    copy /y "%%F" "!DEST_PATH!\%%~nxF" >nul
)


:: ---------------------------------------------------------------------------
:: REQUIRE SUCCESSFUL MAP COPY
:: ---------------------------------------------------------------------------

if !COPIED_RMS!==0 (
    del /q "!TMP_ZIP!" >nul 2>nul
    call :die "No .rms or .rms2 files were copied from the map archive."
    exit /b 1
)

echo !COPIED_RMS! map files installed.


:: ---------------------------------------------------------------------------
:: CLEANUP
:: ---------------------------------------------------------------------------

if exist "!TMP_EXTRACT!\" (
    rmdir /s /q "!TMP_EXTRACT!" 2>nul
)

if exist "!TMP_ZIP!" (
    del /q "!TMP_ZIP!" >nul 2>nul
)

exit /b 0


:: ---------------------------------------------------------------------------
:: DOWNLOAD ABOUT.TXT
:: ---------------------------------------------------------------------------

:download_about

if not defined DEST_PATH (
    call :die "Safety check failed: DEST_PATH is undefined."
    exit /b 1
)

if "!DEST_PATH!"=="" (
    call :die "Safety check failed: DEST_PATH is empty."
    exit /b 1
)

if not exist "!DEST_PATH!\" (
    call :die "Safety check failed: destination directory does not exist."
    exit /b 1
)

if /i not "!DEST_PATH!"=="!EXPECTED_DEST!" (
    call :die "Safety check failed: destination is not the expected directory."
    exit /b 1
)

echo Downloading about.txt...

curl -L "!ABOUT_URL!" -o "!DEST_PATH!\about.txt" >nul 2>nul

if errorlevel 1 (
    call :die "Could not download about.txt."
    exit /b 1
)

if not exist "!DEST_PATH!\about.txt" (
    call :die "about.txt download reported success but the file was not found."
    exit /b 1
)

exit /b 0
