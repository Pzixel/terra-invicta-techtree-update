#!/usr/bin/env node
// Submits the built sitemap's URLs to IndexNow after a deploy.
//
// IndexNow is supported by Bing, Yandex, Seznam and Naver — not by Google, which
// evaluated the protocol and never adopted it. Google still has to discover
// changes through its own crawl of the sitemap.
//
// The key is public by design: IndexNow authenticates a submission by fetching
// the key file over HTTP, so it proves control of the host rather than acting as
// a secret. Hosting it at the host root authorises URLs anywhere on the host.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HOST = 'pzixel.github.io';
const KEY = 'd6deafed93e0f42978b3b4fb3d0b58e3';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // protocol limit for a single submission

const sitemapPath = path.resolve(process.argv[2] || 'dist/sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());

if (urlList.length === 0) throw new Error(`${sitemapPath}: no <loc> entries to submit`);
if (urlList.length > MAX_URLS) throw new Error(`${sitemapPath}: ${urlList.length} URLs exceeds the ${MAX_URLS} limit`);

const offHost = urlList.filter((url) => new URL(url).host !== HOST);
if (offHost.length > 0) throw new Error(`sitemap contains URLs outside ${HOST}: ${offHost[0]}`);

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  }),
});

// 200 accepted, 202 accepted but the key is still being verified. Anything else
// fails the step so a broken key file or a malformed payload is not silent.
if (response.status !== 200 && response.status !== 202) {
  throw new Error(`IndexNow returned ${response.status} ${response.statusText}: ${await response.text()}`);
}

console.log(`Submitted ${urlList.length} URLs to IndexNow (HTTP ${response.status})`);
