# Security policy

Do not report suspected vulnerabilities in a public issue, discussion, log excerpt, or pull request.

Use [GitHub's private vulnerability reporting form](https://github.com/maeek/rebroid/security/advisories/new) and
include the affected version or commit, deployment assumptions, reproduction steps, impact, and any suggested
mitigation. Remove credentials, tokens, private APKs, container data, and unrelated personal information from the
report.

The maintainers will acknowledge a complete report, investigate it privately, coordinate a fix and disclosure when
appropriate, and credit reporters who request attribution. There is currently no guaranteed response-time SLA.

Security-sensitive areas include authentication and permissions, secrets, uploads and archive extraction, Docker and
host operations, ADB/scrcpy control, firewall policy, filesystem paths, provider requests, and generated API contracts.
Only the latest repository state is supported while the project remains pre-release.
