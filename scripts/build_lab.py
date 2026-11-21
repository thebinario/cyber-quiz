#!/usr/bin/env python3
"""Prepara o laboratório: baixa as dependências (versões fixas, com integridade conferida)
e gera os overlays de cada desafio. Nada disso é versionado no git.

    python3 scripts/build_lab.py              # baixa tudo e gera os overlays
    python3 scripts/build_lab.py --overlays   # só os overlays (não precisa de rede)
"""
import base64
import hashlib
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lab_overlays  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "lab" / "vendor"
OVERLAYS = ROOT / "lab" / "overlays"

PACKAGES = {
    "v86@0.5.458": "sha512-ixQE0RyfjMgrBvx5O+kq1AXPZwhUJVqD5Vhl2LBm8L4jgV2fVczYalbG4thu0vWSl42Q71DOwjIl5Y8mZHNpyA==",
    "external-sandbox-v86@0.4.0": "sha512-fnrjAByVrOfipw5IZO4zAhntwBCvrKIz1kDnfq/QB+pPRTLaaEY0AF5+SJZ0p9KN0A/cr2OS76EsimDdy2kIzg==",
    "@xterm/xterm@5.5.0": "sha512-hqJHYaQb5OptNunnyAnkHyM8aCjZ1MEIDTQu1iIbbTD/xops91NB5yq1ZK/dC2JDbVWtF23zUtl9JE2NqwT87A==",
}

IMAGE_SHA256 = {
    "seabios.bin": "73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98",
    "vgabios.bin": "a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880",
    "bzimage": "a02b47898430dc42a609d9ce7fb76099ec29005351f9c7d25c27395f3350fdd4",
    "initrd.img": "aa0cd0720b3d76aefc5f844210da91c4a444270a8d39d6ac32283b95d8b7a140",
}


def die(msg):
    print("ERRO:", msg, file=sys.stderr)
    sys.exit(1)


def pack(spec, expected_integrity, workdir):
    out = subprocess.run(["npm", "pack", spec, "--silent", "--pack-destination", str(workdir)],
                         capture_output=True, text=True)
    if out.returncode != 0:
        die("npm pack %s falhou:\n%s" % (spec, out.stderr))
    tgz = workdir / out.stdout.strip().splitlines()[-1]
    digest = base64.b64encode(hashlib.sha512(tgz.read_bytes()).digest()).decode()
    if "sha512-" + digest != expected_integrity:
        die("integridade diferente para %s (esperado %s, obtido sha512-%s)" % (spec, expected_integrity, digest))
    extracted = workdir / ("x-" + spec.replace("/", "_").replace("@", "_"))
    with tarfile.open(tgz) as tar:
        tar.extractall(extracted, filter="data")
    return extracted / "package"


def fetch():
    shutil.rmtree(VENDOR, ignore_errors=True)
    (VENDOR / "notices").mkdir(parents=True)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        v86 = pack("v86@0.5.458", PACKAGES["v86@0.5.458"], work)
        shutil.copy(v86 / "build" / "libv86.js", VENDOR / "libv86.js")
        shutil.copy(v86 / "build" / "v86.wasm", VENDOR / "v86.wasm")
        shutil.copy(v86 / "LICENSE", VENDOR / "notices" / "v86-LICENSE.txt")

        ext = pack("external-sandbox-v86@0.4.0", PACKAGES["external-sandbox-v86@0.4.0"], work)
        for name, expected in IMAGE_SHA256.items():
            data = (ext / "images" / "linux" / name).read_bytes()
            if hashlib.sha256(data).hexdigest() != expected:
                die("SHA-256 diferente para a imagem " + name)
            (VENDOR / name).write_bytes(data)
        shutil.copy(ext / "images" / "THIRD-PARTY-NOTICES.md", VENDOR / "notices" / "THIRD-PARTY-NOTICES.md")
        shutil.copy(ext / "PROVENANCE.md", VENDOR / "notices" / "PROVENANCE.md")
        shutil.copytree(ext / "images" / "licenses", VENDOR / "notices" / "licenses")
        shutil.copy(ext / "images" / "sources.lock.json", VENDOR / "notices" / "sources.lock.json")

        xt = pack("@xterm/xterm@5.5.0", PACKAGES["@xterm/xterm@5.5.0"], work)
        shutil.copy(xt / "lib" / "xterm.js", VENDOR / "xterm.js")
        shutil.copy(xt / "css" / "xterm.css", VENDOR / "xterm.css")
        shutil.copy(xt / "LICENSE", VENDOR / "notices" / "xterm-LICENSE.txt")
    print("dependências em", VENDOR.relative_to(ROOT))


def overlays():
    shutil.rmtree(OVERLAYS, ignore_errors=True)
    OVERLAYS.mkdir(parents=True)
    index = json.loads((ROOT / "data" / "labs" / "index.json").read_text(encoding="utf-8"))["labs"]
    for lab_id in index:
        meta = json.loads((ROOT / "data" / "labs" / lab_id / "lab.json").read_text(encoding="utf-8"))
        if meta.get("mode") == "desktop":
            # Laboratório gráfico: a flag está em scripts/gui/Dockerfile; confere o hash ali.
            dockerfile = (ROOT / "scripts" / "gui" / "Dockerfile").read_text(encoding="utf-8")
            flag = "FLAG{desktop_grafico_no_navegador}"
            if flag not in dockerfile or lab_overlays.sha256(flag) != meta["flagSha256"]:
                die("flag do laboratório gráfico não confere com scripts/gui/Dockerfile")
            print("desktop %-21s ok (imagem construída por scripts/build_gui.sh)" % lab_id)
            continue
        if lab_id not in lab_overlays.LABS:
            die("laboratório sem definição de overlay: " + lab_id)
        expected = lab_overlays.sha256(lab_overlays.LABS[lab_id]["flag"])
        if meta.get("flagSha256") != expected:
            die("flagSha256 de %s deveria ser %s" % (lab_id, expected))
        blob = lab_overlays.build_overlay(lab_id)
        (OVERLAYS / (lab_id + ".cpio.gz")).write_bytes(blob)
        print("overlay %-22s %6d bytes" % (lab_id, len(blob)))
    for extra in set(lab_overlays.LABS) - set(index):
        print("aviso: definição sem entrada em data/labs/index.json:", extra)


if __name__ == "__main__":
    if "--overlays" not in sys.argv:
        fetch()
    overlays()
