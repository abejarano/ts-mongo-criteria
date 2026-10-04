/**
 * semantic-release configuration.
 *
 * This file exists to fix two independent bugs that were preventing releases.
 *
 * ---------------------------------------------------------------------------
 * 1. The config was not being read at all
 * ---------------------------------------------------------------------------
 * It used to live in `releaserc.json` — note the missing leading dot. cosmiconfig
 * (used by semantic-release) only looks for `.releaserc.json`, so that file was
 * silently ignored and semantic-release ran with its built-in defaults:
 *
 *   @semantic-release/commit-analyzer
 *   @semantic-release/release-notes-generator
 *   @semantic-release/npm
 *   @semantic-release/github
 *
 * That is why the plugins declared there (`@semantic-release/changelog` and
 * `@semantic-release/git`) never ran: no `chore(release): x.y.z` commit has
 * landed on main since 1.2.1, while tags/npm went on to 1.11.3.
 *
 * `release.config.cjs` IS a recognized name, so the config is picked up again.
 *
 * ---------------------------------------------------------------------------
 * 2. `feat!:` was invisible to the default preset
 * ---------------------------------------------------------------------------
 * The default `conventional-changelog-angular` preset does not understand the
 * Conventional Commits `!` shorthand. Its parser only defines
 *
 *   headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/   // note: no `!?`
 *   noteKeywords:  ['BREAKING CHANGE']
 *
 * and no `breakingHeaderPattern`. So `feat!: ...` never matched the header, was
 * parsed as a non-conventional commit, and triggered NO release — not even the
 * `feat` minor. Only a `BREAKING CHANGE:` footer was detected.
 *
 * `parserOpts` is merged over the preset parser options (see
 * @semantic-release/commit-analyzer/lib/load-parser-config.js), so this restores:
 *   feat!: ...            -> major
 *   feat(scope)!: ...     -> major
 *   BREAKING-CHANGE: ...  -> major (alias)
 * RegExp literals are also why this file cannot be JSON.
 *
 * ---------------------------------------------------------------------------
 * 3. Why `@semantic-release/changelog` and `@semantic-release/git` are NOT here
 * ---------------------------------------------------------------------------
 * The `develop-main` ruleset protects main with `pull_request` +
 * `non_fast_forward` and declares NO bypass actors, so nothing can push directly
 * to main — not even the Actions bot.
 *
 * `@semantic-release/git` commits CHANGELOG.md/package.json and pushes them in
 * its `prepare` hook, which runs BEFORE `publish`:
 *
 *   await plugins.prepare(context)   // git commit + push -> rejected by ruleset
 *   await tag(nextRelease.gitTag)    // never reached
 *   await plugins.publish(context)   // npm publish never reached
 *
 * A rejected push therefore aborts the whole release: no tag, no npm publish.
 * Re-adding those two plugins would break releases again, so the config keeps
 * the default plugin set only. Release notes live in the GitHub Release; the
 * published version lives on npm.
 *
 * If the version bump and CHANGELOG.md must be committed in the repo, add a
 * bypass actor to the ruleset for the GitHub Actions app and then reintroduce
 * `@semantic-release/changelog` + `@semantic-release/git` here.
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
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        pkgRoot: ".",
      },
    ],
    "@semantic-release/github",
  ],
}
