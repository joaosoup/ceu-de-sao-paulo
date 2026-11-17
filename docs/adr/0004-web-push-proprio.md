# ADR 0004: Web Push implementado no projeto

Data: 2026-11-16. Estado: aceito.

O plano citava a biblioteca PushForge. Ao testar, ela gera mensagens na codificação antiga `aesgcm`
(rascunho anterior à RFC 8291). Como o iPhone é o caso mais delicado do produto, não vale o risco.

Decisão: `apps/worker/src/webpush.ts`, cerca de 130 linhas só com Web Crypto, seguindo a RFC 8291
(`aes128gcm`) e a RFC 8292 (VAPID). Sem dependência externa.

Verificação: `test/push-crypto.test.ts` faz o papel do navegador, decifra a mensagem com a chave privada
da inscrição e confere a assinatura VAPID. Falta o teste que nenhum código substitui: receber um alerta
real em um Android e em um iPhone.
