---
hinagata:
  theme: docs-clean
  output: fragment
---

# Password reset runbook

Use this runbook when a team member cannot sign in and the identity provider
shows a locked account state. The generated HTML is intended for an internal
knowledge base where steps need to be easy to scan.

## Prerequisites

- Confirm the request came from the account owner.
- Check that the user has completed multi-factor authentication.
- Keep the support ticket open until the user signs in successfully.

## Procedure

1. Open the identity provider admin console.
2. Search for the user by email address.
3. Select **Reset password** and require a password change at next sign-in.
4. Add the ticket ID to the account activity note.

### Audit fields

- Ticket ID
- Operator name
- Reset timestamp

## Escalation note

> If the account is locked again within 15 minutes, stop the reset flow and
> escalate to the security queue.

## CLI check

```sh
hinagata account audit user@example.com --last 24h
```
