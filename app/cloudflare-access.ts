import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export async function isOwnerAccessRequest(): Promise<boolean> {
  const audience = process.env.CODEFORM_ACCESS_AUD;
  const teamDomain = process.env.CODEFORM_ACCESS_TEAM_DOMAIN;
  const ownerEmail = process.env.CODEFORM_OWNER_EMAIL;
  if (!audience || !teamDomain || !ownerEmail) return false;

  const requestHeaders = await headers();
  const token = requestHeaders.get("cf-access-jwt-assertion");
  if (!token) return false;

  try {
    const jwks = createRemoteJWKSet(
      new URL("/cdn-cgi/access/certs", teamDomain),
    );
    const { payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience,
    });
    return typeof payload.email === "string" &&
      payload.email.toLowerCase() === ownerEmail.toLowerCase();
  } catch {
    return false;
  }
}
