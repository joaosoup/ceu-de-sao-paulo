# O Céu de São Paulo

PWA que avisa quando há algo para ver no céu de São Paulo: passagens visíveis da ISS, Lua e eclipses.
Filosofia: usar a tecnologia para tirar as pessoas da tela.

Plano técnico e de produto: https://claude.ai/artifact/6HT13WxMtRRaFUngv5LW3u

## Estrutura

| Pasta | O que é | Estado |
| --- | --- | --- |
| `packages/sky-engine` | Núcleo de cálculo, sem rede nem banco | Pronto (v0.1), falta validar com dados reais |
| `apps/worker` | Cloudflare Worker: API, cron e filas | A fazer (semanas 3 e 4) |
| `apps/web` | PWA em Angular | A fazer (semanas 3 a 6) |
| `data/` | Tabelas fixas (municípios, chuvas de meteoros) | A fazer |
| `docs/adr/` | Decisões de arquitetura | 3 registradas |

## Rodar

```bash
pnpm install
pnpm test        # 21 testes do núcleo
pnpm typecheck
pnpm --filter @ceu/sky-engine bench   # custo de CPU do pré-cálculo
```

## Pendências antes de confiar nos horários

1. Ampliar a conferência com dados reais (hoje: 2 passagens, ao minuto) para 20 passagens, ao segundo,
   com uma fonte externa (ver `packages/sky-engine/test/README.md`).
2. Repetir o benchmark dentro do runtime da Cloudflare (ADR 0003).
3. Medir o erro entre centro e borda da célula (ADR 0002).
