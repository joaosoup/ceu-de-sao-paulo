// Gera as chaves VAPID. Rode UMA vez: `pnpm --filter @ceu/worker vapid`.
// A chave privada nunca vai para o repositório: guarde com `wrangler secret put`.
import { generateVapidKeys } from "../src/webpush.js";

const { privateJwk, publicKey } = await generateVapidKeys();
console.log("VAPID_PUBLIC_KEY (pública, vai para o navegador):\n" + publicKey + "\n");
console.log("VAPID_PRIVATE_KEY (SEGREDO, JSON em uma linha):\n" + JSON.stringify(privateJwk));
