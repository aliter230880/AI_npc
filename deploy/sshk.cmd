@echo off
REM Подключение по SSH-ключу через OpenSSH (явный путь, чтобы не подменялось plink из PuTTY).
"C:\Windows\System32\OpenSSH\ssh.exe" -i "%~dp0ssh_key" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="%~dp0known_hosts" -o BatchMode=yes root@168.222.143.103 %*
