/* BGQuick offline cache.

   VERSION is the app-shell generation. Bump it when a deploy should drop the
   previous shell. HTML and JSON are network-first, so a new page is not left
   paired with old data while the device is online. Images are stale-while-
   revalidate and capped. Saved-for-offline images live in their own cache so
   the cap does not evict them. Old cache names are deleted on activate.

   Cross-origin requests are never intercepted. That includes the rulebook
   relay, publisher PDFs, cover CDNs, fonts, and Game Day RSVPs posted to
   script.google.com. RSVP and food responses are never cached. Same-origin
   PDFs are not cached either. A cache-busted read of this file is left
   to the network so the page can compare it with GET_VERSION. Bare
   /sw.js may be edge-cached for hours.
*/
var VERSION = "2026.11.21.28";
var SHELL = "bgquick-shell-" + VERSION;
var DATA = "bgquick-data";
var IMAGES = "bgquick-images";
var SAVED = "bgquick-saved";
var IMAGE_CAP = 80;
var SAVED_CAP = 60;
var SHELL_FILES = [
  "./index.html",
  "./game-day.html",
  "./game-day.js",
  "./offline.html",
  "./manifest.json",
  "./logo.png",
  "./favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-maskable-512.png",
  "./game-night.js",
  "./game-night.css",
  "./first-player.json",
  "./expansion-guides.json",
  "./components.json",
  "./selection.mjs",
  "./data/game-days.json"
];
var lastQuota = false;

function keepCache(name) {
  return name === SHELL || name === DATA || name === IMAGES || name === SAVED;
}

function isQuota(err) {
  if (!err) return false;
  var name = err.name || "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  return /quota/i.test(String(err.message || err));
}

function bare(url) {
  return new Request(url, { method: "GET" });
}

function precache() {
  return caches.open(SHELL).then(function (cache) {
    var required = {
      "./index.html": true,
      "./offline.html": true,
      "./game-night.js": true,
      "./game-night.css": true
    };
    return Promise.all(SHELL_FILES.map(function (url) {
      return fetch(new Request(url, { cache: "reload", credentials: "same-origin" })).then(function (res) {
        if (!res || !res.ok) throw new Error("precache " + url);
        return cache.put(url, forCache(res) || res);
      }).catch(function (err) {
        if (required[url]) throw err;
      });
    }));
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(precache().catch(function (err) {
    /* A failed install leaves the previous worker, if any, in control. */
    throw err;
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().catch(function () { return []; }).then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (keepCache(key)) return Promise.resolve(false);
        return caches.delete(key).catch(function () { return false; });
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function evict(name, count) {
  if (!count) return Promise.resolve();
  return caches.open(name).then(function (cache) {
    return cache.keys().then(function (keys) {
      return Promise.all(keys.slice(0, count).map(function (key) {
        return cache.delete(key);
      }));
    });
  }).catch(function () {});
}

function forCache(response) {
  try {
    if (!response.redirected) return response.clone();
    return new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    });
  } catch (err) {
    return null;
  }
}

function safePut(cache, url, response) {
  if (!response || !response.ok || (response.type && response.type !== "basic")) {
    return Promise.resolve(false);
  }
  var req = bare(url);
  var first = forCache(response);
  if (!first) return Promise.resolve(false);
  return cache.put(req, first).then(function () {
    return true;
  }).catch(function (err) {
    if (!isQuota(err)) return false;
    lastQuota = true;
    return evict(IMAGES, 40).then(function () {
      return evict(SAVED, 8);
    }).then(function () {
      var second = forCache(response);
      if (!second) return false;
      return cache.put(req, second).then(function () { return true; }).catch(function () { return false; });
    });
  });
}

function trim(cache, url, cap) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - cap;
    if (extra <= 0) return;
    var doomed = [];
    keys.forEach(function (key) {
      if (doomed.length >= extra) return;
      if (key.url.split("?")[0] !== url.split("?")[0]) doomed.push(key);
    });
    keys.forEach(function (key) {
      if (doomed.length >= extra) return;
      doomed.push(key);
    });
    return Promise.all(doomed.map(function (key) { return cache.delete(key); }));
  });
}

function putCapped(name, url, response, cap) {
  return caches.open(name).then(function (cache) {
    return safePut(cache, url, response).then(function (ok) {
      if (!ok) return false;
      return trim(cache, url, cap).then(function () { return true; });
    });
  }).catch(function () { return false; });
}

function storeImage(url, response, pin) {
  return caches.open(SAVED).then(function (cache) {
    return cache.match(bare(url), { ignoreSearch: true }).then(function (pinned) {
      if (pin || pinned) {
        return putCapped(SAVED, url, response, SAVED_CAP).then(function (ok) {
          if (!ok) return false;
          return caches.open(IMAGES).then(function (images) {
            return images.delete(bare(url));
          }).catch(function () {}).then(function () { return true; });
        });
      }
      return putCapped(IMAGES, url, response, IMAGE_CAP);
    });
  });
}

function matchCache(name, url) {
  return caches.open(name).then(function (cache) {
    return cache.match(bare(url), { ignoreSearch: true });
  }).catch(function () {
    return caches.delete(name).catch(function () {}).then(function () { return undefined; });
  });
}

function matchImage(url) {
  return matchCache(SAVED, url).then(function (hit) {
    if (hit) return hit;
    return matchCache(IMAGES, url).then(function (hit2) {
      if (hit2) return hit2;
      return matchCache(SHELL, url);
    });
  });
}

function classify(href, response) {
  var path = "";
  try { path = new URL(href).pathname; } catch (err) { return ""; }
  if (/\.pdf$/i.test(path) || path.indexOf("/put-away/") !== -1) return "";
  var type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.indexOf("text/html") !== -1 || /\/(?:index|offline)\.html$/i.test(path) || path.endsWith("/")) return "html";
  if (type.indexOf("json") !== -1 || /\.json$/i.test(path)) return "json";
  if (/\.(?:mjs|js|css)$/i.test(path) || type.indexOf("javascript") !== -1 || type.indexOf("text/css") !== -1) return "script";
  if (type.indexOf("image/") !== -1 || /\.(?:png|webp|gif|jpe?g|svg|ico|avif)$/i.test(path)) return "image";
  return "";
}

function cacheOne(raw, pin) {
  var url;
  try { url = new URL(raw, self.location.href); }
  catch (err) { return Promise.resolve("skip"); }
  if (url.origin !== self.location.origin) return Promise.resolve("skip");
  if (url.pathname.indexOf("/put-away/") !== -1) return Promise.resolve("skip");
  if (/\.pdf$/i.test(url.pathname)) return Promise.resolve("skip");
  if (/\/sw\.js$/i.test(url.pathname)) return Promise.resolve("skip");
  var href = url.origin + url.pathname;
  var quotaBefore = lastQuota;
  return fetch(new Request(href, { method: "GET", cache: "reload", credentials: "same-origin" })).then(function (response) {
    if (!response || response.status === 404 || response.status === 204) return "skip";
    if (!response.ok || response.type !== "basic") return "fail";
    var kind = classify(href, response);
    if (!kind) return "skip";
    var stored;
    if (kind === "html") {
      stored = caches.open(SHELL).then(function (cache) {
        return safePut(cache, href, response).then(function (ok) {
          if (!ok) return false;
          var indexUrl = new URL("./index.html", self.location.href).href;
          if (href === indexUrl) return true;
          /* Root-only mirror. A /game/<slug>/ document must not replace the shell. */
          var rootPath = new URL("./", self.location.href).pathname;
          if (url.pathname !== rootPath) return true;
          return safePut(cache, indexUrl, response);
        });
      });
    } else if (kind === "json" || kind === "script") {
      stored = caches.open(kind === "script" ? SHELL : DATA).then(function (cache) {
        return safePut(cache, href, response);
      });
    } else {
      stored = storeImage(href, response, pin);
    }
    return stored.then(function (ok) {
      if (ok) return "saved";
      if (lastQuota && !quotaBefore) return "quota";
      return "fail";
    });
  }).catch(function (err) {
    if (isQuota(err)) return "quota";
    return "fail";
  });
}

function cacheUrlList(urls, pin) {
  var saved = 0;
  var failed = 0;
  var quota = false;
  var list = Array.isArray(urls) ? urls : [];
  var index = 0;
  function next() {
    if (index >= list.length) {
      return Promise.resolve({
        ok: failed === 0 && !quota && saved > 0,
        saved: saved,
        failed: failed,
        quota: quota
      });
    }
    var url = list[index];
    index += 1;
    return cacheOne(url, pin).then(function (result) {
      if (result === "saved") saved += 1;
      else if (result === "quota") { quota = true; failed += 1; }
      else if (result === "fail") failed += 1;
      return next();
    });
  }
  return next();
}

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "GET_VERSION") {
    var reply = { type: "VERSION", version: VERSION };
    if (event.source && event.source.postMessage) event.source.postMessage(reply);
    return;
  }
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type !== "CACHE_URLS") return;
  event.waitUntil(cacheUrlList(data.urls, !!data.pin).then(function (result) {
    result.type = "CACHE_URLS_RESULT";
    result.id = data.id;
    if (event.source && event.source.postMessage) {
      event.source.postMessage(result);
      return;
    }
    return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      clients.forEach(function (client) { client.postMessage(result); });
    });
  }));
});

function isHtml(request, url) {
  if (request.mode === "navigate") return true;
  var accept = request.headers.get("accept") || "";
  if (accept.indexOf("text/html") !== -1 && url.pathname.indexOf("/rulebooks/") === -1) return true;
  return /\/(?:index|offline)\.html$/i.test(url.pathname) || url.pathname.endsWith("/");
}

function isJson(url) {
  return /\.json$/i.test(url.pathname);
}

function isImage(url) {
  return /\.(?:png|webp|gif|jpe?g|svg|ico|avif)$/i.test(url.pathname);
}

function shellDocument() {
  var indexUrl = new URL("./index.html", self.location.href).href;
  var offlineUrl = new URL("./offline.html", self.location.href).href;
  return matchCache(SHELL, indexUrl).then(function (indexHit) {
    if (indexHit) return indexHit;
    return matchCache(SHELL, offlineUrl).then(function (offlineHit) {
      if (offlineHit) return offlineHit;
      return new Response("You're offline. Open Board Game Quick once while you have a connection.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    });
  });
}

function isGameDocument(pathname) {
  return /\/game\/[^/]+\/index\.html$/i.test(pathname) || /\/game\/[^/]+\/?$/i.test(pathname);
}

function fromShell(request) {
  return matchCache(SHELL, request.url).then(function (hit) {
    if (!hit) return shellDocument();
    var path = "";
    try { path = new URL(request.url).pathname; } catch (err) { return hit; }
    /* A cached stub cannot boot offline by itself. Serve the app shell for that URL. */
    if (!isGameDocument(path)) return hit;
    return hit.clone().text().then(function (text) {
      if (text.indexOf("bgq-game-stub") !== -1) return shellDocument();
      return hit;
    }).catch(function () { return shellDocument(); });
  });
}

function gate() {
  var finish = function () {};
  var promise = new Promise(function (resolve) { finish = resolve; });
  return { promise: promise, finish: finish };
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  /* Hard rule: never touch a request that belongs to another origin.
     Game Day calls script.google.com. Leave those requests alone so RSVP
     and food responses are never cached here. */
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  if (request.headers.has("range")) return;
  if (url.pathname.indexOf("/put-away/") !== -1) return;
  if (/\.pdf$/i.test(url.pathname)) return;
  if (/\/sw\.js$/i.test(url.pathname)) return;

  /* Same-origin scripts and styles for Game Day and Game Night.
     Cross-origin requests already returned above, including script.google.com,
     and are not cached. */
  if (/\.(?:mjs|js|css)$/i.test(url.pathname)) {
    var assetGate = gate();
    event.waitUntil(assetGate.promise);
    event.respondWith(fetch(new Request(request.url, {
      method: "GET",
      cache: "reload",
      credentials: "same-origin"
    })).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        caches.open(SHELL).then(function (cache) {
          return safePut(cache, request.url, response.clone());
        }).catch(function () {}).then(assetGate.finish, assetGate.finish);
      } else {
        assetGate.finish();
      }
      if (response) return response;
      return matchCache(SHELL, request.url);
    }).catch(function () {
      assetGate.finish();
      return matchCache(SHELL, request.url).then(function (cached) {
        return cached || new Response("", { status: 504, statusText: "offline" });
      });
    }));
    return;
  }

  if (isHtml(request, url)) {
    var htmlGate = gate();
    event.waitUntil(htmlGate.promise);
    event.respondWith(fetch(new Request(request.url, {
      method: "GET",
      cache: "reload",
      credentials: "same-origin"
    })).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        var forRequest = response.clone();
        var forIndex = response.clone();
        caches.open(SHELL).then(function (cache) {
          return safePut(cache, request.url, forRequest).then(function (ok) {
            if (!ok) return;
            var indexUrl = new URL("./index.html", self.location.href).href;
            if (request.url.split("?")[0] === indexUrl) return;
            var rootPath = new URL("./", self.location.href).pathname;
            if (url.pathname !== rootPath) return;
            return safePut(cache, indexUrl, forIndex);
          });
        }).catch(function () {}).then(htmlGate.finish, htmlGate.finish);
      } else {
        htmlGate.finish();
      }
      if (response) return response;
      return fromShell(request);
    }).catch(function () {
      htmlGate.finish();
      if (request.mode === "navigate" || isHtml(request, url)) return fromShell(request);
      return new Response("", { status: 504, statusText: "offline" });
    }));
    return;
  }

  if (isJson(url)) {
    var jsonGate = gate();
    event.waitUntil(jsonGate.promise);
    event.respondWith(fetch(new Request(request.url, {
      method: "GET",
      cache: "reload",
      credentials: "same-origin"
    })).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        caches.open(DATA).then(function (cache) {
          return safePut(cache, request.url, response.clone());
        }).catch(function () {}).then(jsonGate.finish, jsonGate.finish);
      } else {
        jsonGate.finish();
      }
      return response;
    }).catch(function () {
      jsonGate.finish();
      return matchCache(DATA, request.url).then(function (cached) {
        if (cached) return cached;
        return matchCache(SHELL, request.url).then(function (shellHit) {
          return shellHit || new Response("", { status: 504, statusText: "offline" });
        });
      });
    }));
    return;
  }

  if (isImage(url)) {
    var imageGate = gate();
    event.waitUntil(imageGate.promise);
    event.respondWith(matchImage(request.url).then(function (cached) {
      var network = fetch(new Request(request.url, {
        method: "GET",
        credentials: "same-origin"
      })).then(function (response) {
        if (response && response.ok && response.type === "basic") {
          return storeImage(request.url, response.clone(), false).catch(function () {}).then(function () {
            return response;
          });
        }
        return response;
      }).catch(function () {
        return cached || new Response("", { status: 504, statusText: "offline" });
      });
      if (cached) {
        network.then(imageGate.finish, imageGate.finish);
        return cached;
      }
      return network.then(function (response) {
        imageGate.finish();
        return response;
      });
    }));
  }
});
