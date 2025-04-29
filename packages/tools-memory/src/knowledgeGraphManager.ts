import path from 'node:path';
import { promises as fs } from 'node:fs';

// Interfaces (Define or import from a types file if preferred)
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
export class KnowledgeGraphManager {
  private memoryFilePath: string;

  constructor(workspaceRoot: string, memoryFilePathOverride?: string) {
    const defaultMemoryPath = path.join(workspaceRoot, 'memory.json');
    // If memoryFilePathOverride is provided, resolve it relative to workspaceRoot unless it's absolute
    this.memoryFilePath = memoryFilePathOverride
      ? path.resolve(workspaceRoot, memoryFilePathOverride)
      : defaultMemoryPath;
    console.log(`[KnowledgeGraphManager] Initialized with memory path: ${this.memoryFilePath}`); // Log path on init
  }

  private async ensureMemoryDirExists(): Promise<void> {
    const memoryDir = path.dirname(this.memoryFilePath);
    try {
      await fs.mkdir(memoryDir, { recursive: true });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code !== 'EEXIST') {
        console.error(`[KnowledgeGraphManager] Error creating directory ${memoryDir}:`, error);
        throw error; // Re-throw critical error
      }
      // Ignore EEXIST
    }
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      if (!data.trim()) {
        return { entities: [], relations: [] };
      }
      const lines = data.split("\n").filter((line: string) => line.trim() !== "");
      return lines.reduce((graph: KnowledgeGraph, line: string, index: number) => {
        try {
          const item = JSON.parse(line);
          if (item.type === "entity" && item.name && item.entityType && Array.isArray(item.observations)) {
             graph.entities.push(item as Entity);
          } else if (item.type === "relation" && item.from && item.to && item.relationType) {
             graph.relations.push(item as Relation);
          } else {
             console.warn(`[KnowledgeGraphManager] Skipping invalid line ${index + 1} in memory file: ${line}`);
          }
        } catch (parseError) {
           console.error(`[KnowledgeGraphManager] Error parsing line ${index + 1} in memory file: ${line}`, parseError);
        }
        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entities: [], relations: [] }; // File not found is okay, return empty graph
      }
      console.error(`[KnowledgeGraphManager] Error loading knowledge graph from ${this.memoryFilePath}:`, error);
      throw error; // Re-throw other critical errors
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    await this.ensureMemoryDirExists();
    const validEntities = graph.entities.filter(e => e?.name && e?.entityType && Array.isArray(e.observations));
    const validRelations = graph.relations.filter(r => r?.from && r?.to && r.relationType);

    const lines = [
      ...validEntities.map(e => JSON.stringify({ type: "entity", ...e })),
      ...validRelations.map(r => JSON.stringify({ type: "relation", ...r })),
    ];
    try {
        await fs.writeFile(this.memoryFilePath, lines.join("\n"));
    } catch (writeError) {
        console.error(`[KnowledgeGraphManager] Error saving knowledge graph to ${this.memoryFilePath}:`, writeError);
        throw writeError;
    }
  }

  // --- Public API Methods ---

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // Input validation should happen in the tool definition using Zod
    const graph = await this.loadGraph();
    const newEntities: Entity[] = [];
    for (const e of entities) {
        // Basic validation (already done by Zod, but keep as safeguard)
        if (e?.name && e?.entityType && Array.isArray(e.observations)) {
            if (!graph.entities.some((existingEntity: Entity) => existingEntity.name === e.name)) {
                newEntities.push(e);
            }
        } else {
            console.warn("[KnowledgeGraphManager] Skipping invalid entity object during creation (should have been caught by Zod):", e);
        }
    }
    if (newEntities.length > 0) {
        graph.entities.push(...newEntities);
        await this.saveGraph(graph);
    }
    return newEntities; // Return only the newly created entities
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const newRelations: Relation[] = [];
    const existingRelationSet = new Set(graph.relations.map(r => `${r.from}|${r.to}|${r.relationType}`));

    for (const r of relations) {
        if (r?.from && r?.to && r?.relationType) {
            const relationKey = `${r.from}|${r.to}|${r.relationType}`;
            if (!existingRelationSet.has(relationKey)) {
                newRelations.push(r);
                existingRelationSet.add(relationKey);
            }
        } else {
             console.warn("[KnowledgeGraphManager] Skipping invalid relation object during creation (should have been caught by Zod):", r);
        }
    }

    if (newRelations.length > 0) {
        graph.relations.push(...newRelations);
        await this.saveGraph(graph);
    }
    return newRelations;
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const results: { entityName: string; addedObservations: string[] }[] = [];
    let graphChanged = false;

    for (const o of observations) {
        if (!o?.entityName || !Array.isArray(o.contents)) {
             console.warn("[KnowledgeGraphManager] Skipping invalid observation object (should have been caught by Zod):", o);
            continue;
        }

        const entity = graph.entities.find((e: Entity) => e.name === o.entityName);
        if (!entity) {
            // Throw an error here, as the tool should ensure the entity exists
            throw new Error(`Entity with name '${o.entityName}' not found.`);
        }

        const newObservations = o.contents.filter((content: string) => typeof content === 'string' && !entity.observations.includes(content));
        if (newObservations.length > 0) {
            entity.observations.push(...newObservations);
            results.push({ entityName: o.entityName, addedObservations: newObservations });
            graphChanged = true;
        } else {
            results.push({ entityName: o.entityName, addedObservations: [] });
        }
    }

    if (graphChanged) {
        await this.saveGraph(graph);
    }
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<string[]> {
    const graph = await this.loadGraph();
    const initialEntityCount = graph.entities.length;
    const initialRelationCount = graph.relations.length;
    const namesToDeleteSet = new Set(entityNames.filter((name: string) => typeof name === 'string'));

    const deletedEntityNames: string[] = [];

    graph.entities = graph.entities.filter((e: Entity) => {
        if (namesToDeleteSet.has(e.name)) {
            deletedEntityNames.push(e.name);
            return false;
        }
        return true;
    });

    graph.relations = graph.relations.filter((r: Relation) =>
        !namesToDeleteSet.has(r.from) && !namesToDeleteSet.has(r.to)
    );

    if (graph.entities.length !== initialEntityCount || graph.relations.length !== initialRelationCount) {
        await this.saveGraph(graph);
    }
    return deletedEntityNames;
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<{ entityName: string; deletedCount: number }[]> {
    const graph = await this.loadGraph();
    let graphChanged = false;
    const results: { entityName: string; deletedCount: number }[] = [];

    for (const d of deletions) {
        let deletedCount = 0;
        if (!d?.entityName || !Array.isArray(d.observations)) {
             console.warn("[KnowledgeGraphManager] Skipping invalid deletion object (should have been caught by Zod):", d);
             results.push({ entityName: d?.entityName ?? 'unknown', deletedCount: 0 });
            continue;
        }
        const entity = graph.entities.find((e: Entity) => e.name === d.entityName);
        if (entity) {
            const observationsToDeleteSet = new Set(d.observations.filter((obs: string) => typeof obs === 'string'));
            const initialObservationCount = entity.observations.length;
            entity.observations = entity.observations.filter((o: string) => !observationsToDeleteSet.has(o));
            deletedCount = initialObservationCount - entity.observations.length;
            if (deletedCount > 0) {
                graphChanged = true;
            }
        } else {
             console.warn(`[KnowledgeGraphManager] Entity with name ${d.entityName} not found during observation deletion.`);
        }
        results.push({ entityName: d.entityName, deletedCount });
    }

    if (graphChanged) {
        await this.saveGraph(graph);
    }
    return results; // Return count of deleted observations per entity
  }

  async deleteRelations(relationsToDelete: Relation[]): Promise<number> {
    const graph = await this.loadGraph();
    const initialRelationCount = graph.relations.length;

    const deleteKeys = new Set(
        relationsToDelete
            .filter((r: Relation) => r?.from && r?.to && r?.relationType)
            .map((delRelation: Relation) => `${delRelation.from}|${delRelation.to}|${delRelation.relationType}`)
    );

    graph.relations = graph.relations.filter((r: Relation) => {
        const relationKey = `${r.from}|${r.to}|${r.relationType}`;
        return !deleteKeys.has(relationKey);
    });

    const deletedCount = initialRelationCount - graph.relations.length;
    if (deletedCount > 0) {
        await this.saveGraph(graph);
    }
    return deletedCount; // Return number of relations deleted
  }

  async readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const lowerCaseQuery = query.toLowerCase();

    const filteredEntities = graph.entities.filter((e: Entity) =>
      e.name.toLowerCase().includes(lowerCaseQuery) ||
      e.entityType.toLowerCase().includes(lowerCaseQuery) ||
      e.observations.some((o: string) => o.toLowerCase().includes(lowerCaseQuery))
    );

    const filteredEntityNames = new Set(filteredEntities.map((e: Entity) => e.name));

    const filteredRelations = graph.relations.filter((r: Relation) =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }

   async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const namesToOpenSet = new Set(names.filter((name: string) => typeof name === 'string'));

    const filteredEntities = graph.entities.filter((e: Entity) => namesToOpenSet.has(e.name));
    const filteredEntityNames = new Set(filteredEntities.map((e: Entity) => e.name));

    const filteredRelations = graph.relations.filter((r: Relation) =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }
}