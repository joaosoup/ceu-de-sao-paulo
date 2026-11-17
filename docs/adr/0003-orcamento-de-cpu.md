# ADR 0003: Orçamento de CPU do pré-cálculo

Data: 2026-11-16. Estado: aceito, medição na Cloudflare pendente.

Limite do plano gratuito: 10 ms de CPU por execução. Medido no Node 22 (`pnpm bench`), 1 satélite e 1 célula:

| Janela | CPU por execução |
| --- | --- |
| 1 dia | ~4,4 ms |
| 10 dias | ~22 ms |

Decisão: uma tarefa de fila = 1 célula x 1 dia x 1 satélite. A margem é pequena (menos da metade do limite),
e o runtime da Cloudflare pode ser mais lento que o Node.

Otimizações já feitas: varredura grossa de 60 s e fina de 5 s só nas janelas candidatas; Sol calculado nas
pontas da janela e interpolado. Próximas, se precisar: tarefa de meio dia; passo grosso de 90 s.
