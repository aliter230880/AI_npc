"""Разведка VPS: что за ОС, что уже запущено, есть ли docker/git."""
import paramiko, sys

HOST = "168.222.143.103"
USER = "root"
PASS = "ShAVSu2ZM57U7jFB"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=20, look_for_keys=False, allow_agent=False)

def run(cmd):
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace").rstrip()
    err = stderr.read().decode("utf-8", errors="replace").rstrip()
    if out: print(out)
    if err: print("[stderr]", err)

run("uname -a")
run("cat /etc/os-release | head -n 4")
run("free -h")
run("df -h /")
run("which docker || echo no-docker")
run("which git || echo no-git")
run("which curl || echo no-curl")
run("which python3 || echo no-python")
run("ss -tlnp 2>/dev/null | head -n 20 || netstat -tlnp 2>/dev/null | head -n 20")
run("ls -la /root 2>/dev/null | head -n 20")
run("systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -n 30")

c.close()
