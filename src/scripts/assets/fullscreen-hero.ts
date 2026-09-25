// 全屏壁纸模式（data-banner-display=fullscreen）首页 hero 标题视差淡出：
// banner 钉视口（position:fixed）后，标题随滚动上移并渐隐（对齐 Firefly
// requestFullscreenTitleParallax：滚动 0.5 视口高完全淡出，translateY 记忆化）。
// 仅在「全屏 + 首页」生效；模式切换/换页（swup）自动复位。
(() => {
  if (typeof window === "undefined") return;
  if (window.__fullscreenHeroBound) return;
  window.__fullscreenHeroBound = true;

  const FADE_RATIO = 0.5;
  let ticking = false;
  let lastTransform = "";
  let lastOpacity = "";

  function apply() {
    ticking = false;
    const overlay = document.getElementById("banner-overlay");
    if (!overlay) return;
    const html = document.documentElement;
    const active =
      html.getAttribute("data-banner-display") === "fullscreen" &&
      document.body.classList.contains("is-home");
    if (!active) {
      if (lastTransform !== "") overlay.style.transform = "";
      if (lastOpacity !== "") overlay.style.opacity = "";
      lastTransform = "";
      lastOpacity = "";
      return;
    }
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const fade = window.innerHeight * FADE_RATIO;
    const ratio = Math.min(scrollY / fade, 1);
    const transform = scrollY > 0 ? `translateY(${-scrollY}px)` : "";
    const opacity = ratio >= 1 ? "0" : String(1 - ratio);
    // 记忆化：值未变不写合成层属性
    if (transform !== lastTransform) {
      overlay.style.transform = transform;
      lastTransform = transform;
    }
    if (opacity !== lastOpacity) {
      overlay.style.opacity = opacity;
      lastOpacity = opacity;
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("swup:contentReplaced", () =>
    requestAnimationFrame(apply),
  );
  new MutationObserver(() => requestAnimationFrame(apply)).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["data-banner-display"] },
  );
  apply();
})();
