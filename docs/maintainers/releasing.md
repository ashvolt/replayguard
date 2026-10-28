# Releasing

Publishing only ever happens from **signed tags**. No long-lived npm token exists anywhere.

## One-time setup

1. **npm:** create the `replayguard` package and the `@replayguard` org. For each package, add a
   *trusted publisher* that points at `ashvolt/replayguard`, workflow `release.yml`, environment
   `npm`.
2. **GitHub:** create the `npm` environment and require maintainer approval on it. Protect `main`:
   require the CI, Security and Docs checks and a review from CODEOWNERS.
3. **Signing:** configure a signing key with `git config user.signingkey …` and
   `git config tag.gpgSign true`, then upload the public key to GitHub so tags show as verified.

## Each release

1. Merge PRs that include changesets. `version.yml` keeps a **"chore: version packages"** PR up to
   date.
2. Review that PR, which contains the version bumps and changelogs, and merge it.
3. Tag the merge commit with a signed tag and push it:

   ```sh
   git pull origin main
   git tag -s v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

4. `release.yml` then does the following:
   1. Checks through the GitHub API that the tag is annotated and its signature is verified.
   2. Builds and tests.
   3. Packs every public package.
   4. Generates a CycloneDX SBOM with Syft.
   5. Publishes with `NPM_CONFIG_PROVENANCE=true` through OIDC.
   6. Creates the GitHub release with the tarballs and the SBOM attached.

## Dry run

Run the **Release** workflow manually with `dry-run: true`. It builds, packs and generates SBOMs
without publishing.
