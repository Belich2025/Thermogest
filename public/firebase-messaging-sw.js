importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC40dyuVwVflnxWDY2dabu7Q0RaMLIw0_M",
  authDomain: "thermogest-60f98.firebaseapp.com",
  projectId: "thermogest-60f98",
  storageBucket: "thermogest-60f98.firebasestorage.app",
  messagingSenderId: "489422877811",
  appId: "1:489422877811:web:1e09279e185d88161aa606"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png"
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('thermogest-app.vercel.app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://thermogest-app.vercel.app');
      }
    })
  );
});
