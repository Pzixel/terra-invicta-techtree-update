// Pre-React graph boot: draws the precompiled graph bundle as soon as this
// chunk (vis-network + glue, no React/MUI) has executed. The React app later
// adopts the drawn network via window.__graphBoot instead of redrawing.
import { drawBundle, GraphBundle } from './techGraphRender';
import { assetUrl, BASE_PATH } from './utils';

export interface GraphBootHandle {
    key: string;
    bundle: GraphBundle | null;
    bundlePromise: Promise<GraphBundle | null>;
    network: ReturnType<typeof drawBundle> | null;
    container: HTMLDivElement;
    adopted: boolean;
    queuedNav: (string | null)[];
    onNavigate: (dataName: string | null) => void;
}

declare global {
    interface Window { __graphBoot?: GraphBootHandle; }
}

const LANGS = ['en', 'chs', 'cht', 'deu', 'esp', 'fr', 'jpn', 'pol', 'por', 'kor', 'rus', 'ukr'];

export function bootGraph() {
    // Mirrors the app's mobile-layout breakpoint: no graph below 900px
    if (window.innerWidth < 900) return;

    const path = window.location.pathname.startsWith(BASE_PATH)
        ? window.location.pathname.slice(BASE_PATH.length)
        : '';
    const segment = decodeURIComponent(path.replace(/\/+$/, '').split('/')[0] ?? '');
    if (segment === 'browse' || segment === 'drives') return;
    const selectedId = segment || null;

    const query = new URLSearchParams(window.location.search);
    const version = query.get('ver') === 'experimental' ? 'experimental' : 'stable';
    const langParam = query.get('lang');
    const lang = langParam && LANGS.includes(langParam) ? langParam : 'en';
    const key = `${version}.${lang}`;

    // Same container id/styling the app uses; inline styles because App.css
    // arrives with the React chunk
    const container = document.createElement('div');
    container.id = 'mynetwork';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.border = '1px solid lightgray';
    document.body.appendChild(container);

    const handle: GraphBootHandle = {
        key,
        bundle: null,
        bundlePromise: Promise.resolve(null),
        network: null,
        container,
        adopted: false,
        queuedNav: [],
        onNavigate: (dataName) => { handle.queuedNav.push(dataName); },
    };
    window.__graphBoot = handle;

    performance.mark('graph:bundle-fetch-start');
    handle.bundlePromise = fetch(assetUrl(`graph/${key}.json`))
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((bundle: GraphBundle | null) => {
            performance.measure('graph:bundle-fetch', 'graph:bundle-fetch-start');
            handle.bundle = bundle;
            if (bundle && !handle.adopted) {
                performance.mark('graph:draw-start');
                handle.network = drawBundle(bundle, (dataName) => handle.onNavigate(dataName), selectedId, container);
                performance.measure('graph:draw', 'graph:draw-start');
            }
            if (!bundle) {
                container.remove();
            }
            return bundle;
        });
}
