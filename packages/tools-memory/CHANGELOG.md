# @sylphlab/tools-memory

## 0.3.0

### Minor Changes

- 4ad90fc: redesign memory tool using property graphs

## 0.3.0

### Major Changes

- **BREAKING:** Overhauled the Knowledge Graph data model to align with the Property Graph standard:
  - Replaced `Entity` with `Node`, now using `id` (UUID), `labels` (string array), and `properties` (key-value object).
  - Replaced `Relation` with `Edge`, now using `id` (UUID), `type`, `from` (Node ID), `to` (Node ID), and optional `properties`.
  - Removed the `observations` array from entities; relevant data should now be stored in `properties`.
- **BREAKING:** Completely redesigned the query and update toolset for improved clarity, discoverability, and flexibility:
  - **Removed:** `search-nodes`, `open-nodes`, `read-graph`, `addObservationsTool`, `deleteObservationsTool`.
  - **Added Query Tools:** `get_node`, `find_nodes`, `list_nodes`, `list_labels`, `list_relation_types`, `find_related_nodes`.
  - **Added Update Tools:** `update_node_properties`, `replace_node_properties`, `add_node_labels`, `remove_node_labels`, `update_edge_properties`, `replace_edge_properties`.
  - **Adapted CRUD Tools:** `create_nodes` (was `createEntities`), `create_edges` (was `createRelations`), `delete_nodes` (was `deleteEntities`), `delete_edges` (was `deleteRelations`) now operate on the new Node/Edge structure with UUIDs.
- Updated `graphUtils.ts` to handle the new data structure and JSON Lines format.

### Patch Changes

- Updated dependencies [TODO: Add relevant dependency commit hash if applicable]
  - @sylphlab/tools-core@[TODO: Add new version if applicable]

## 0.2.2

### Patch Changes

- 18cbf3c: bugfix
- 65f46fe: bugfix
- Updated dependencies [18cbf3c]
  - @sylphlab/tools-core@0.4.1

## 0.2.1

### Patch Changes

- e4aae2f: changed .json to .jsonl

## 0.2.0

### Minor Changes

- f422f02: rename tools

### Patch Changes

- Updated dependencies [f422f02]
  - @sylphlab/tools-core@0.4.0

## 0.1.2

### Patch Changes

- 7960294: fixed cannot start up

## 0.1.1

### Patch Changes

- 001f90f: refactored
- Updated dependencies [001f90f]
  - @sylphlab/tools-core@0.3.1
