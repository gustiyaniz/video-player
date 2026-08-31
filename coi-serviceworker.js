/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener("message", (ev) => {
        if (!ev.data) { return; }
        if (ev.data.type === "deregister") {
            self.registration.unregister().then(() => { return self.clients.matchAll(); }).then(clients => {
                clients.forEach((client) => client.navigate(client.url));
            });
        }
        if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });
    self.addEventListener("fetch", function (event) {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") { return; }
        const request = (coepCredentialless && event.request.mode === "no-cors") ? new Request(event.request, { credentials: "omit" }) : event.request;
        event.respondWith(fetch(request).then((response) => {
            if (response.status === 0) { return response; }
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
        }).catch((e) => console.error(e)));
    });
} else {
    (() => {
        const resetInterceptors = () => {
            window.sessionStorage.removeItem("coiReloadedBySelf");
            window.sessionStorage.removeItem("coiCoepHasCoep");
        };
        const register = () => {
            window.navigator.serviceWorker.register(window.document.currentScript.src).then((registration) => {
                window.addEventListener("beforeunload", () => {
                    if (window.sessionStorage.getItem("coiReloadedBySelf")) { window.sessionStorage.removeItem("coiReloadedBySelf"); }
                });
                registration.addEventListener("updatefound", () => {
                    resetInterceptors();
                });
            }, (err) => { console.error("COI Service worker registration failed", err); });
        };
        const isCoiFrame = () => window.location === window.parent.location;
        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        if (!reloadedBySelf && isCoiFrame()) {
            window.sessionStorage.setItem("coiReloadedBySelf", "true");
            register();
            window.location.reload();
        } else if (isCoiFrame()) {
            window.sessionStorage.removeItem("coiReloadedBySelf");
            register();
        }
    })();
}
