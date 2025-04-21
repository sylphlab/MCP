# Project Conventions

**Package Management:**
- Use `pnpm` exclusively for dependency management.
- Use `pnpm workspace` features for managing the monorepo structure.

**Task Running:**
- Use `Turborepo` for running tasks (build, test, lint, etc.) across the monorepo.
- Define task pipelines in `turbo.json`.

**Building:**
- Use `tsup` for bundling and generating type definitions.
- Configure via `tsup.config.ts`.

**Testing:**
- Use `Vitest` as the testing framework.
- Aim for >90% test coverage using `@vitest/coverage-v8`.
- Write clear and descriptive tests. Unit tests are mandatory for core logic. Integration tests where appropriate.

**Versioning & Publishing:**
- Use `Changesets` for versioning packages and generating changelogs.
- Follow the Changesets workflow for adding changes (`pnpm changeset add`).

**TypeScript:**
- Enable strict mode (`strict: true` in `tsconfig.json`).
- Avoid `any` and `unknown` types unless absolutely necessary and justified.
- Use clear and descriptive type names.

**Linting & Formatting:**
- Use `Biome` exclusively for linting and formatting.
- Configure via `biome.json`, extending the shared `@sylphlab/biome-config`.
- Adhere to standard TypeScript/Node.js best practices enforced by Biome rules.

**Commits:**
- Follow the Conventional Commits specification (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `test:`). (Tooling like commitlint can be added later).

**Branching:**
- (To be defined - likely Gitflow or GitHub Flow). Default to `main` branch for now.

**Language:**
- English for all code, comments, commit messages, and documentation.