import { createHmac, createPrivateKey, createPublicKey, createSign, createVerify, randomBytes } from "node:crypto";

type Provider = "google" | "apple";
const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const secret = () => process.env.AUTH_SECRET?.trim();

export function oauthConfigured(provider: Provider) {
  if (!secret()) return false;
  return provider === "google"
    ? Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    : Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}
export function signedState(provider: Provider) {
  const payload = b64(JSON.stringify({ provider, nonce: randomBytes(18).toString("base64url"), expires: Date.now() + 10 * 60_000 }));
  return `${payload}.${createHmac("sha256", secret()!).update(payload).digest("base64url")}`;
}
export function readState(value: string, provider: Provider) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || createHmac("sha256", secret()!).update(payload).digest("base64url") !== signature) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { provider: Provider; nonce: string; expires: number };
  return parsed.provider === provider && parsed.expires > Date.now() ? parsed : null;
}
export function authorizationUrl(provider: Provider, origin: string) {
  const state = signedState(provider);
  const callback = `${origin}/api/auth/oauth/${provider}`;
  if (provider === "google") {
    const query = new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, redirect_uri: callback, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  }
  const nonce = readState(state, provider)!.nonce;
  const query = new URLSearchParams({ client_id: process.env.APPLE_CLIENT_ID!, redirect_uri: callback, response_type: "code", response_mode: "form_post", scope: "name email", state, nonce });
  return `https://appleid.apple.com/auth/authorize?${query}`;
}

function appleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "ES256", kid: process.env.APPLE_KEY_ID! }));
  const payload = b64(JSON.stringify({ iss: process.env.APPLE_TEAM_ID!, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: process.env.APPLE_CLIENT_ID! }));
  const input = `${header}.${payload}`;
  const signer = createSign("SHA256"); signer.update(input); signer.end();
  const key = createPrivateKey(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  return `${input}.${signer.sign({ key, dsaEncoding: "ieee-p1363" }, "base64url")}`;
}
async function verifiedAppleClaims(idToken: string, expectedNonce: string) {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Apple returned an invalid identity token.");
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as { kid: string; alg: string };
  const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as { sub: string; email?: string; aud: string; iss: string; exp: number; nonce?: string };
  const keys = await fetch("https://appleid.apple.com/auth/keys").then((response) => response.json()) as { keys: Array<JsonWebKey & { kid: string }> };
  const jwk = keys.keys.find((key) => key.kid === header.kid);
  if (!jwk || header.alg !== "ES256") throw new Error("Apple signing key was unavailable.");
  const verifier = createVerify("SHA256"); verifier.update(`${headerPart}.${payloadPart}`); verifier.end();
  const valid = verifier.verify({ key: createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(signaturePart, "base64url"));
  if (!valid || claims.iss !== "https://appleid.apple.com" || claims.aud !== process.env.APPLE_CLIENT_ID || claims.exp * 1000 <= Date.now() || claims.nonce !== expectedNonce) throw new Error("Apple identity validation failed.");
  return claims;
}
export async function exchangeOAuth(provider: Provider, code: string, origin: string, state: string, suppliedName?: string) {
  const stateData = readState(state, provider);
  if (!stateData) throw new Error("The sign-in request expired. Please try again.");
  const redirectUri = `${origin}/api/auth/oauth/${provider}`;
  if (provider === "google") {
    const token = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    if (!token.ok) throw new Error("Google could not complete sign in.");
    const { access_token } = await token.json() as { access_token: string };
    const profile = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
    if (!profile.ok) throw new Error("Google profile access failed.");
    const data = await profile.json() as { sub: string; email: string; name: string; picture?: string; email_verified?: boolean };
    if (!data.email_verified) throw new Error("Google email is not verified.");
    return { provider, subject: data.sub, email: data.email, name: data.name, avatarUrl: data.picture };
  }
  const token = await fetch("https://appleid.apple.com/auth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.APPLE_CLIENT_ID!, client_secret: appleClientSecret(), redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  if (!token.ok) throw new Error("Apple could not complete sign in.");
  const { id_token } = await token.json() as { id_token: string };
  const claims = await verifiedAppleClaims(id_token, stateData.nonce);
  if (!claims.email) throw new Error("Apple did not provide an email address.");
  return { provider, subject: claims.sub, email: claims.email, name: suppliedName || claims.email.split("@")[0]! };
}
