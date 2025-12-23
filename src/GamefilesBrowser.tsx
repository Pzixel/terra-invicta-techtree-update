import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

interface ManifestEntry {
    type: 'file' | 'directory';
    name: string;
    path: string;
    size?: number;
    modified?: string;
    children?: ManifestEntry[];
}

interface ManifestData {
    generatedAt?: string;
    rootPath?: string;
    entries?: ManifestEntry[];
}

const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const renderEntry = (entry: ManifestEntry, baseUrl: string): React.ReactNode => {
    if (entry.type === 'directory') {
        return (
            <details key={entry.path} open className="gamefiles-directory">
                <summary>{entry.name}</summary>
                <div className="gamefiles-children">
                    {entry.children && entry.children.length > 0
                        ? entry.children.map((child) => renderEntry(child, baseUrl))
                        : <div className="gamefiles-empty">(empty)</div>}
                </div>
            </details>
        );
    }

    const fileUrl = `${baseUrl}${entry.path}`;
    const updated = entry.modified ? new Date(entry.modified).toLocaleDateString() : '';

    return (
        <div key={entry.path} className="gamefiles-file">
            <a href={fileUrl} target="_blank" rel="noreferrer">{entry.name}</a>
            <span className="gamefiles-meta">{formatSize(entry.size)}{updated ? ` · ${updated}` : ''}</span>
        </div>
    );
};

const GamefilesBrowser: React.FC = () => {
    const [manifest, setManifest] = useState<ManifestData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const manifestUrl = useMemo(() => new URL('gamefiles/index.json', window.location.href).toString(), []);
    const gamefilesBase = useMemo(() => new URL('gamefiles/', window.location.href).toString(), []);

    useEffect(() => {
        const controller = new AbortController();
        const fetchManifest = async () => {
            try {
                setLoading(true);
                const response = await fetch(manifestUrl, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`Unable to load manifest (${response.status})`);
                }
                const data: ManifestData = await response.json();
                setManifest(data);
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchManifest();
        return () => controller.abort();
    }, [manifestUrl]);

    return (
        <div className="gamefiles-page">
            <div className="gamefiles-actions">
                <Link className="utility-link" to="/">← Back to tech tree</Link>
                <a className="utility-link" href={manifestUrl} target="_blank" rel="noreferrer">Download manifest</a>
            </div>

            <h2>Gamefiles browser</h2>
            <p className="gamefiles-hint">
                Browse the static game files just like a simple FTP directory. Click any file to open or download it.
                {manifest?.generatedAt && <><br />Last indexed at {new Date(manifest.generatedAt).toLocaleString()}</>}
            </p>

            {loading && <div className="gamefiles-status">Loading manifest…</div>}
            {error && <div className="gamefiles-error">{error}</div>}

            {!loading && !error && (
                <div className="gamefiles-tree">
                    {manifest?.entries?.length ? manifest.entries.map((entry) => renderEntry(entry, gamefilesBase)) : (
                        <div className="gamefiles-empty">No entries found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GamefilesBrowser;
