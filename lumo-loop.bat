@echo off
cd /d "%~dp0"
:loop
echo [%date% %time%] Starting LUMO CHATBOT >> bot.log
call npm start >> bot.log 2>&1
echo [%date% %time%] LUMO CHATBOT stopped, restarting in 30 seconds >> bot.log
rem Hidden windows have no console input, so timeout does not wait; ping works everywhere
ping -n 31 127.0.0.1 > nul
goto loop
