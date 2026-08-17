/* TinyTweet service worker — Web Push only.
   Shows a notification for each push and routes clicks to the right page. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "TinyTweet";
  const options = {
    body: data.body || "",
    icon: data.icon || "/apple-icon.png", // PNG renders on all platforms
    badge: "/apple-icon.png",
    tag: data.tag, // collapse repeat alerts for the same thing
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    (async () => {
      // If a TinyTweet tab is already focused/visible, the in-app toast + ping
      // already alerted the user — don't also fire an OS notification.
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = windows.some(
        (c) => c.focused || c.visibilityState === "visible"
      );
      if (focused) return;
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab and route it, else open a new one.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
