import { createDecipheriv, createECDH, createHmac, createPublicKey, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildNotificationPayload } from "../src/send.js";
import { buildPushRequest, vapidPublicKeyFromJwk } from "../src/webpush.js";

// Prova de que o que enviamos é decifrável por um navegador: fazemos o papel do navegador
// e deciframos a mensagem conforme a RFC 8291 (aes128gcm) com a chave privada da inscrição.
const b64u = (b: Buffer) => b.toString("base64url");
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, len: number) => {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);
};

function decryptAes128gcm(body: Buffer, uaPrivate: ReturnType<typeof createECDH>, uaPublic: Buffer, authSecret: Buffer): string {
  const salt = body.subarray(0, 16);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const ciphertext = body.subarray(21 + idLen);
  const ecdhSecret = uaPrivate.computeSecret(asPublic);
  const ikm = hkdf(authSecret, ecdhSecret, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString("utf8"); // tira o delimitador de padding
}

describe("web push de ponta a ponta (criptografia)", () => {
  it("o navegador consegue decifrar o alerta e ele chega no formato do service worker do Angular", async () => {
    const vapid = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "jwk" });
    const ua = createECDH("prime256v1");
    const uaPublic = ua.generateKeys();
    const auth = randomBytes(16);

    const payload = buildNotificationPayload({
      event_id: "0.25:265:533|25544|2026-11-16T22:44",
      starts_at: Date.parse("2026-11-16T22:42:00Z"),
      peak_at: Date.parse("2026-11-16T22:44:00Z"),
      payload: JSON.stringify({ kind: "pass", objectName: "ISS", start: { az: 315, el: 10 }, peak: { az: 0, el: 78 }, end: { az: 120, el: 30 }, durationSeconds: 240, magnitude: -3.4, startsInShadow: false, endsInShadow: true }),
      quality_index: 85,
      clouds: "{}",
    });
    const req = await buildPushRequest(
      { endpoint: "https://fcm.googleapis.com/fcm/send/teste", p256dh: b64u(uaPublic), auth: b64u(auth) },
      payload,
      { vapidPrivateJwk: vapid as JsonWebKey, subject: "mailto:teste@example.com", ttlSeconds: 300, urgency: "high" },
    );

    expect(req.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(req.headers.TTL).toBe("300");

    // VAPID (RFC 8292): o serviço de push confere a assinatura com a chave pública enviada em k=
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(req.headers.Authorization!);
    expect(m).not.toBeNull();
    const [h, c, sig] = m![1]!.split(".") as [string, string, string];
    expect(m![2]).toBe(vapidPublicKeyFromJwk(vapid as JsonWebKey));
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:teste@example.com");
    expect(claims.exp - Date.now() / 1000).toBeLessThanOrEqual(24 * 3600);
    const pub = createPublicKey({ key: { kty: "EC", crv: "P-256", x: vapid.x, y: vapid.y }, format: "jwk" });
    expect(createVerify("SHA256").update(`${h}.${c}`).verify({ key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(sig, "base64url"))).toBe(true);

    const decoded = JSON.parse(decryptAes128gcm(Buffer.from(req.body), ua, uaPublic, auth));
    expect(decoded.notification.title).toBe("ISS às 19h42");
    expect(decoded.notification.body).toContain("Chance ótima de céu aberto");
    expect(decoded.notification.data.onActionClick.default.operation).toBe("navigateLastFocusedOrOpen");
    expect(decoded.notification.data.url).toMatch(/^\/evento\//);
  });
});
