import { BASE_PATH } from './utils';
import { bootGraph } from './bootGraph';

performance.mark('app:entry');

// Legacy HashRouter links (/#/SomeTech?x=y) — rewrite to real paths before the router reads the URL
if (window.location.hash.startsWith('#/')) {
  const [hashPath, hashQuery] = window.location.hash.slice(2).split('?');
  const search = new URLSearchParams(window.location.search);
  if (hashQuery) {
    new URLSearchParams(hashQuery).forEach((value, key) => search.set(key, value));
  }
  const query = search.toString();
  window.history.replaceState(null, '', BASE_PATH + hashPath + (query ? `?${query}` : ''));
}

// Paint the graph with just this chunk (vis-network, no React) …
bootGraph();

// … while the React app chunk loads and mounts around it
import('./appMain');
