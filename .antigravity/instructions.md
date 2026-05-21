# Antigravity Developer Instructions

These guidelines ensure high codebase maintainability and alignment with Everything-Claude-Code (ECC) engineering standards.

## Code Standards
- **Function Length:** Keep functions strictly under 50 lines. Extract single-responsibility utility functions if logic becomes bloated.
- **File Length:** No file should exceed 800 lines of code. Split complex controllers into smaller domain helpers.
- **Logical Nesting:** Maximum of 4 levels of structural nesting (`if`, `for`, callbacks). Utilize guard clauses (`if (!cond) return`) to flatten hierarchy.
- **Immutability:** Do not mutate objects or arrays directly. When updating state, return a shallow/deep clone:
  ```js
  const updatedState = { ...state, key: newValue };
  ```
- **Error Propagation:** Always throw or handle errors explicitly. Never wrap blocks in silent try-catch constructs. Ensure thrown errors carry precise code identifiers.
