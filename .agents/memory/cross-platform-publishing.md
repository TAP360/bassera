---
name: Cross-platform publishing
description: Dependency pruning must support both Linux development and macOS iOS publishing.
---

Treat this workspace as supporting Linux development and macOS build hosts. Do not optimize dependency installation for Linux by excluding macOS native packages.

**Why:** App Store publishing runs on macOS, outside the Linux workspace. Successful local production JavaScript bundling is not proof that the remote archive will succeed. The retained Metro failure logs may show only a secondary transformer error rather than the original initialization failure.

**How to apply:** Preserve macOS optional dependencies when pruning platform packages. Verify release bundling locally, but distinguish that check from a successful remote iOS archive and App Store submission.
