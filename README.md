# MEDEIROS DIGITAL — Agente de Vendas

Projeto independente do robô de divulgação existente.

## Estrutura atual
Os arquivos do projeto ficam na raiz do repositório: `server.js`, `db.js`, `assistant.js`, `whatsapp.js` e `index.html`.

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- Runtime: Node 20 ou superior
- Configure `ADMIN_USER`, `ADMIN_PASSWORD` (mínimo 12 caracteres) e `SESSION_SECRET` (mínimo 32 caracteres).
- Configure um disco persistente montado em `/opt/render/project/src/data` e defina `DATA_DIR=/opt/render/project/src/data` para preservar o banco SQLite. Sem disco persistente, os dados podem ser perdidos em reinicializações/redeploys.
- `WHATSAPP_ENABLED=false` deve permanecer assim até definirmos como conectar sem interromper a sessão do robô antigo.
- `/health` é o endpoint público de verificação.

## Limitações importantes
- Esta é uma base MVP e ainda exige testes funcionais e revisão de segurança antes de atender clientes.
- O modo de IA depende de um provedor compatível com API OpenAI e credenciais próprias. Sem elas, há respostas básicas por regras; não há IA ilimitada gratuita.
- A sessão do painel usa armazenamento em memória nesta versão e será encerrada em reinicializações.
- O WhatsApp Web usa Chromium/Puppeteer e pode exigir configuração adicional no Render.
- Não conecte o mesmo número em duas sessões independentes. Precisamos decidir coexistência oficial ou migração para não derrubar o robô antigo.
- Use apenas contatos autorizados; não faça disparos em massa. Implemente política de privacidade, aviso de atendimento automatizado e controles LGPD antes da operação comercial.
