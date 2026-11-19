@echo off
cd /d "%~dp0"
if exist "C:\Users\Jogi\Documents\ChatGPT\Exam Analyzer\Laufzeit\Examanalyzer_Windows_3.6.0\.venv\Scripts\python.exe" (
  "C:\Users\Jogi\Documents\ChatGPT\Exam Analyzer\Laufzeit\Examanalyzer_Windows_3.6.0\.venv\Scripts\python.exe" -B START_TEST_VIEWER.py
) else (
  py -3 START_TEST_VIEWER.py
)
pause
