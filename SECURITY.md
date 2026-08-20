# Security policy

## Supported versions

Shotluma is in early development and does not yet publish stable release branches.

| Version | Supported |
| --- | --- |
| Current `main` branch | Yes |
| Older commits and unofficial forks | No |

## Report a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's **Security** tab and choose **Report a vulnerability** to send the maintainers a private report. If private vulnerability reporting is not available, open a public issue containing only a request for private contact. Do not include exploit details, secrets, private screenshots, or personal data in that issue.

Include as much of the following as possible in the private report:

- Affected commit or version.
- Impact and realistic attack scenario.
- Reproduction steps or a minimal proof of concept.
- Browsers and operating systems tested.
- Suggested mitigation, if known.
- Whether the issue has been disclosed elsewhere.

Maintainers will acknowledge reports and coordinate a fix and disclosure on a best-effort basis. Please allow a reasonable remediation window before public disclosure.

## Security boundaries

- AI provider keys are entered in the browser and stored unencrypted in `localStorage`, or optionally supplied through `VITE_*` variables to the local development server. They are accessible to same-origin JavaScript, so use dedicated keys with restrictive quotas and remove them on shared browser profiles.
- `.env.local` is ignored by Git and must remain untracked.
- Production builds replace provider env keys with empty values. Do not remove this build boundary or publish a manually altered keyed bundle.
- Uploaded images and projects stay in IndexedDB during normal editing.
- Screenshots selected for an AI run are sent to the selected provider. Google, Qwen, OpenAI, Anthropic, and xAI are contacted directly; Moonshot works only on localhost through the same-origin local CORS proxy. OpenCode Zen and Go use the same-origin `/api/opencode` proxy. Opt-in overlay generation contacts OpenAI separately.
- Users are responsible for protecting provider keys and usage quotas.
- A hosted deployment can use browser-entered keys with the direct providers and OpenCode. A deployment that supplies shared credentials or offers Moonshot requires a separate authenticated backend design.

If a key is accidentally exposed, revoke it at the provider immediately, remove it from the current files, and treat it as compromised even if the Git commit is later rewritten.
