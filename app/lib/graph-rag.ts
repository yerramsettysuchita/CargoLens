/**
 * graph-rag.ts — Knowledge Graph + Graph-RAG for CargoLens Copilot
 *
 * Architecture:
 *   Nodes: Shipment, Carrier, Port, Country, Corridor, Regulation, HSCode
 *   Edges: typed relationships between nodes
 *
 * Graph-RAG flow:
 *   1. Build graph from live shipment data + static trade knowledge
 *   2. On user query, traverse relevant subgraph (multi-hop)
 *   3. Serialize subgraph into structured context for the LLM
 *   4. LLM answers with graph-grounded knowledge — not flat text
 *
 * This enables multi-hop queries like:
 *   "Which carriers are affected by Red Sea disruption?"
 *   "What compliance risks exist 2 hops from my HS code?"
 *   "Which shipments face cascading risk from Jebel Ali congestion?"
 */

import type { Shipment } from "@/app/lib/supabase/shipment-types";

// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeType =
  | "shipment"
  | "carrier"
  | "port"
  | "country"
  | "corridor"
  | "regulation"
  | "hs_code"
  | "alert";

export type EdgeType =
  | "USES_CARRIER"
  | "DEPARTS_FROM"
  | "ARRIVES_AT"
  | "TRAVELS_THROUGH"
  | "SUBJECT_TO"
  | "LOCATED_IN"
  | "OPERATES_ON"
  | "REGULATES"
  | "HAS_ALERT"
  | "RELATED_TO";

export interface GraphNode {
  id:         string;
  type:       NodeType;
  label:      string;
  properties: Record<string, string | number | boolean>;
}

export interface GraphEdge {
  from:  string;
  to:    string;
  type:  EdgeType;
  label: string;
}

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, string[]>; // node id → connected node ids
}

// ─── Static Trade Knowledge ───────────────────────────────────────────────────

const STATIC_REGULATIONS: GraphNode[] = [
  { id: "reg:uflpa",       type: "regulation", label: "UFLPA",           properties: { description: "Uyghur Forced Labor Prevention Act — bans Xinjiang-origin goods into US", applies_to: "USA", severity: "critical" } },
  { id: "reg:cbam",        type: "regulation", label: "EU CBAM",         properties: { description: "Carbon Border Adjustment Mechanism — carbon levy on imports into EU from 2026", applies_to: "EU", severity: "high" } },
  { id: "reg:section301",  type: "regulation", label: "Section 301",     properties: { description: "US tariffs on Chinese goods, 25-100% on most categories", applies_to: "USA", severity: "high" } },
  { id: "reg:fda",         type: "regulation", label: "FDA Prior Notice", properties: { description: "FDA prior notice required for pharma and food imports into USA", applies_to: "USA", severity: "medium" } },
  { id: "reg:reach",       type: "regulation", label: "EU REACH",        properties: { description: "Chemical registration and restriction regulation for EU market", applies_to: "EU", severity: "medium" } },
  { id: "reg:ofac",        type: "regulation", label: "OFAC Sanctions",  properties: { description: "US Treasury sanctions — blocks transactions with designated entities", applies_to: "global", severity: "critical" } },
  { id: "reg:scomet",      type: "regulation", label: "SCOMET",          properties: { description: "India dual-use export controls — special chemicals, organisms, materials", applies_to: "India", severity: "high" } },
  { id: "reg:dcts",        type: "regulation", label: "UK DCTS",         properties: { description: "UK Developing Countries Trading Scheme — preferential tariffs for eligible origins", applies_to: "UK", severity: "low" } },
];

const STATIC_ALERTS: GraphNode[] = [
  { id: "alert:redsea",    type: "alert", label: "Red Sea / Suez Disruption",  properties: { severity: "high",   description: "Houthi attacks forcing Cape reroute. Adds 8-10 days, ~$900/TEU extra cost", affects_corridor: "India → EU,India → UK,SE Asia → Europe" } },
  { id: "alert:jebel",     type: "alert", label: "Jebel Ali Congestion",       properties: { severity: "medium", description: "Port congestion at Jebel Ali. 2-3 day delays on UAE corridors", affects_corridor: "UAE → East Africa" } },
  { id: "alert:section301",type: "alert", label: "Section 301 Tariff Escalation", properties: { severity: "high", description: "US raising tariffs on Chinese electronics to 100%. Rerouting via Vietnam rising", affects_corridor: "China → Middle East,SE Asia → Europe" } },
  { id: "alert:cbam2026",  type: "alert", label: "EU CBAM Phase-in 2026",      properties: { severity: "medium", description: "EU Carbon Border Adjustment reporting mandatory from Jan 2026 for metals, cement, fertilizers, electronics", affects_corridor: "India → EU,SE Asia → Europe" } },
];

const CORRIDOR_REGULATION_MAP: Record<string, string[]> = {
  "India → EU":          ["reg:cbam", "reg:reach"],
  "India → US":          ["reg:uflpa", "reg:section301", "reg:fda"],
  "India → UK":          ["reg:dcts"],
  "UAE → East Africa":   [],
  "SE Asia → Europe":    ["reg:cbam", "reg:reach"],
  "China → Middle East": ["reg:section301"],
  "Europe → Africa":     [],
};

const CORRIDOR_ALERT_MAP: Record<string, string[]> = {
  "India → EU":          ["alert:redsea", "alert:cbam2026"],
  "India → UK":          ["alert:redsea"],
  "SE Asia → Europe":    ["alert:redsea", "alert:section301", "alert:cbam2026"],
  "UAE → East Africa":   ["alert:jebel"],
  "China → Middle East": ["alert:section301"],
};

// ─── Graph Builder ────────────────────────────────────────────────────────────

export function buildKnowledgeGraph(shipments: Shipment[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, string[]>();

  function addNode(node: GraphNode) {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
      adjacency.set(node.id, []);
    }
  }

  function addEdge(edge: GraphEdge) {
    edges.push(edge);
    const fromAdj = adjacency.get(edge.from) ?? [];
    fromAdj.push(edge.to);
    adjacency.set(edge.from, fromAdj);
    const toAdj = adjacency.get(edge.to) ?? [];
    toAdj.push(edge.from);
    adjacency.set(edge.to, toAdj);
  }

  // 1. Add static regulation and alert nodes
  [...STATIC_REGULATIONS, ...STATIC_ALERTS].forEach(addNode);

  // 2. Build graph from live shipments
  for (const s of shipments) {
    // Shipment node
    const shipmentId = `shipment:${s.id}`;
    addNode({
      id: shipmentId,
      type: "shipment",
      label: s.shipment_code,
      properties: {
        status:      s.status,
        risk_level:  s.risk_level,
        corridor:    s.corridor ?? "",
        eta_date:    s.eta_date ?? "",
        cargo:       s.cargo_category ?? "",
        value_usd:   s.declared_value ?? 0,
        carbon_kg:   s.carbon_kg ?? 0,
        hs_code:     s.hs_code ?? "",
        incoterm:    s.incoterm ?? "",
      },
    });

    // Carrier node
    if (s.carrier) {
      const carrierId = `carrier:${s.carrier.toLowerCase().replace(/\s+/g, "_")}`;
      addNode({
        id: carrierId,
        type: "carrier",
        label: s.carrier,
        properties: { name: s.carrier, mode: s.shipment_mode ?? "sea" },
      });
      addEdge({ from: shipmentId, to: carrierId, type: "USES_CARRIER", label: `${s.shipment_code} uses ${s.carrier}` });
    }

    // Origin port node
    if (s.origin_port) {
      const originPortId = `port:${s.origin_port.toLowerCase().replace(/[\s()]/g, "_")}`;
      addNode({
        id: originPortId,
        type: "port",
        label: s.origin_port,
        properties: { country: s.origin_country ?? "", role: "origin" },
      });
      addEdge({ from: shipmentId, to: originPortId, type: "DEPARTS_FROM", label: `${s.shipment_code} departs from ${s.origin_port}` });
    }

    // Destination port node
    if (s.destination_port) {
      const destPortId = `port:${s.destination_port.toLowerCase().replace(/[\s()]/g, "_")}`;
      addNode({
        id: destPortId,
        type: "port",
        label: s.destination_port,
        properties: { country: s.destination_country ?? "", role: "destination" },
      });
      addEdge({ from: shipmentId, to: destPortId, type: "ARRIVES_AT", label: `${s.shipment_code} arrives at ${s.destination_port}` });
    }

    // Corridor node
    if (s.corridor) {
      const corridorId = `corridor:${s.corridor.toLowerCase().replace(/[\s→]/g, "_")}`;
      addNode({
        id: corridorId,
        type: "corridor",
        label: s.corridor,
        properties: { name: s.corridor },
      });
      addEdge({ from: shipmentId, to: corridorId, type: "TRAVELS_THROUGH", label: `${s.shipment_code} travels through ${s.corridor}` });

      // Wire corridor → regulations
      const regs = CORRIDOR_REGULATION_MAP[s.corridor] ?? [];
      for (const regId of regs) {
        if (nodes.has(regId)) {
          addEdge({ from: corridorId, to: regId, type: "SUBJECT_TO", label: `${s.corridor} subject to ${nodes.get(regId)!.label}` });
        }
      }

      // Wire corridor → alerts
      const alerts = CORRIDOR_ALERT_MAP[s.corridor] ?? [];
      for (const alertId of alerts) {
        if (nodes.has(alertId)) {
          addEdge({ from: corridorId, to: alertId, type: "HAS_ALERT", label: `${s.corridor} has alert: ${nodes.get(alertId)!.label}` });
        }
      }
    }

    // HS Code node
    if (s.hs_code) {
      const hsId = `hs:${s.hs_code}`;
      addNode({
        id: hsId,
        type: "hs_code",
        label: `HS ${s.hs_code}`,
        properties: { code: s.hs_code },
      });
      addEdge({ from: shipmentId, to: hsId, type: "RELATED_TO", label: `${s.shipment_code} classified under HS ${s.hs_code}` });
    }
  }

  return { nodes, edges, adjacency };
}

// ─── Graph Traversal ──────────────────────────────────────────────────────────

/**
 * BFS traversal from a set of seed node IDs up to maxHops.
 * Returns all nodes and edges in the subgraph.
 */
export function traverseSubgraph(
  graph: KnowledgeGraph,
  seedIds: string[],
  maxHops: number = 2,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const visited  = new Set<string>(seedIds);
  const queue    = seedIds.map((id) => ({ id, hop: 0 }));
  const subNodes: GraphNode[] = [];
  const subEdges: GraphEdge[] = [];

  while (queue.length > 0) {
    const item = queue.shift()!;
    const node = graph.nodes.get(item.id);
    if (node) subNodes.push(node);

    if (item.hop >= maxHops) continue;

    const neighbors = graph.adjacency.get(item.id) ?? [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, hop: item.hop + 1 });
      }
    }
  }

  // Collect edges where both endpoints are in visited
  for (const edge of graph.edges) {
    if (visited.has(edge.from) && visited.has(edge.to)) {
      subEdges.push(edge);
    }
  }

  return { nodes: subNodes, edges: subEdges };
}

// ─── Query Router ─────────────────────────────────────────────────────────────

/**
 * Determines which seed nodes to start traversal from based on query intent.
 */
export function routeQuery(query: string, graph: KnowledgeGraph): string[] {
  const q = query.toLowerCase();
  const seeds: string[] = [];

  // Alert-focused queries → start from alert nodes
  if (q.includes("red sea") || q.includes("suez") || q.includes("disruption")) {
    seeds.push("alert:redsea");
  }
  if (q.includes("jebel") || q.includes("congestion") || q.includes("port delay")) {
    seeds.push("alert:jebel");
  }
  if (q.includes("section 301") || q.includes("tariff") || q.includes("china")) {
    seeds.push("alert:section301");
  }
  if (q.includes("cbam") || q.includes("carbon") || q.includes("emission")) {
    seeds.push("alert:cbam2026", "reg:cbam");
  }

  // Regulation-focused queries
  if (q.includes("uflpa") || q.includes("xinjiang") || q.includes("forced labor")) {
    seeds.push("reg:uflpa");
  }
  if (q.includes("sanction") || q.includes("ofac")) {
    seeds.push("reg:ofac");
  }
  if (q.includes("fda") || q.includes("pharma") || q.includes("food")) {
    seeds.push("reg:fda");
  }

  // Status-focused queries → start from matching shipment nodes
  if (q.includes("delay") || q.includes("delayed")) {
    for (const [id, node] of graph.nodes) {
      if (node.type === "shipment" && node.properties.status === "delayed") seeds.push(id);
    }
  }
  if (q.includes("customs") || q.includes("hold")) {
    for (const [id, node] of graph.nodes) {
      if (node.type === "shipment" && (node.properties.status === "customs_hold" || node.properties.status === "customs")) seeds.push(id);
    }
  }
  if (q.includes("at risk") || q.includes("high risk") || q.includes("critical")) {
    for (const [id, node] of graph.nodes) {
      if (node.type === "shipment" && (node.properties.risk_level === "high" || node.properties.risk_level === "critical")) seeds.push(id);
    }
  }

  // Carrier-focused queries
  if (q.includes("carrier") || q.includes("maersk") || q.includes("hapag") || q.includes("msc")) {
    for (const [id, node] of graph.nodes) {
      if (node.type === "carrier") {
        const name = (node.properties.name as string).toLowerCase();
        if (q.includes(name.split(" ")[0])) seeds.push(id);
      }
    }
  }

  // Corridor-focused queries
  for (const [id, node] of graph.nodes) {
    if (node.type === "corridor") {
      const label = node.label.toLowerCase();
      if (q.includes("india") && label.includes("india")) seeds.push(id);
      if (q.includes("uae") && label.includes("uae")) seeds.push(id);
      if (q.includes("europe") && label.includes("europe")) seeds.push(id);
    }
  }

  // Default: include all high-risk shipments and active alerts
  if (seeds.length === 0) {
    for (const [id, node] of graph.nodes) {
      if (node.type === "shipment" && (node.properties.risk_level === "high" || node.properties.risk_level === "critical")) {
        seeds.push(id);
      }
    }
    seeds.push("alert:redsea", "alert:jebel");
  }

  return [...new Set(seeds)].slice(0, 15); // cap to avoid explosion
}

// ─── Context Serializer ───────────────────────────────────────────────────────

/**
 * Converts a subgraph into a structured text block for the LLM.
 * This is the "retrieval" step of Graph-RAG.
 */
export function serializeGraphContext(
  subgraph: { nodes: GraphNode[]; edges: GraphEdge[] },
  query: string,
): string {
  const lines: string[] = [
    "=== KNOWLEDGE GRAPH CONTEXT ===",
    `Query intent: "${query}"`,
    "",
  ];

  // Group nodes by type
  const byType = new Map<NodeType, GraphNode[]>();
  for (const node of subgraph.nodes) {
    const group = byType.get(node.type) ?? [];
    group.push(node);
    byType.set(node.type, group);
  }

  // Shipments
  const shipments = byType.get("shipment") ?? [];
  if (shipments.length > 0) {
    lines.push(`SHIPMENTS (${shipments.length}):`);
    for (const s of shipments.slice(0, 20)) {
      lines.push(
        `  • ${s.label} | status: ${s.properties.status} | risk: ${s.properties.risk_level} | corridor: ${s.properties.corridor} | ETA: ${s.properties.eta_date || "unknown"} | cargo: ${s.properties.cargo} | value: $${s.properties.value_usd}`
      );
    }
    lines.push("");
  }

  // Alerts
  const alerts = byType.get("alert") ?? [];
  if (alerts.length > 0) {
    lines.push("ACTIVE DISRUPTION ALERTS:");
    for (const a of alerts) {
      lines.push(`  ⚠ ${a.label}: ${a.properties.description}`);
      lines.push(`    Affects: ${a.properties.affects_corridor || "multiple corridors"}`);
    }
    lines.push("");
  }

  // Regulations
  const regs = byType.get("regulation") ?? [];
  if (regs.length > 0) {
    lines.push("APPLICABLE REGULATIONS:");
    for (const r of regs) {
      lines.push(`  📋 ${r.label} (${r.properties.applies_to}): ${r.properties.description}`);
    }
    lines.push("");
  }

  // Carriers
  const carriers = byType.get("carrier") ?? [];
  if (carriers.length > 0) {
    lines.push(`CARRIERS IN CONTEXT (${carriers.length}): ${carriers.map((c) => c.label).join(", ")}`);
    lines.push("");
  }

  // Corridors
  const corridors = byType.get("corridor") ?? [];
  if (corridors.length > 0) {
    lines.push(`CORRIDORS IN CONTEXT: ${corridors.map((c) => c.label).join(", ")}`);
    lines.push("");
  }

  // Key relationships (edges)
  if (subgraph.edges.length > 0) {
    lines.push("KEY RELATIONSHIPS:");
    // Only show the most meaningful edge types
    const meaningful = subgraph.edges
      .filter((e) => ["SUBJECT_TO", "HAS_ALERT", "USES_CARRIER"].includes(e.type))
      .slice(0, 15);
    for (const e of meaningful) {
      lines.push(`  → ${e.label}`);
    }
    lines.push("");
  }

  lines.push("=== END GRAPH CONTEXT ===");
  return lines.join("\n");
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Full Graph-RAG pipeline:
 * shipments + query → structured graph context string for LLM
 */
export function buildGraphContext(shipments: Shipment[], query: string): string {
  const graph    = buildKnowledgeGraph(shipments);
  const seeds    = routeQuery(query, graph);
  const subgraph = traverseSubgraph(graph, seeds, 2);
  return serializeGraphContext(subgraph, query);
}
