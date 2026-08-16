import { useEffect, useCallback, useRef, useState } from 'react';
import { parseNode, draw, drawBundle } from './techGraphRender';
import * as vis from "vis-network/standalone";
import { TechGraphProps } from './types/props';

export function TechGraph({
    techDb,
    templateData,
    onNavigateToNode,
    navigatedToNode,
    precomputedPositions,
    bundle,
}: TechGraphProps) {
    const [network, setNetwork] = useState<vis.Network | null>(null);

    // Use ref to store the latest callback without causing re-renders
    const onNavigateToNodeRef = useRef(onNavigateToNode);
    useEffect(() => {
        onNavigateToNodeRef.current = onNavigateToNode;
    }, [onNavigateToNode]);

    const drawTree = useCallback(() => {
        const navigate = (dataName: string | null) => onNavigateToNodeRef.current(dataName);

        // Precompiled bundle renders without game data or a layout pass.
        // It stays authoritative until the app clears it (user toggles that
        // change the node set), so the graph doesn't redraw when data arrives.
        if (bundle) {
            setNetwork(drawBundle(bundle, navigate));
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

        setNetwork(draw(data, lateNodes, lateEdges, navigate, precomputedPositions));
    }, [bundle, techDb, templateData, precomputedPositions]);

    useEffect(() => {
        drawTree();
    }, [drawTree]);

    useEffect(() => {
        if (navigatedToNode && network) {
            network.selectNodes([navigatedToNode.dataName]);
            network.focus(navigatedToNode.dataName);
        }
    }, [navigatedToNode, network]);

    return (
        <div id="mynetwork" className="graph-container"></div>
    );
}
