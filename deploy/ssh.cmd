@echo off
REM Удобный обертка для plink, чтобы не повторять все флаги.
REM Использование: ssh.cmd "<bash command>"
plink -ssh -batch -pw "ShAVSu2ZM57U7jFB" -hostkey "ssh-ed25519 255 SHA256:kTPrb01XLPu73Wwm45TIweNoMja2WroQnMRDblRi4e8" root@168.222.143.103 %*
