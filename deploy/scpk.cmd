@echo off
REM Копирование файлов на VPS через scp по SSH-ключу.
REM Использование: scpk.cmd <local_path> <remote_path>
"C:\Windows\System32\OpenSSH\scp.exe" -i "%~dp0ssh_key" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="%~dp0known_hosts" -o BatchMode=yes %*
