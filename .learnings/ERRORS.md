# Errors Log

Command failures, exceptions, and unexpected behaviors.

## [ERR-20260315-001] search-command

**Logged**: 2026-03-15T17:24:37+08:00
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
`rg` is not installed in this workspace shell, so repository/process searches must fall back to `grep`.

### Error
```text
/bin/bash: line 1: rg: command not found
```

### Context
- Command attempted: `ps -ef | rg 'node src/index.js|npm run dev|codex-bridge|src/index.js'`
- Environment: `/home/jingqi/workspace/codex-bridge` shell session on 2026-03-15

### Suggested Fix
Check for `rg` before using it in shell commands, or standardize the environment to include ripgrep.

### Metadata
- Reproducible: yes
- Related Files: AGENTS.md

---

---
