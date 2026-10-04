/**
 * semantic-release configuration.
 *
 * Why a JS config instead of `releaserc.json`:
 * the default `conventional-changelog-angular` preset does NOT understand the
 * Conventional Commits `!` shorthand. Its parser only defines
 *
 *   headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/   // note: no `!?`
 *   noteKeywords:  ['BREAKING CHANGE']
 *
 * and no `breakingHeaderPattern` at all. So a header like `feat!: ...` fails to
 * match, is parsed as a non-conventional commit, and triggers NO release — not
 * even the `feat` minor. Only a `BREAKING CHANGE:` footer was being detected.
 *
 * `parserOpts` is merged over the preset parser options (see
 * @semantic-release/commit-analyzer/lib/load-parser-config.js), so adding the
 * shorthand here keeps everything else and restores:
 *   feat!: ...            -> major
 *   feat(scope)!: ...     -> major
 *   BREAKING-CHANGE: ...  -> major (alias)
 *
 * This mirrors what the `conventionalcommits` preset does. RegExp literals are
 * the reason this file cannot be JSON.
 */
const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
}

module.exports = {
  branches: ["main", "master"],
  plugins: [
    ["@semantic-release/commit-analyzer", { parserOpts }],
    ["@semantic-release/release-notes-generator", { parserOpts }],
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        pkgRoot: ".",
      },
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
}
