const CACHE_NAME = 'cogerh-pwa-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon.svg',
  './cogerh_logo.png',
  './utfpr_logo.svg',
  './utfpr_logo_b.svg',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache external assets dynamically if they are successful
        if (response.status === 200 && (event.request.url.startsWith('http') || event.request.url.includes('googleapis') || event.request.url.includes('gstatic') || event.request.url.includes('cloudflare'))) {
          // DO NOT cache live spreadsheet queries so they are always fresh!
          if (event.request.url.includes('spreadsheets/d/') || event.request.url.includes('gviz/tq')) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Fallback for document fetch or other issues when offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline mode. Conexão indisponível.');
      });
    })
  );
});

// PWA BACKGROUND SYNC & LOCAL PUSH NOTIFICATION ENGINE
// ---------------------------------------------------------------------------

// Helper function to download Google Sheet tab in CSV format
async function downloadSheetCsv(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const text = await response.text();
    if (text.trim().length > 0 && !text.includes("<!DOCTYPE html>")) {
      return text;
    }
    return null;
  } catch (e) {
    console.error("Erro ao baixar aba no Service Worker: " + sheetName, e);
    return null;
  }
}

// Simple, robust, quote-safe CSV Parser
function parseCsvText(csvText) {
  const lines = csvText.split(/\r?\n/);
  const results = [];
  lines.forEach(line => {
    if (!line.trim()) return;
    const row = [];
    let insideQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField);
    results.push(row.map(f => f.trim().replace(/^"|"$/g, '')));
  });
  return results;
}

// Check latest notices on Google Sheets and notify if any are new
async function checkNewNoticesAndNotify() {
  try {
    // 1. Open sync-data cache and load current spreadsheet parameters and cached notices
    const cache = await caches.open('cogerh-sync-data');
    const cacheResponse = await cache.match('/pwa-sync-data.json');
    if (!cacheResponse) {
      console.log('Nenhum parâmetro de sincronização encontrado no cache do SW.');
      return;
    }
    
    const syncData = await cacheResponse.json();
    const spreadsheetId = syncData.spreadsheetId;
    const cachedNotices = syncData.notices || [];
    
    if (!spreadsheetId) return;
    
    // Create Set of previously known notice IDs
    const cachedIds = new Set(cachedNotices.map(n => n.id));
    
    // 2. Fetch the latest notices list
    const csvText = await downloadSheetCsv(spreadsheetId, 'avisos');
    if (!csvText) {
      console.warn('Não foi possível obter os avisos no segundo plano.');
      return;
    }
    
    // 3. Parse newest notices
    const rows = parseCsvText(csvText);
    const latestNotices = [];
    rows.forEach(row => {
      if (row.length < 3) return;
      const id = row[0]?.trim();
      if (!id || id.toLowerCase() === 'id') return; // Skip Header
      
      const title = row[1]?.trim() || '';
      const content = row[2]?.trim() || '';
      const date = row[3]?.trim() || '';
      const priorityText = row[4]?.trim()?.toLowerCase() || '';
      const isPriority = priorityText === 'true' || priorityText === 'sim' || priorityText === '1' || priorityText === 'yes';
      const category = row[5]?.trim() || 'Geral';
      
      latestNotices.push({ id, title, content, date, isPriority, category });
    });
    
    // 4. Compare lists and identify new items
    const newNotices = latestNotices.filter(n => !cachedIds.has(n.id));
    
    if (newNotices.length > 0) {
      console.log(`Detectados ${newNotices.length} novos avisos em segundo plano!`);
      
      // Limit to max 3 notifications at once
      const toNotify = newNotices.slice(0, 3);
      for (const notice of toNotify) {
        await self.registration.showNotification(notice.title || 'Novo Aviso COGERH', {
          body: notice.content || 'Acesse o aplicativo para ver mais detalhes.',
          icon: './icon.svg',
          badge: './favicon.svg',
          tag: 'notice-' + notice.id,
          data: { noticeId: notice.id },
          vibrate: [100, 50, 100],
          requireInteraction: notice.isPriority
        });
      }
      
      // 5. Update cached notices list so we don't notify of these again
      await cache.put(
        new Request('/pwa-sync-data.json'),
        new Response(JSON.stringify({ spreadsheetId, notices: latestNotices, updatedAt: Date.now() }), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    } else {
      console.log('Nenhum aviso novo detectado durante sincronização em segundo plano.');
    }
  } catch (error) {
    console.error('Falha na execução do checkNewNoticesAndNotify do SW:', error);
  }
}

// Listening to Periodic Background Sync API events (runs background routine when PWA is installed)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-notices') {
    event.waitUntil(checkNewNoticesAndNotify());
  }
});

// Listening to manual messages from main window
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'check-notices') {
    event.waitUntil(checkNewNoticesAndNotify());
  }
});

// Handling notification click interaction (Focus on app or open a specific notice)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetNoticeId = event.notification.data ? event.notification.data.noticeId : null;
      
      // 1. Try to find if app window is already open
      for (const client of clientList) {
        if (client.url.includes('/pwa') && 'focus' in client) {
          if (targetNoticeId) {
            client.postMessage({
              action: 'open-notice',
              noticeId: targetNoticeId
            });
          }
          return client.focus();
        }
      }
      
      // 2. If app window is not open, launch it
      if (clients.openWindow) {
        const url = './index.html' + (targetNoticeId ? `?noticeId=${targetNoticeId}` : '');
        return clients.openWindow(url);
      }
    })
  );
});
