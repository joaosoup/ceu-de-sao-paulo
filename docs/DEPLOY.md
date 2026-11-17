# Colocar no ar (Cloudflare, plano gratuito)

Tempo estimado: 20 minutos. Tudo roda de `apps/worker`.

## 1. Conta e login

```bash
pnpm install
cd apps/worker
npx wrangler login
```

## 2. Banco e filas

```bash
npx wrangler d1 create ceu-db          # copie o database_id para wrangler.jsonc
npx wrangler queues create ceu-precompute
npx wrangler queues create ceu-send
pnpm db:migrate
```

## 3. Segredos

```bash
pnpm vapid                              # imprime a chave pública e a privada
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY   # o JSON inteiro, em uma linha
npx wrangler secret put ADMIN_TOKEN         # invente um valor longo e aleatório
```

Em `wrangler.jsonc`, troque `VAPID_SUBJECT` por um contato seu (`mailto:` ou URL).
Os serviços de push usam esse contato se houver problema com os seus envios.

Opcional, para receber avisos operacionais no Telegram: `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.

## 4. Publicar

```bash
pnpm --filter @ceu/web build
pnpm --filter @ceu/worker deploy
```

## 5. Primeira carga

O cron das 03h17 e 15h17 UTC faz isso sozinho. Para não esperar:

```bash
curl -X POST -H "authorization: Bearer SEU_ADMIN_TOKEN" https://SEU-APP.workers.dev/api/admin/refresh
curl https://SEU-APP.workers.dev/api/health
```

Se o CelesTrak recusar o IP da Cloudflare, suba os elementos à mão (plano B):

```bash
curl -X POST -H "authorization: Bearer SEU_ADMIN_TOKEN" -H "content-type: application/json" \
  --data @iss.json https://SEU-APP.workers.dev/api/admin/elements
curl -X POST -H "authorization: Bearer SEU_ADMIN_TOKEN" "https://SEU-APP.workers.dev/api/admin/refresh?skipFetch=1"
```

## 6. O que conferir na primeira semana

| Verificação | Como | Se falhar |
| --- | --- | --- |
| CPU das tarefas cabe em 10 ms | Painel da Cloudflare, Workers, métricas de CPU; procurar "Exceeded CPU" | Tarefa de meio dia, ou Workers Paid (US$ 5/mês) |
| CelesTrak aceita o IP | `/api/health` mostra `elementsAgeHours` baixo | Plano B acima, ou Space-Track |
| Open-Meteo responde | Decisões sem motivo `sem_previsao` | Implementar o provedor MET Norway (`src/weather.ts`) |
| Alerta chega no Android | Instalar, ativar, esperar uma passagem "Boa" | Ver logs do consumidor `ceu-send` |
| Alerta chega no iPhone | Adicionar à Tela de Início, ativar | Ver ADR 0004 |
| Horários conferem | 20 passagens contra o Heavens-Above | Abrir issue com os casos |

## Rodar localmente

```bash
cd apps/worker
printf 'VAPID_PUBLIC_KEY=...\nVAPID_PRIVATE_KEY=...\nADMIN_TOKEN=dev-token\n' > .dev.vars   # use `pnpm vapid`
pnpm db:migrate:local
pnpm --filter @ceu/web build
pnpm dev --test-scheduled
# carregar elementos reais e calcular:
curl -X POST -H "authorization: Bearer dev-token" -H "content-type: application/json" \
  --data @../../packages/sky-engine/test/fixtures/iss-2026-11-16.json localhost:8787/api/admin/elements
curl -X POST -H "authorization: Bearer dev-token" "localhost:8787/api/admin/refresh?skipFetch=1"
# disparar o cron de 1 minuto à mão:
curl "localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

Abra `localhost:8787/?demo=1` para ver as telas com uma passagem de exemplo.
