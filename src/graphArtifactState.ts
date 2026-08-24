export type GraphArtifact<T> = {
    key: string;
    bundle: T | null;
};

type GraphRenderSourceOptions<T> = {
    key: string;
    artifact: GraphArtifact<T> | null;
    forceLive: boolean;
    dataReady: boolean;
    layoutReady: boolean;
};

export type GraphRenderSource<T> = {
    bundle: T | null;
    drawLive: boolean;
    pending: boolean;
};

export function graphRenderSource<T>({
    key,
    artifact,
    forceLive,
    dataReady,
    layoutReady,
}: GraphRenderSourceOptions<T>): GraphRenderSource<T> {
    const currentBundle = artifact?.key === key ? artifact.bundle : undefined;
    const pending = !forceLive && currentBundle === undefined;

    return {
        bundle: !forceLive ? currentBundle ?? null : null,
        drawLive: dataReady && layoutReady && (forceLive || currentBundle === null),
        pending,
    };
}
