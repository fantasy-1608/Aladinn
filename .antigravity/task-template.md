# Task Execution Checklist Template

For each coding task, utilize this template to maintain alignment with the codebase safety boundaries:

- `[ ]` **Planning & Context Analysis**
    - `[ ]` Run GitNexus impact analysis on target files.
    - `[ ]` Verify relevant clinical structures.
- `[ ]` **Test-Driven Design (TDD)**
    - `[ ]` Write mock tests that fail under initial codebase state.
    - `[ ]` Establish coverage targets (90%+ for high-risk modules).
- `[ ]` **Minimal Code Implementation**
    - `[ ]` Write immutability-safe modifications conforming to instruction boundaries.
    - `[ ]` Handle all boundary errors explicitly.
- `[ ]` **Verify & Build Gates**
    - `[ ]` Run `pnpm run lint` and verify 0 errors.
    - `[ ]` Run `pnpm run test` to verify zero regressions.
    - `[ ]` Run `pnpm run build` to confirm extension packaging compatibility.
