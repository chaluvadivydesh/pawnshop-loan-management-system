# Project Rules & Working Memory

## Core Principles (Applies to ALL prompts automatically)
- **Implicit Preservation**: Assume by default for every prompt that existing financial calculation formulas, interest engines, 360-day calendar logic, core business workflows, and UI layouts MUST be preserved intact. The user will NOT repeat these constraints in future prompts.

## Protocol for Changes & Fixes
1. **Direct Implementation**:
   - If a bug fix or feature request can be fulfilled without altering or removing pre-existing features, UI layouts, calculation engine logic, or synchronization rules, proceed directly with implementation.

2. **Permission Required for Core Modifications**:
   - If a request or bug fix requires altering existing financial calculations, modifying core synchronization logic, or changing pre-existing UI workflows, **STOP**, briefly explain the bug and proposed logic changes, and **ask for explicit user permission** before making any code modifications.
