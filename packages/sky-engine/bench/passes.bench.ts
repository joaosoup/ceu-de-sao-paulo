// Mede o custo de CPU do pré-cálculo: 1 satélite, 1 célula, 1 dia e 10 dias.
// O plano gratuito da Cloudflare dá 10 ms de CPU por execução. Este número é do Node;
// repita dentro do Worker (wrangler dev / produção) antes de confiar nele.
import { findVisiblePasses } from "../src/index.js";
import { ISS_LIKE_SYNTHETIC, SAO_PAULO } from "../test/fixtures.js";

const from = new Date("2026-11-16T12:00:00Z");
for (const days of [1, 10]) {
  findVisiblePasses(ISS_LIKE_SYNTHETIC, SAO_PAULO, { from, days }); // aquecimento
  const runs = 20;
  const t0 = process.cpuUsage();
  for (let i = 0; i < runs; i++) findVisiblePasses(ISS_LIKE_SYNTHETIC, SAO_PAULO, { from: new Date(from.getTime() + i * 86_400_000), days });
  const cpu = process.cpuUsage(t0);
  console.log(`${days} dia(s): ${((cpu.user + cpu.system) / 1000 / runs).toFixed(2)} ms de CPU por execução`);
}
