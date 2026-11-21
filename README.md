# Cyber Quiz

Quiz de segurança de aplicações no estilo das avaliações de habilidades do LinkedIn e de perguntas de entrevista técnica. Cada tentativa sorteia questões aleatórias e embaralha as alternativas.

**Site:** https://thebinario.github.io/cyber-quiz/

## O que cobre

Temas da primeira versão: **IDOR**, **CSRF**, **SQL Injection** e **SSRF** (85 questões, 8 desafios de código e 2 laboratórios de CTF). Cada tema pergunta:

- o que é a vulnerabilidade (conceito);
- como explorar e como testar (exploração e detecção);
- tipos e variações;
- como corrigir e quantas formas de correção existem;
- em qual categoria do **OWASP Top 10** ela se encaixa (edições 2021 e 2025 indicadas na pergunta; IDOR/BOLA e SSRF também aparecem no OWASP API Top 10:2023).

## Desafios de código

Em `desafios.html` cada desafio tem **enunciado de um lado e o código vulnerável do outro**, no estilo LeetCode. Você corrige o código, clica em **Executar testes** (ou Ctrl/⌘ + Enter) e o desafio só é concluído quando todos os testes passam, inclusive os que garantem que o uso legítimo continua funcionando.

| Tema | Desafios |
|---|---|
| IDOR | Pedidos de outro cliente · Perfil: `userId` no corpo (BOLA + mass assignment) |
| CSRF | Token anti-CSRF na troca de e-mail · Cookie SameSite e checagem de Origin |
| SQL Injection | Login com concatenação · Busca com `LIKE` e `ORDER BY` (allowlist) |
| SSRF | Importar imagem por URL · Redirecionamentos e DNS rebinding |

Como funciona, sem backend:

- o código roda no seu navegador, em um **Web Worker** sem acesso ao DOM nem à rede, com limite de 4 s (laço infinito é interrompido);
- o banco é um interpretador de SQL simplificado (`assets/minisql.js`) que **sofre injeção de verdade** quando a consulta é concatenada, e a rede é simulada (`assets/mininet.js`): nada é consultado ou enviado de verdade;
- rascunhos e desafios resolvidos ficam só no `localStorage`.

Cada desafio fica em `data/challenges/<id>/` com `challenge.json` (enunciado, dicas), `context.js` (dados somente leitura), `starter.js` (código vulnerável), `tests.js` e `solution.js`. O CI garante que o código inicial falha, que a solução passa em todos os testes e que uma "correção" que nega tudo é reprovada.

## Laboratório de CTF (Linux no navegador)

Em `lab.html` o enunciado fica de um lado e um **Linux de verdade** do outro, rodando no navegador por **WebAssembly** (emulador [v86](https://github.com/copy/v86) + Alpine Linux, com `bash`, `python3`, `grep`, `awk`, `strings`, `base64`, `xxd`, `find`, `git` e `rg`). Sem servidor e sem rede: o terminal é só da sua máquina. Você investiga no terminal, encontra a flag e cola no campo abaixo dele; a página confere o **SHA-256** da flag.

| Laboratório | Dificuldade | Tema |
|---|---|---|
| Arquivos escondidos | Fácil | Linux e reconhecimento (`ls -la`, `find`, Base64) |
| Brute force no SSH: quem entrou? | Médio | Análise de logs (`grep`, `awk`, `sort`, `uniq`) |

Como funciona:

- a imagem do Linux e o emulador **não ficam no git**: `scripts/build_lab.py` baixa do npm versões fixas (`v86@0.5.458`, `external-sandbox-v86@0.4.0`, `@xterm/xterm@5.5.0`), confere a integridade (SHA-512 do pacote e SHA-256 de cada arquivo da imagem) e gera os overlays;
- cada laboratório é um **overlay** (um cpio pequeno, em `scripts/lab_overlays.py`) anexado ao initrd: ele traz o `/init`, que abre um shell de usuário comum, e os arquivos do desafio (por exemplo, um `auth.log` gerado de forma determinística);
- a primeira execução baixa cerca de 35 MB (depois fica em cache) e usa cerca de 256 MB de memória;
- as flags estão em `scripts/lab_overlays.py` (como em qualquer CTF estático, quem lê o código vê a resposta; jogue sem abrir esse arquivo).

Para rodar localmente:

```bash
python3 scripts/build_lab.py        # baixa as dependências e gera os overlays (precisa de npm)
python3 -m http.server 8000         # abra http://localhost:8000/lab.html
```

Para criar um laboratório novo: acrescente a pasta `data/labs/<id>/lab.json` (enunciado, dicas e `flagSha256`), inclua o id em `data/labs/index.json` e defina o overlay em `scripts/lab_overlays.py`. O build recusa um `flagSha256` que não corresponda à flag.

## Modos do quiz

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
node --test tests/core.test.js tests/challenges.test.js   # sorteio/correção e desafios
```

Os testes dos desafios exigem que o código inicial seja vulnerável, que a solução passe e que correções plausíveis mas incompletas sejam pegas.

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

## Laboratório com desktop gráfico (experimental)

O laboratório `desktop-linux` abre um Alpine Linux com **Xorg + Openbox** dentro do navegador (v86, sistema de arquivos 9p carregado sob demanda). Ele só aparece na lista se `lab/gui/manifest.json` existir.

- Construção: `scripts/build_gui.sh` (precisa de Docker, rede e `zstandard`); usa `scripts/gui/Dockerfile` e as ferramentas `fs2json.py`/`copy-to-sha256.py` do v86 numa revisão fixa.
- No CI: crie a variável de repositório `BUILD_GUI=true` (Settings → Secrets and variables → Actions → Variables). O passo é `continue-on-error`: se falhar, o site publica normalmente sem o laboratório gráfico.
- Status: **ainda não testado de ponta a ponta**. Se o desktop não subir, verifique os logs do passo "Construir o desktop gráfico" e o console do navegador.
