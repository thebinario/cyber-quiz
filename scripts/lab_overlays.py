"""Overlays do laboratório: arquivos de cada desafio + o /init da VM.

O overlay é um cpio (formato newc) comprimido, concatenado ao initrd da imagem Alpine.
O kernel desempacota os dois em sequência; o /init do overlay substitui o original.
Tudo é determinístico: a mesma entrada gera exatamente os mesmos bytes.
"""
import base64
import gzip
import hashlib
import io
import random

AGENT = (1000, 1000)  # uid/gid do usuário "agent" já existente na imagem

INIT = b"""#!/bin/sh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev
mkdir -p /dev/pts /run /tmp /home/agent
mount -t devpts devpts /dev/pts
mount -t tmpfs -o mode=1777,size=64m tmpfs /tmp
hostname lab
chown 1000:1000 /home/agent
chmod 0750 /home/agent
stty -F /dev/ttyS0 cols 80 rows 24 2>/dev/null
exec setsid -c su -l agent </dev/ttyS0 >/dev/ttyS0 2>&1
"""

PROFILE = b"""# Ambiente do laboratorio
export PS1='\\[\\e[32m\\]agent@lab\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]\\$ '
export HISTFILE=/dev/null
cd ~ 2>/dev/null
[ -f /etc/lab-motd ] && cat /etc/lab-motd
"""


def _pad(n):
    return (4 - n % 4) % 4


class Cpio:
    def __init__(self):
        self.buf = io.BytesIO()
        self.ino = 1
        self.dirs = set()

    def _entry(self, name, data, mode, uid, gid):
        self.ino += 1
        nb = name.encode() + b"\0"
        fields = (self.ino, mode, uid, gid, 1, 0, len(data), 0, 0, 0, 0, len(nb), 0)
        out = b"070701" + "".join("%08X" % v for v in fields).encode() + nb
        out += b"\0" * _pad(len(out)) + data + b"\0" * _pad(len(data))
        self.buf.write(out)

    def mkdirs(self, path, uid=0, gid=0, mode=0o755):
        parts = path.strip("/").split("/")
        for i in range(1, len(parts) + 1):
            d = "/".join(parts[:i])
            if d not in self.dirs:
                self.dirs.add(d)
                self._entry(d, b"", 0o040000 | mode, uid, gid)

    def file(self, path, data, mode=0o644, uid=0, gid=0, dir_owner=None):
        parent = path.strip("/").rsplit("/", 1)[0] if "/" in path.strip("/") else ""
        if parent:
            o = dir_owner if dir_owner is not None else (uid, gid)
            self.mkdirs(parent, o[0], o[1])
        self._entry(path.strip("/"), data, 0o100000 | mode, uid, gid)

    def finish(self):
        self._entry("TRAILER!!!", b"", 0, 0, 0)
        return gzip.compress(self.buf.getvalue(), 9, mtime=0)


def sha256(text):
    return hashlib.sha256(text.encode()).hexdigest()


# --------------------------------------------------------------------------------------
# Laboratório 1: arquivos escondidos
# --------------------------------------------------------------------------------------

FLAG_ESCONDIDOS = "FLAG{arquivos_escondidos_tambem_sao_arquivos}"


def lab_arquivos_escondidos(c):
    home = "home/agent"
    own = dict(uid=AGENT[0], gid=AGENT[1])
    c.mkdirs(home, **{"uid": AGENT[0], "gid": AGENT[1], "mode": 0o750})
    c.file(f"{home}/LEIAME.txt", b"Servidor de homologacao do painel interno.\nBackups antigos foram movidos. Nao ha nada importante aqui.\n", **own)
    c.file(f"{home}/notas.txt", b"- renovar certificado do painel (marco)\n- trocar a senha do usuario backup\n- limpar a pasta de cache antiga\n", **own)
    c.file(f"{home}/relatorio-q3.csv", b"servico,disponibilidade\npainel,99.2\napi,99.8\nfila,98.7\n", **own)
    secret = (
        "# backup da configuracao do painel interno\n"
        "# NAO COMMITAR ESTE ARQUIVO\n"
        "admin_user=admin\n"
        f"admin_note={FLAG_ESCONDIDOS}\n"
    )
    c.file(f"{home}/.cache/.old/backup.b64", base64.encodebytes(secret.encode()), **own)
    c.file(f"{home}/.cache/.old/LEIA-ME", b"copia de seguranca (codificada)\n", **own)
    decoy = base64.encodebytes(b"backup vazio: nada para restaurar aqui.\n")
    c.file(f"{home}/.cache/.tmp/sessao.b64", decoy, **own)
    c.file(f"{home}/.config/painel/painel.conf", b"porta=8443\nlog=/var/log/painel.log\n", **own)
    c.file("etc/lab-motd", b"\nLaboratorio: arquivos escondidos\nO enunciado esta ao lado. Dica: ls -la\n\n", mode=0o644)


# --------------------------------------------------------------------------------------
# Laboratório 2: brute force no SSH
# --------------------------------------------------------------------------------------

FLAG_BRUTE_FORCE = "FLAG{203.0.113.77_deploy}"


def _auth_log():
    rng = random.Random(1337)
    events = []  # (segundos desde 01:00:00, linha)

    def stamp(sec):
        return "Nov 20 %02d:%02d:%02d" % (1 + sec // 3600, (sec % 3600) // 60, sec % 60)

    def add(sec, text):
        events.append((sec, "%s lab sshd[%d]: %s" % (stamp(sec), rng.randint(1000, 9999), text)))

    valid = {"root", "deploy", "ana", "agent"}
    users = ["root", "admin", "test", "oracle", "postgres", "ubuntu", "git", "guest", "pi", "deploy", "ana", "user"]

    def fail(sec, ip, user):
        if user in valid:
            add(sec, "Failed password for %s from %s port %d ssh2" % (user, ip, rng.randint(20000, 60000)))
        else:
            add(sec, "Failed password for invalid user %s from %s port %d ssh2" % (user, ip, rng.randint(20000, 60000)))

    # Atacante A: o mais barulhento, mas NUNCA entra
    t = 1800
    for _ in range(190):
        t += rng.randint(1, 9)
        fail(t, "192.0.2.50", rng.choice(users))
    # Atacante B: menos tentativas, mas entra no fim
    t = 4500
    for _ in range(138):
        t += rng.randint(1, 8)
        fail(t, "203.0.113.77", rng.choice(["root", "admin", "test", "ubuntu", "oracle", "git"]))
    for _ in range(12):
        t += rng.randint(2, 6)
        fail(t, "203.0.113.77", "deploy")
    t += 4
    add(t, "Accepted password for deploy from 203.0.113.77 port 51234 ssh2")
    events.append((t, "%s lab sshd[%d]: pam_unix(sshd:session): session opened for user deploy(uid=1001) by (uid=0)" % (stamp(t), rng.randint(1000, 9999))))
    # Ruído: IPs com poucas falhas
    for ip in ["198.51.100.23", "198.51.100.41", "192.0.2.9", "203.0.113.5", "198.51.100.200", "192.0.2.131"]:
        t0 = rng.randint(600, 9000)
        for k in range(rng.randint(3, 9)):
            fail(t0 + k * rng.randint(20, 90), ip, rng.choice(users))
    # Logins legítimos (iscas para "Accepted")
    add(900, "Accepted publickey for agent from 10.0.0.12 port 50022 ssh2: ED25519 SHA256:Zk3...")
    add(3300, "Accepted password for ana from 198.51.100.8 port 44120 ssh2")
    add(7700, "Accepted publickey for agent from 10.0.0.12 port 50388 ssh2: ED25519 SHA256:Zk3...")
    events.sort(key=lambda e: e[0])
    return ("\n".join(line for _, line in events) + "\n").encode()


def lab_brute_force(c):
    home = "home/agent"
    own = dict(uid=AGENT[0], gid=AGENT[1])
    c.mkdirs(home, uid=AGENT[0], gid=AGENT[1], mode=0o750)
    c.file("var/log/auth.log", _auth_log(), mode=0o644)
    c.file(f"{home}/LEIAME.txt", b"Plantao de seguranca. O log de autenticacao do servidor SSH esta em /var/log/auth.log\n", **own)
    c.file("etc/lab-motd", b"\nLaboratorio: brute force no SSH\nO enunciado esta ao lado. Log: /var/log/auth.log\n\n", mode=0o644)


LABS = {
    "arquivos-escondidos": {"build": lab_arquivos_escondidos, "flag": FLAG_ESCONDIDOS},
    "brute-force-logs": {"build": lab_brute_force, "flag": FLAG_BRUTE_FORCE},
}


def build_overlay(lab_id):
    c = Cpio()
    c.file("init", INIT, mode=0o755)
    c.file("etc/profile.d/lab.sh", PROFILE, mode=0o644)
    LABS[lab_id]["build"](c)
    return c.finish()
