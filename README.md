# Agente de Vendas MEDEIROS DIGITAL

Projeto inicial independente do robô atual.

## Rodar localmente
1. Instale Node.js 20 ou superior.
2. Copie `.env.example` para `.env`.
3. Altere `ADMIN_PASSWORD` e `SESSION_SECRET`.
4. Execute `npm install` e depois `npm start`.
5. Abra `http://localhost:3000`.

## Importante
- Esta é uma primeira versão técnica/MVP, ainda precisa de testes e endurecimento de segurança antes de produção.
- A conversa com IA de verdade é opcional e requer credenciais de um provedor compatível com API OpenAI. Sem isso, há apenas respostas básicas; não é correto prometer IA completa e ilimitada sem custo.
- O WhatsApp Web só conecta com `WHATSAPP_ENABLED=true` e leitura do QR. Não conecte a mesma conta em duas sessões independentes simultaneamente. Para preservar o atendimento existente, precisamos escolher coexistência oficial ou migrar a conexão.
- O bot responde mensagens privadas recebidas e ignora grupos; não faz prospecção em massa. Prospecção exige contatos autorizados e abordagem responsável.
- Configure HTTPS, armazenamento persistente, backups e política de privacidade/LGPD antes de publicar.
