# O Céu de São Paulo

PWA que avisa quando há algo para ver no céu de São Paulo: passagens visíveis da ISS, Lua e eclipses.
Filosofia: usar a tecnologia para tirar as pessoas da tela.

Plano técnico e de produto: https://claude.ai/artifact/6HT13WxMtRRaFUngv5LW3u

## Estrutura

| Pasta | O que é | Estado |
| --- | --- | --- |
| `packages/sky-engine` | Núcleo de cálculo, sem rede nem banco | Pronto; passagens conferidas ao minuto com fonte externa |
| `apps/worker` | Cloudflare Worker: API, crons, filas, web push | Pronto e testado localmente; falta publicar |
| `apps/web` | PWA em Angular | Pronta; falta testar alertas em aparelhos reais |
| `docs/adr/` | Decisões de arquitetura | 4 registradas |
| `docs/DEPLOY.md` | Passo a passo para colocar no ar | |

## Rodar

```bash
pnpm install
pnpm test        # 22 testes do núcleo + 18 do Worker
pnpm --filter @ceu/web build
```

Para subir tudo localmente e para publicar, veja `docs/DEPLOY.md`.

## Pendências (nenhuma se resolve só com código)

1. Publicar na Cloudflare e medir a CPU real das tarefas (ADR 0003).
2. Receber um alerta de verdade em um Android e em um iPhone (ADR 0004).
3. Conferir 20 passagens ao segundo com o Heavens-Above (hoje: 2, ao minuto).
4. Confirmar na prática as chamadas ao CelesTrak e ao Open-Meteo a partir da Cloudflare.
5. Limite de requisições por IP na criação de inscrições (hoje há só validação de entrada).
6. Medir o erro entre centro e borda da célula (ADR 0002).
