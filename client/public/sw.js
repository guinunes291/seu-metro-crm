// Service Worker para Seu Metro Quadrado PWA
const CACHE_NAME = 'seu-metro-quadrado-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Arquivos essenciais para cache inicial
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de cache: Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições para APIs externas e WebSockets
  if (url.origin !== location.origin || 
      request.url.includes('/api/') ||
      request.url.includes('socket') ||
      request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clonar a resposta para armazenar no cache
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar buscar do cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Retornar página offline se disponível
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Receber mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notificações push (preparado para uso futuro)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'Nova notificação',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/'
        },
        actions: [
          { action: 'open', title: 'Abrir' },
          { action: 'close', title: 'Fechar' }
        ]
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Seu Metro Quadrado', options)
          .catch((error) => {
            console.error('[SW] Erro ao mostrar notificação:', error);
          })
      );
    } catch (error) {
      console.error('[SW] Erro ao processar push:', error);
    }
  }
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
  try {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
      const url = event.notification.data?.url || '/';
      event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
          for (const client of clientList) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        }).catch((error) => {
          console.error('[SW] Erro ao abrir janela:', error);
        })
      );
    }
  } catch (error) {
    console.error('[SW] Erro ao processar clique:', error);
  }
});
