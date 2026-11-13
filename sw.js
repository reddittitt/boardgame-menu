/* BGQuick app shell. Bump CACHE when the offline set should be thrown out. */
var CACHE = "bgquick-v1";
var SHELL = ["./index.html", "./logo.png", "./favicon.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isPrivatePhoto(url) {
  return url.pathname.indexOf("/put-away/") !== -1;
}

function isRulebookFile(url) {
  if (url.hostname === "bgquick-rulebooks-relay.bgquick.workers.dev") return true;
  return /\.pdf$/i.test(url.pathname);
}

function isHtml(request, url) {
  if (request.mode === "navigate") return true;
  var accept = request.headers.get("accept") || "";
  if (accept.indexOf("text/html") !== -1) return true;
  return /(?:^|\/)index\.html$/i.test(url.pathname) || url.pathname.endsWith("/");
}

function isJson(request, url) {
  var accept = request.headers.get("accept") || "";
  if (accept.indexOf("application/json") !== -1 || accept.indexOf("text/json") !== -1) return true;
  return /\.json$/i.test(url.pathname);
}

function isShellImage(url) {
  return /\.(?:png|webp|gif|jpe?g|svg|ico)$/i.test(url.pathname);
}

function store(request, response) {
  if (!response || !response.ok) return response;
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) {
    cache.put(request, copy);
  });
  return response;
}

function networkFirst(request) {
  return fetch(request).then(function (response) {
    return store(request, response);
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      return cached || caches.match("./index.html");
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    var network = fetch(request).then(function (response) {
      return store(request, response);
    }).catch(function () {
      return cached;
    });
    return cached || network;
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isPrivatePhoto(url) || isRulebookFile(url)) return;
  if (isHtml(request, url) || isJson(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isShellImage(url)) {
    event.respondWith(cacheFirst(request));
  }
});
