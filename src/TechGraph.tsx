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
    dlcOnlyDataNames = [],
    accessibleLabel,
}: TechGraphProps) {
    const [network, setNetwork] = useState<vis.Network | null>(null);
    const networkRef = useRef<vis.Network | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const replaceNetwork = useCallback((createNetwork: () => vis.Network) => {
        networkRef.current?.destroy();
        const nextNetwork = createNetwork();
        networkRef.current = nextNetwork;
        setNetwork(nextNetwork);
    }, []);

    // Refs let the draw callback see current values without re-drawing
    const onNavigateToNodeRef = useRef(onNavigateToNode);
    useEffect(() => {
        onNavigateToNodeRef.current = onNavigateToNode;
    }, [onNavigateToNode]);
    const selectedDataNameRef = useRef(selectedDataName);
    selectedDataNameRef.current = selectedDataName;

    // The vis container div; the pre-React boot may have created it already
    const ensureNetworkDiv = () => {
        const host = containerRef.current!;
        let el = host.querySelector<HTMLElement>('#mynetwork');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mynetwork';
            host.appendChild(el);
        }
        return el;
    };

    const drawTree = useCallback(() => {
        const navigate = (dataName: string | null) => onNavigateToNodeRef.current(dataName);
        const initialFocus = selectedDataNameRef.current;
        const dlcOnly = new Set(dlcOnlyDataNames);
        const markDlcNodes = <T extends { id: string; label: string },>(nodes: T[]) => nodes.map((node) => (
            dlcOnly.has(node.id) && !node.label.includes('◆')
                ? { ...node, label: node.label.replace('<b>', '<b>◆ ') }
                : node
        ));

        // Precompiled bundle renders without game data or a layout pass.
        // It stays authoritative until the app clears it (user toggles that
        // change the node set), so the graph doesn't redraw when data arrives.
        if (bundle) {
            const boot = window.__graphBoot;
            if (boot && boot.bundle === bundle && !boot.adopted) {
                if (boot.network && dlcOnly.size === 0) {
                    // Adopt the network the boot chunk already drew: move its
                    // container into the React tree and take over navigation
                    boot.adopted = true;
                    containerRef.current!.appendChild(boot.container);
                    boot.onNavigate = navigate;
                    const queued = boot.queuedNav.splice(0);
                    if (queued.length) {
                        navigate(queued[queued.length - 1]);
                    }
                    replaceNetwork(() => boot.network!);
                    return;
                }
                // React won the race: claim the boot so it won't also draw
                boot.adopted = true;
                boot.network?.destroy();
                boot.container.remove();
            }
            const renderedBundle = dlcOnly.size > 0
                ? { ...bundle, nodes: markDlcNodes(bundle.nodes) }
                : bundle;
            performance.mark('graph:draw-start');
            replaceNetwork(() => drawBundle(renderedBundle, navigate, initialFocus, ensureNetworkDiv()));
            performance.measure('graph:draw', 'graph:draw-start');
            return;
        }
        if (!techDb || !templateData) {
            return;
        }
        ensureNetworkDiv();
        const { nodes, edges, lateNodes, lateEdges } = parseNode(techDb, templateData, false);
        const data = {
            nodes: new vis.DataSet(markDlcNodes(nodes)),
            edges: new vis.DataSet(edges)
        };

        replaceNetwork(() => draw(data, markDlcNodes(lateNodes), lateEdges, navigate, precomputedPositions, initialFocus));
    }, [bundle, techDb, templateData, precomputedPositions, dlcOnlyDataNames, replaceNetwork]);

    useEffect(() => {
        drawTree();
    }, [drawTree]);

    useEffect(() => () => {
        networkRef.current?.destroy();
        networkRef.current = null;
    }, []);

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
        <div
            className="graph-container"
            ref={containerRef}
            role="application"
            aria-label={accessibleLabel}
        ></div>
    );
}
