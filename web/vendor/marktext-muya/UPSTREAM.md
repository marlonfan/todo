# Vendored MarkText Muya

This package vendors the editor core used by MarkText so the app does not depend on the archived standalone `marktext/muya` repository at runtime.

- Upstream repository: https://github.com/marktext/marktext
- Upstream package path: `packages/muya`
- Upstream commit: `0d7bf91ddee4c878ad46c287fad4726c54727b9d`
- Runtime import used by this app: `@todo/vendor-marktext-muya`

## Updating

Run from `web/`:

```sh
node ./scripts/updateMarktextMuya.mjs
```

To pin a specific upstream commit:

```sh
node ./scripts/updateMarktextMuya.mjs 0d7bf91ddee4c878ad46c287fad4726c54727b9d
```

The script pulls `marktext/marktext`, builds `packages/muya`, and replaces this package's `lib/` output. Review the resulting diff before committing.
