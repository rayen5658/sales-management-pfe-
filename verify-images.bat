@echo off
echo ========================================
echo PRODUCT IMAGES VERIFICATION
echo ========================================
echo.
echo Checking image files in frontend\public\products\...
echo.

cd frontend\public\products

echo JPG Files (Real Photos):
dir /b *.jpg 2>nul
if errorlevel 1 echo   [None found]

echo.
echo SVG Files (Placeholders):
dir /b *.svg 2>nul
if errorlevel 1 echo   [None found]

echo.
echo ========================================
echo Total image files:
dir /b *.jpg *.svg 2>nul | find /c /v ""

echo ========================================
echo.
echo Next steps:
echo 1. Run backend\migrations\006_local_images_only.sql in pgAdmin
echo 2. Restart your backend server (Ctrl+C then npm start)
echo 3. Refresh your browser (Ctrl+F5)
echo.
pause
