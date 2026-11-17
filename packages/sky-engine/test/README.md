# Testes do sky-engine

- `astro.test.ts`: casos REAIS com resposta conhecida (eclipse de 06/02/2027, Lua cheia de 24/11/2026).
- `passes.test.ts`: usa uma órbita SINTÉTICA. Testa invariantes (escuro, iluminado, elevação), não horários.

## Como criar os casos de referência reais (pendente)

1. Baixe os elementos da ISS uma única vez (a CelesTrak pede CSV e um download por ciclo de 2 h):
   `https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json`
   Salve em `test/fixtures/iss-AAAA-MM-DD.json`.
2. No mesmo dia, anote 20 passagens visíveis para São Paulo numa fonte externa (Heavens-Above, por exemplo):
   início, máximo, fim, elevação máxima.
3. Crie `test/golden-passes.test.ts` comparando com `findVisiblePasses`.
   Critério do plano: horário com erro de até 30 s, elevação de até 2°.
