# ADR 0001: Stack

Data: 2026-11-16. Estado: aceito.

- TypeScript em tudo; núcleo de cálculo isolado em `packages/sky-engine` (satellite.js + astronomy-engine, MIT).
- PWA em Angular. Cloudflare Workers + D1 + Queues no plano gratuito.
- Código no GitHub. GitHub Actions só para CI, não como parte do serviço (os termos vetam uso como aplicação serverless).

Rever se: a CPU medida na Cloudflare não couber em 10 ms por tarefa (ver ADR 0003) -> Workers Paid, US$ 5/mês.
