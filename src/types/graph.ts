export type EntityType = "PERSON" | "ORGANIZATION" | "LOCATION" | "CONCEPT" | "PRODUCT" | "EVENT" | "DATE" | "METRIC" | "TOPIC";

export type RelationType = "RELATED_TO" | "PART_OF" | "CAUSES" | "MENTIONS" | "WORKS_FOR" | "LOCATED_IN" | "CREATED_BY" | "DEFINES" | "CONTRADICTS" | "SUPPORTS";

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  docIds: string[];
  userId: string;
  frequency: number;
  description: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number;
  docIds: string[];
  context: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    docCount: number;
    clusterCount: number;
  };
}
