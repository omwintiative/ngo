(function () {
  const trimTrailingSlash = (value) => (value || "").replace(/\/+$/, "");
  const configuredOrigin = trimTrailingSlash(window.__API_ORIGIN__ || "");
  const isLocalHost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );
  const fallbackOrigin = isLocalHost
    ? "http://localhost:5000"
    : window.location.origin;
  const apiOrigin = configuredOrigin || trimTrailingSlash(fallbackOrigin);

  window.APP_CONFIG = {
    apiOrigin,
    apiBase: `${apiOrigin}/api`,
    apiUrl(pathname) {
      const normalizedPath = pathname.startsWith("/")
        ? pathname
        : `/${pathname}`;
      return `${apiOrigin}/api${normalizedPath}`;
    },
    assetUrl(pathname) {
      if (!pathname) {
        return "";
      }

      if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
        return pathname;
      }

      const normalizedPath = pathname.startsWith("/")
        ? pathname
        : `/${pathname}`;
      return `${apiOrigin}${normalizedPath}`;
    },
  };
})();
