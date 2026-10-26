---
description: Inspect code changes, author affected API annotations, regenerate documentation and verify.
agent: documentation-updater
---

# Update documentation from code changes

Follow the complete workflow in
[documentation-updater](../agents/documentation-updater.agent.md).

Inspect staged, unstaged and new source files, trace changes through handlers,
services and validators to the affected endpoints, and edit their annotations
from implementation evidence. **A passing `docs:check` is not a stopping
condition**: existing annotations may be semantically stale.

If a base branch/commit is supplied, use it for comparison. If no working-tree
changes exist and no base or endpoint is specified, ask for the intended scope.
Do not invent changes or endpoint behaviour.

Regenerate with `npm run docs:sync`, run `npm run verify`, inspect the output
diff and report the exact behaviour now reflected in the documentation.
Preserve developer changes; never commit or push without permission.
