# ADR 0002: Cálculo por célula geográfica

Data: 2026-11-16. Estado: aceito, com hipótese aberta.

Eventos são calculados por célula de 0,25° (~28 km), não por usuário. O aparelho arredonda a posição;
o servidor só guarda o id da célula. A grade da Grande São Paulo é fixa e calculada inteira, para que
nada revele onde há inscritos.

Hipótese a medir com dados reais: diferença entre centro e borda da célula.
Se passar de 5° de elevação ou 20 s de horário, reduzir para 0,1°.
