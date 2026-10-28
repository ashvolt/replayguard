/**
 * Base64 SHA-256 of a UTF-8 string, as used in CSP source hashes.
 *
 * @example
 * await sha256Base64("abc"); // "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0="
 */
export async function sha256Base64(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/**
 * Content security policy allowing only the given inline style and script.
 *
 * @example
 * await contentSecurityPolicy(STYLES, FILTER_SCRIPT);
 */
export async function contentSecurityPolicy(style: string, script: string): Promise<string> {
	return [
		"default-src 'none'",
		`style-src 'sha256-${await sha256Base64(style)}'`,
		`script-src 'sha256-${await sha256Base64(script)}'`,
		"img-src data:",
		"base-uri 'none'",
		"form-action 'none'",
	].join("; ");
}
