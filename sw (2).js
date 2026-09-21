// Service worker — met l'outil en cache pour qu'il fonctionne hors ligne
// une fois installé sur l'écran d'accueil (utile en territoire éloigné où
// le réseau cellulaire est faible ou absent, ex. secteur d'Obedjiwan).
//
// IMPORTANT : ce numéro de version doit être augmenté à chaque mise à jour
// déployée de l'outil (v2, v3, ...). Sans ça, les téléphones qui ont déjà
// installé l'appli continuent de voir l'ancienne version indéfiniment, même
// après un nouveau déploiement sur GitHub — le navigateur ne redétecte une
// mise à jour du service worker que si le contenu de CE fichier change.
const CACHE_NAME = "proope011-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Stratégie par type de requête :
// - La PAGE elle-même (navigation, index.html) est "réseau d'abord" : dès qu'il
//   y a du réseau, on affiche toujours la dernière version déployée. Le cache
//   ne sert que de secours si le téléphone est hors ligne. C'est ce qui manquait
//   avant : sans ça, une mise à jour déployée pouvait rester invisible sur les
//   téléphones qui avaient déjà ouvert l'outil une fois.
// - Les autres fichiers (icônes, manifest) restent "cache d'abord" : ils
//   changent rarement et ça garde l'ouverture instantanée hors ligne.
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  var isPage = event.request.mode === "navigate" ||
    (event.request.destination === "document") ||
    event.request.url.endsWith("/index.html") ||
    event.request.url.endsWith("/");

  if (isPage) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || networkFetch;
    })
  );
});
