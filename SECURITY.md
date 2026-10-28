# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue. Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/ashvolt/replayguard/security/advisories/new).
We aim to acknowledge reports within 3 business days and to ship a fix or mitigation within 30
days for high and critical issues.

## Supported versions

Security fixes go to the latest minor release of each published package.

## Our supply-chain posture

- Dependencies must be at least 7 days old before install (pnpm `minimumReleaseAge`). Install
  scripts are denied by default (`allowBuilds`).
- OSV-Scanner, CodeQL (security-extended) and gitleaks run on every pull request and on a
  schedule.
- GitHub Actions are pinned to commit SHAs and run with least-privilege permissions.
- Releases are published from signed tags through npm trusted publishing (OIDC). There is no
  long-lived npm token. Each release has a provenance attestation and a CycloneDX SBOM.
- The library makes no network calls, sends no telemetry and never uses `eval`. HTML reports are
  self-contained, with escaped data and a strict Content Security Policy.
