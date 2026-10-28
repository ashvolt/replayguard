#!/bin/sh
# Pre-commit secret scan of staged changes. CI runs a full-history scan regardless.
if command -v gitleaks >/dev/null 2>&1; then
	exec gitleaks git --pre-commit --staged --redact --no-banner
fi
echo "warning: gitleaks not installed locally; the CI secret scan still runs" >&2
