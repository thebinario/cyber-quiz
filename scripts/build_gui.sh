#!/usr/bin/env bash
# Gera o laboratório com desktop gráfico em lab/gui/ (somente CI ou máquina com Docker e rede).
# Resultado: lab/gui/{fs.json,flat/*.zst,manifest.json}. Se algo falhar, nada é publicado.
set -euo pipefail

# Mesma revisão do copy/v86 usada para conferir as ferramentas fs2json/copy-to-sha256.
V86_REV="d96be774e549a83371b038b86e819804c96b921f"

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
out="$root/lab/gui"

pip install --quiet --break-system-packages zstandard 2>/dev/null || pip install --quiet zstandard

git init -q "$work/v86"
git -C "$work/v86" remote add origin https://github.com/copy/v86
git -C "$work/v86" fetch -q --depth 1 origin "$V86_REV"
git -C "$work/v86" checkout -q FETCH_HEAD

docker build "$root/scripts/gui" --platform linux/386 --tag cyber-quiz-gui
docker rm -f cyber-quiz-gui-c >/dev/null 2>&1 || true
docker create --platform linux/386 --name cyber-quiz-gui-c cyber-quiz-gui >/dev/null
docker export cyber-quiz-gui-c -o "$work/rootfs.tar"
docker rm cyber-quiz-gui-c >/dev/null
tar -f "$work/rootfs.tar" --delete ".dockerenv" || true

rm -rf "$out"
mkdir -p "$out/flat"
python3 "$work/v86/tools/fs2json.py" --zstd --out "$out/fs.json" "$work/rootfs.tar"
python3 "$work/v86/tools/copy-to-sha256.py" --zstd "$work/rootfs.tar" "$out/flat"

# O frontend só mostra o laboratório gráfico se este arquivo existir.
printf '{"v86Rev":"%s","fs":"fs.json","baseurl":"flat/"}\n' "$V86_REV" > "$out/manifest.json"
echo "Desktop gerado em $out ($(du -sh "$out" | cut -f1))"
