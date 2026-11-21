#!/usr/bin/env python3
"""Valida o banco de questões em data/.

Erros (saída 1): estrutura inválida, gabarito inconsistente, ids repetidos,
menos de 15 questões por tema.
Avisos (não falham o build): menos de 20 questões em um tema, viés de posição
ou de tamanho da alternativa correta, que denunciam a resposta sem conhecer o assunto.

Uso: python3 scripts/validate_questions.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

MIN_PER_TOPIC = 15      # mínimo exigido por tentativa
RECOMMENDED = 20        # abaixo disso, as tentativas se repetem muito
CATEGORIES = {"conceito", "exploracao", "tipos", "correcao", "owasp", "deteccao"}
DIFFICULTIES = {"facil", "medio", "dificil"}
TYPES = {"single", "multi"}
ID_PATTERN = re.compile(r"^[a-z0-9]+-\d{2,3}$")
TOPIC_PATTERN = re.compile(r"^[a-z0-9]+$")


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ERRO: {path.relative_to(ROOT)}: {exc}")


def check_question(q: dict, topic: str, where: str, errors: list[str]) -> None:
    def err(msg: str) -> None:
        errors.append(f"{where}: {msg}")

    for field in ("id", "category", "difficulty", "type", "question", "options", "answer", "explanation"):
        if field not in q:
            err(f"campo ausente: {field}")
            return

    qid = q["id"]
    if not isinstance(qid, str) or not ID_PATTERN.match(qid):
        err(f"id inválido: {qid!r} (use tema-NN, por exemplo idor-01)")
    elif not qid.startswith(topic + "-"):
        err(f"id {qid!r} deve começar com '{topic}-'")

    if q["category"] not in CATEGORIES:
        err(f"category inválida: {q['category']!r} (válidas: {sorted(CATEGORIES)})")
    if q["difficulty"] not in DIFFICULTIES:
        err(f"difficulty inválida: {q['difficulty']!r} (válidas: {sorted(DIFFICULTIES)})")
    if q["type"] not in TYPES:
        err(f"type inválido: {q['type']!r} (válidos: {sorted(TYPES)})")

    for field in ("question", "explanation"):
        value = q[field]
        if not isinstance(value, str) or not value.strip():
            err(f"{field} vazio")
        elif value.count("`") % 2:
            err(f"{field} com número ímpar de crases")
    if isinstance(q["explanation"], str) and len(q["explanation"].strip()) < 20:
        err("explanation muito curta (explique por que a resposta está certa)")

    options = q["options"]
    answer = q["answer"]
    if not isinstance(options, list) or not 2 <= len(options) <= 6:
        err("options deve ter de 2 a 6 alternativas")
        return
    if not all(isinstance(o, str) and o.strip() for o in options):
        err("options contém alternativa vazia ou que não é texto")
        return
    if len({o.strip().lower() for o in options}) != len(options):
        err("options contém alternativas repetidas")
    for o in options:
        if o.count("`") % 2:
            err(f"alternativa com número ímpar de crases: {o[:40]!r}")

    if not isinstance(answer, list) or not answer or not all(isinstance(a, int) and not isinstance(a, bool) for a in answer):
        err("answer deve ser uma lista de índices inteiros")
        return
    if len(set(answer)) != len(answer):
        err("answer tem índices repetidos")
    if any(a < 0 or a >= len(options) for a in answer):
        err("answer tem índice fora do intervalo de options")
        return
    if q["type"] == "single" and len(answer) != 1:
        err("questão single deve ter exatamente 1 resposta")
    if q["type"] == "multi" and not 2 <= len(answer) <= len(options) - 1:
        err("questão multi deve ter ao menos 2 respostas corretas e ao menos 1 errada")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    index = load(DATA / "index.json")
    topics = index.get("topics")
    if not isinstance(topics, list) or not topics:
        raise SystemExit("ERRO: data/index.json precisa de uma lista 'topics'")
    if len(set(topics)) != len(topics):
        errors.append("data/index.json: temas repetidos")

    on_disk = {p.stem for p in DATA.glob("*.json")} - {"index"}
    for orphan in sorted(on_disk - set(topics)):
        errors.append(f"data/{orphan}.json não está listado em data/index.json")

    seen_ids: dict[str, str] = {}
    seen_text: dict[str, str] = {}
    totals = {}

    for topic in topics:
        if not TOPIC_PATTERN.match(topic):
            errors.append(f"tema com nome inválido: {topic!r}")
            continue
        path = DATA / f"{topic}.json"
        if not path.is_file():
            errors.append(f"data/{topic}.json não existe")
            continue
        doc = load(path)
        if doc.get("id") != topic:
            errors.append(f"data/{topic}.json: 'id' deve ser {topic!r}")
        for field in ("title", "description"):
            if not isinstance(doc.get(field), str) or not doc[field].strip():
                errors.append(f"data/{topic}.json: '{field}' ausente")
        questions = doc.get("questions")
        if not isinstance(questions, list):
            errors.append(f"data/{topic}.json: 'questions' deve ser uma lista")
            continue

        totals[topic] = len(questions)
        if len(questions) < MIN_PER_TOPIC:
            errors.append(f"data/{topic}.json: {len(questions)} questões; o mínimo é {MIN_PER_TOPIC}")
        elif len(questions) < RECOMMENDED:
            warnings.append(f"data/{topic}.json: {len(questions)} questões; com menos de {RECOMMENDED} as tentativas se repetem muito")

        single_positions: dict[int, int] = {}
        longest_is_correct = 0
        singles = 0

        for i, q in enumerate(questions, start=1):
            where = f"data/{topic}.json #{i} ({q.get('id', '?')})"
            check_question(q, topic, where, errors)

            qid = q.get("id")
            if isinstance(qid, str):
                if qid in seen_ids:
                    errors.append(f"{where}: id repetido (também em {seen_ids[qid]})")
                seen_ids[qid] = where
            text = q.get("question")
            if isinstance(text, str):
                key = " ".join(text.lower().split())
                if key in seen_text:
                    errors.append(f"{where}: enunciado repetido (também em {seen_text[key]})")
                seen_text[key] = where

            if q.get("type") == "single" and isinstance(q.get("answer"), list) and len(q["answer"]) == 1:
                opts = q.get("options", [])
                right = q["answer"][0]
                if isinstance(right, int) and 0 <= right < len(opts):
                    singles += 1
                    single_positions[right] = single_positions.get(right, 0) + 1
                    lengths = [len(o) for o in opts]
                    others = sorted(lengths[:right] + lengths[right + 1:], reverse=True)
                    # "claramente mais longa": pelo menos 10% acima da segunda maior
                    if others and lengths[right] > others[0] * 1.10:
                        longest_is_correct += 1

        if singles >= 8:
            for pos, n in sorted(single_positions.items()):
                if n / singles > 0.5:
                    warnings.append(f"data/{topic}.json: {n}/{singles} respostas 'single' estão na posição {pos + 1}")
            if longest_is_correct / singles > 0.35:
                warnings.append(
                    f"data/{topic}.json: a alternativa correta é claramente a mais longa em {longest_is_correct}/{singles} "
                    "questões 'single' (denuncia a resposta; equilibre o tamanho dos distratores)"
                )

    for w in warnings:
        print(f"AVISO: {w}")
    for e in errors:
        print(f"ERRO: {e}")

    if errors:
        print(f"\n{len(errors)} erro(s).")
        return 1

    summary = ", ".join(f"{t}: {n}" for t, n in totals.items())
    print(f"OK: {sum(totals.values())} questões válidas ({summary}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
