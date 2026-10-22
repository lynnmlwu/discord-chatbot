@echo off
cd /d "%~dp0"
:loop
echo [%date% %time%] Starting LUMO CHATBOT >> bot.log
call npm start >> bot.log 2>&1
echo [%date% %time%] LUMO CHATBOT stopped, restarting in 30 seconds >> bot.log
timeout /t 30 /nobreak > nul
goto loop
