const CACHE_NAME = 'gestao-rural-cache-v23'; // Versão do cache incrementada
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto e assets essenciais adicionados');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Falha ao abrir o cache durante a instalação:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Estratégia 1: Ignorar cache para a API do Supabase (sempre ir para a rede)
  if (url.hostname.includes('supabase.co')) {
    // Deixa o navegador lidar com a requisição, sem interceptar.
    return;
  }

  // Estratégia 2: Stale-While-Revalidate para todos os outros assets.
  // Responde imediatamente com o cache (se disponível), depois atualiza o cache em segundo plano.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Se a requisição à rede for bem-sucedida, atualiza o cache.
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            // A rede falhou. Se tínhamos uma resposta em cache, ela já foi retornada.
            // Se não, o erro se propagará.
            console.warn('Requisição de rede falhou:', event.request.url, err);
            // Retorna a resposta do cache como fallback final, se existir.
            return cachedResponse;
        });

        // Retorna a resposta do cache imediatamente se existir, caso contrário, aguarda a rede.
        // Isso torna o carregamento do app quase instantâneo em visitas repetidas.
        return cachedResponse || fetchPromise;
      });
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  // Remove caches antigos que não estão na whitelist.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});