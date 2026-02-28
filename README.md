# Replit Assistant Clone

Clone funcional do Replit Assistant — IDE web com AI assistant embutido, construido com HTML/CSS/JS puro (zero dependencias).

## Features

| Feature | Status |
|---------|--------|
| Editor de codigo com line numbers | OK |
| Tabs multiplas | OK |
| File tree | OK |
| AI Assistant (chat) | OK |
| Propor mudancas em arquivos (Apply) | OK |
| Shell simulado (ls, cat, python, node...) | OK |
| Run code (Python/JS) | OK |
| Secrets manager | OK |
| Deploy simulator | OK |
| Nudge para Secrets/Deploy | OK |

## Como usar

```bash
git clone https://github.com/fypak-ai/replit-assistant-clone.git
cd replit-assistant-clone
open index.html
# ou
python -m http.server 8080
```

## Protocolo de resposta (XML tags)

O assistente gera acoes estruturadas baseadas no system prompt original do Replit:

- proposed_file_replace_substring: editar trecho de arquivo
- proposed_file_replace: substituir arquivo inteiro
- proposed_file_insert: criar arquivo novo
- proposed_shell_command: executar comando
- proposed_package_install: instalar pacotes
- proposed_workflow_configuration: configurar workflows
- proposed_deployment_configuration: configurar deploy

## Stack

- HTML5 / CSS3 / Vanilla JS (zero frameworks)
- Google Fonts (JetBrains Mono + Inter)
- Deploy estatico: GitHub Pages, Vercel, Netlify, Railway

## Deploy rapido (Vercel)

```bash
npx vercel --prod
```

---

Baseado no system prompt vazado de: https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools
