/**
 * Web Push padrão, só com Web Crypto (roda em Workers, Node 20+ e navegadores):
 *   - RFC 8291: criptografia da mensagem (aes128gcm)
 *   - RFC 8292: identificação do servidor (VAPID)
 * Escrito aqui porque a biblioteca avaliada no plano (PushForge) usa a codificação antiga
 * "aesgcm", anterior à RFC. O teste test/push-crypto.test.ts decifra a saída como um navegador.
 */
export interface PushTarget {
  endpoint: string;
  p256dh: string; // chave pública do navegador, base64url
  auth: string; // segredo de autenticação, base64url
}

export interface PushRequest {
  endpoint: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

const enc = new TextEncoder();

export function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** Chave pública VAPID (65 bytes, ponto não comprimido) a partir do JWK privado. */
export function vapidPublicKeyFromJwk(jwk: JsonWebKey): string {
  if (!jwk.x || !jwk.y) throw new Error("JWK VAPID sem x/y");
  return b64urlEncode(concat(new Uint8Array([4]), b64urlDecode(jwk.x), b64urlDecode(jwk.y)));
}

// O token VAPID vale por serviço de push (origem). Reusar poupa uma assinatura por mensagem.
const jwtCache = new Map<string, { token: string; exp: number }>();

async function vapidAuthorization(endpoint: string, privateJwk: JsonWebKey, subject: string, nowSec: number): Promise<string> {
  const aud = new URL(endpoint).origin;
  const cacheKey = `${aud}|${privateJwk.x}`;
  let entry = jwtCache.get(cacheKey);
  if (!entry || entry.exp - nowSec < 600) {
    const exp = nowSec + 12 * 3600; // a RFC permite até 24 h
    const unsigned = `${b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })))}.${b64urlEncode(enc.encode(JSON.stringify({ aud, exp, sub: subject })))}`;
    const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned));
    entry = { token: `${unsigned}.${b64urlEncode(sig)}`, exp };
    jwtCache.set(cacheKey, entry);
  }
  return `vapid t=${entry.token}, k=${vapidPublicKeyFromJwk(privateJwk)}`;
}

export async function encryptPayload(plaintext: Uint8Array, target: Pick<PushTarget, "p256dh" | "auth">): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(target.p256dh);
  const authSecret = b64urlDecode(target.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("Chaves da inscrição com tamanho inválido");

  const asKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", asKeys.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    // "$public" é o nome do campo no runtime da Cloudflare; "public" é o padrão. Os dois são aceitos.
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey, $public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, asKeys.privateKey, 256),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));

  // cabeçalho: salt(16) | tamanho do registro(4) | tamanho da chave(1) | chave pública do servidor(65)
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

export async function buildPushRequest(
  target: PushTarget,
  payload: unknown,
  opts: { vapidPrivateJwk: JsonWebKey; subject: string; ttlSeconds: number; urgency?: "very-low" | "low" | "normal" | "high"; nowMs?: number },
): Promise<PushRequest> {
  const plaintext = enc.encode(JSON.stringify(payload));
  if (plaintext.length > 3900) throw new Error("Mensagem grande demais para um push");
  const body = await encryptPayload(plaintext, target);
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  return {
    endpoint: target.endpoint,
    body,
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(Math.max(0, Math.round(opts.ttlSeconds))),
      Urgency: opts.urgency ?? "normal",
      Authorization: await vapidAuthorization(target.endpoint, opts.vapidPrivateJwk, opts.subject, nowSec),
    },
  };
}

/** Gera um par VAPID novo (uso: scripts/generate-vapid.ts). */
export async function generateVapidKeys(): Promise<{ privateJwk: JsonWebKey; publicKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { privateJwk, publicKey: vapidPublicKeyFromJwk(privateJwk) };
}
