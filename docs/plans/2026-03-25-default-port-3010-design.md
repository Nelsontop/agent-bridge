# Default Port 3010 Design

## Goal

Unify the repository's declared default service port to `3010` so runtime defaults,
setup guidance, and health-check examples match the way this service is actually started locally.

## Scope

- Change the runtime default port from `3000` to `3010`.
- Change setup wizard defaults and checklist text to `3010`.
- Change README examples and health-check snippets to `3010`.
- Update tests that assert the previous `3000` default.

## Non-Goals

- Do not change user-provided `.env` overrides.
- Do not rewrite historical planning documents unless they are actively used by the product.
- Do not change unrelated ports in vendored dependencies or generated output.

## Approach

Use a single repository-wide default of `3010` in source-controlled runtime defaults and docs.
Environment overrides continue to win, so existing custom deployments remain unaffected.

## Risks

- Tests can still encode `3000` assumptions and fail after the runtime default changes.
- Docs can become inconsistent if setup wizard text and README are not updated together.

## Validation

- Run targeted Node tests for config and setup guidance.
- Restart the installed service.
- Verify `http://127.0.0.1:3010/healthz` returns success.
