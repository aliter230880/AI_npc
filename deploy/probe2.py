"""Что именно сейчас работает на VPS — какие контейнеры и что в Caddy."""
import paramiko

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

run("docker ps -a")
run("docker images")
run("ls -la /etc/caddy 2>/dev/null")
run("cat /etc/caddy/Caddyfile 2>/dev/null")
run("ls /opt /srv /var/www /home 2>/dev/null")
run("find /root /opt /srv -maxdepth 3 -name 'docker-compose*.yml' 2>/dev/null | head -20")
run("find /root /opt /srv -maxdepth 3 -name 'Caddyfile' 2>/dev/null | head -20")

c.close()
