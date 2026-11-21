# Cyber Quiz

Quiz de segurança de aplicações no estilo das avaliações de habilidades do LinkedIn e de perguntas de entrevista técnica. Cada tentativa sorteia questões aleatórias e embaralha as alternativas.

**Site:** https://thebinario.github.io/cyber-quiz/

## O que cobre

Temas da primeira versão: **IDOR**, **CSRF**, **SQL Injection** e **SSRF** (86 questões). Cada tema pergunta:

- o que é a vulnerabilidade (conceito);
- como explorar e como testar (exploração e detecção);
- tipos e variações;
- como corrigir e quantas formas de correção existem;
- em qual categoria do **OWASP Top 10** ela se encaixa (edições 2021 e 2025 indicadas na pergunta; IDOR/BOLA e SSRF também aparecem no OWASP API Top 10:2023).

## Modos

- **Misto**: perguntas de todos os temas, distribuídas de forma equilibrada.
- **Por tema**: só um assunto.

Cada tentativa tem de 15 a 40 questões (mínimo de 15). Dá para mostrar a explicação após cada questão ou só no final, como numa prova. Perguntas ainda não vistas têm prioridade. O histórico fica apenas no seu navegador (`localStorage`).

## Rodando localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Abrir o `index.html` direto por `file://` não funciona, porque o navegador bloqueia o `fetch` dos arquivos JSON.

## Testes e validação

```bash
python3 scripts/validate_questions.py   # estrutura e qualidade do banco
node --test tests/core.test.js          # sorteio, correção e resumo
```

O validador falha em erros de estrutura (ids, índices de resposta, duplicatas) e avisa sobre vícios que entregam a resposta, como a alternativa certa ser sempre a mais longa ou ficar sempre na mesma posição.

## Adicionando questões

Edite `data/<tema>.json` e acrescente um objeto em `questions`:

```json
{
  "id": "idor-23",
  "category": "conceito",
  "difficulty": "medio",
  "type": "single",
  "question": "Texto da pergunta. Use `crases` para código.",
  "options": ["A", "B", "C", "D"],
  "answer": [2],
  "explanation": "Por que a resposta está certa e as outras não."
}
```

- `category`: `conceito`, `exploracao`, `tipos`, `correcao`, `owasp` ou `deteccao`.
- `difficulty`: `facil`, `medio` ou `dificil`.
- `type`: `single` (uma resposta) ou `multi` (todas as corretas precisam ser marcadas).
- `answer`: posições (a partir de 0) das alternativas corretas.
- Mantenha as alternativas com tamanho parecido e rode o validador antes de abrir o PR.

Para criar um tema novo, crie `data/<id>.json` (com `id`, `title`, `description`, `questions`) e inclua o id em `data/index.json`.

## Publicação

O workflow `.github/workflows/pages.yml` valida o banco, roda os testes e publica no GitHub Pages a cada push em `main`. Na primeira vez: **Settings → Pages → Source: GitHub Actions**.

## Aviso

Material de estudo. Pratique as técnicas apenas em ambientes próprios ou com autorização formal.
