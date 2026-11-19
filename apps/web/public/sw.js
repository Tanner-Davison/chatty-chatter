// Shows pop-up alerts pushed by the server and opens the app when one is clicked.
// The payload is { title, body, url, tag } (see alertText in @chatty/shared).

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const alert = event.data.json();
  event.waitUntil(
    self.registration.showNotification(alert.title, {
      body: alert.body,
      tag: alert.tag,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: { url: alert.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/notifications", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open tab rather than opening another.
      const tab = windows.find((w) => new URL(w.url).origin === url.origin);
      if (tab) {
        await tab.focus();
        return tab.navigate(url.href);
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
