import React, { useEffect, useState } from 'react';
import { parseNode, draw } from './techGraphRender';
import * as vis from "vis-network/standalone";
import { TechGraphProps } from './types/props';

export function TechGraph({
    techDb, 
    onNavigateToNode, 
    navigatedToNode,
}: TechGraphProps) {
    const [network, setNetwork] = useState<vis.Network | null>(null);

    function drawTree() {
        const { nodes, edges, lateNodes, lateEdges } = parseNode(techDb, false);
        const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges as any)
        };

        setNetwork(draw(techDb, data, lateNodes, lateEdges, onNavigateToNode));
    }

    useEffect(() => {
        drawTree();
    }, [techDb]);

    useEffect(() => {
        if (navigatedToNode && network) {
            network.selectNodes([navigatedToNode.dataName]);
            network.focus(navigatedToNode.dataName);
        }
    }, [navigatedToNode, network]);

    return (
        <div id="mynetwork"></div>
    );
}
