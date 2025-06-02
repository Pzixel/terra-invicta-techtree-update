import React, { useEffect, useState, useCallback, useRef } from 'react';
import { parseNode, draw } from './techGraphRender';
import * as vis from "vis-network/standalone";
import { TechGraphProps } from './types/props';

export function TechGraph({
    techDb, 
    templateData,
    onNavigateToNode, 
    navigatedToNode,
}: TechGraphProps) {
    const [network, setNetwork] = useState<vis.Network | null>(null);
    
    // Use ref to store the latest callback without causing re-renders
    const onNavigateToNodeRef = useRef(onNavigateToNode);
    useEffect(() => {
        onNavigateToNodeRef.current = onNavigateToNode;
    }, [onNavigateToNode]);

    const drawTree = useCallback(() => {
        const { nodes, edges, lateNodes, lateEdges } = parseNode(techDb, templateData, false);
        const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
        };

        // Use the ref callback that won't change between renders
        setNetwork(draw(techDb, data, lateNodes, lateEdges, (...args) => onNavigateToNodeRef.current(...args)));
    }, [techDb, templateData]);

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
