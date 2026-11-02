# Releasing

Versions follow [Semantic Versioning](https://semver.org/): a new key or
behavior is a minor release, a fix (including for a Slack markup change) is a
patch, and a changed or removed key is a major release (minor while at 0.x).

1. Move the `## [Unreleased]` entries in `CHANGELOG.md` under a new
   `## [X.Y.Z] - YYYY-MM-DD` heading and update the compare links at the bottom.
2. Set `"version": "X.Y.Z"` in `extension/manifest.json`.
3. Run `tests/behaviors.js` in a Slack channel and on a search page.
4. Commit (`Release X.Y.Z`), then tag and push:

   ```sh
   git tag -a vX.Y.Z -m "slack-vim X.Y.Z"
   git push origin main vX.Y.Z
   ```

The `release` workflow then checks that the tag matches the manifest, packages
`extension/` as `slack-vim-X.Y.Z.zip` with a SHA-256 checksum and a signed
build provenance attestation, and publishes a GitHub release with that
version's CHANGELOG section as its notes.

## Pre-releases

Chrome's `version` allows only numbers, so a beta keeps `"version": "X.Y.Z"`
and adds `"version_name": "X.Y.Z-beta.N"` (shown in `chrome://extensions`).
The CHANGELOG heading and the tag use the full name (`vX.Y.Z-beta.N`), and the
release is marked as a pre-release. Drop `version_name` for the final release.

## Verifying a download

To check a downloaded zip came from this repo's workflow:

```sh
gh attestation verify slack-vim-X.Y.Z.zip --repo sandeshghanta/slack-vim
```
