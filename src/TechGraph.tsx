import { useEffect, useCallback, useRef, useState } from 'react';
import { parseNode, draw, drawBundle } from './techGraphRender';
import * as vis from "vis-network/standalone";
import { TechGraphProps } from './types/props';

export function TechGraph({
    techDb,
    templateData,
    onNavigateToNode,
    selectedDataName,
    precomputedPositions,
    bundle,
}: TechGraphProps) {
    const [network, setNetwork] = useState<vis.Network | null>(null);

    // Refs let the draw callback see current values without re-drawing
    const onNavigateToNodeRef = useRef(onNavigateToNode);
    useEffect(() => {
        onNavigateToNodeRef.current = onNavigateToNode;
    }, [onNavigateToNode]);
    const selectedDataNameRef = useRef(selectedDataName);
    selectedDataNameRef.current = selectedDataName;

    const drawTree = useCallback(() => {
        const navigate = (dataName: string | null) => onNavigateToNodeRef.current(dataName);
        const initialFocus = selectedDataNameRef.current;

        // Precompiled bundle renders without game data or a layout pass.
        // It stays authoritative until the app clears it (user toggles that
        // change the node set), so the graph doesn't redraw when data arrives.
        if (bundle) {
            performance.mark('graph:draw-start');
            setNetwork(drawBundle(bundle, navigate, initialFocus));
            performance.measure('graph:draw', 'graph:draw-start');
            return;
        }
        if (!techDb || !templateData) {
            return;
        }
        const { nodes, edges, lateNodes, lateEdges } = parseNode(techDb, templateData, false);
        const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
        };

        setNetwork(draw(data, lateNodes, lateEdges, navigate, precomputedPositions, initialFocus));
    }, [bundle, techDb, templateData, precomputedPositions]);

    useEffect(() => {
        drawTree();
    }, [drawTree]);

    useEffect(() => {
        if (selectedDataName && network) {
            try {
                network.selectNodes([selectedDataName]);
                network.focus(selectedDataName);
            } catch {
                // Unknown node id (bad URL) — nothing to focus
            }
        }
    }, [selectedDataName, network]);

    return (
        <div id="mynetwork" className="graph-container"></div>
    );
}
