// 全屏壁纸模式（data-banner-display=fullscreen）首页 hero 标题视差淡出：
// banner 钉视口（position:fixed）后，标题随滚动上移并渐隐（对齐 Firefly
// requestFullscreenTitleParallax：滚动 0.5 视口高完全淡出，translateY 记忆化）。
// 仅在「全屏 + 首页」生效；模式切换/换页（swup）自动复位。
(() => {
  if (typeof window === "undefined") return;
  if (window.__fullscreenHeroBound) return;
  window.__fullscreenHeroBound = true;

  const FADE_RATIO = 0.5;
  const BLUR_RAMP_SCROLL = 300; // 首页下滑 300px 后壁纸模糊达到滑块最大值（对齐 Firefly）
  let ticking = false;
  let lastTransform = "";
  let lastOpacity = "";
  let lastBlur = "";

  function apply() {
    ticking = false;
    const html = document.documentElement;
    const active =
      html.getAttribute("data-banner-display") === "fullscreen" &&
      document.body.classList.contains("is-home");
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    applyBlurRamp(scrollY, active);
    const overlay = document.getElementById("banner-overlay");
    if (!overlay) return;
    if (!active) {
      if (lastTransform !== "") overlay.style.transform = "";
      if (lastOpacity !== "") overlay.style.opacity = "";
      lastTransform = "";
      lastOpacity = "";
      return;
    }
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

  // 全屏壁纸模糊斜坡：0 → max（max = 面板「模糊度」滑块值，body 上的
  // --transparent-wallpaper-blur；未设过则为默认 10px）。2px 量化 + 记忆化，
  // 避免模糊逐帧重栅格化（对齐 Firefly syncFullscreenBlur 策略）。
  function applyBlurRamp(scrollY: number, active: boolean) {
    const html = document.documentElement;
    let value = "0px";
    if (active) {
      const maxRaw = getComputedStyle(document.body)
        .getPropertyValue("--transparent-wallpaper-blur")
        .trim();
      const max = parseFloat(maxRaw) || 10;
      const target = Math.min(scrollY / BLUR_RAMP_SCROLL, 1) * max;
      value = `${Math.round(target / 2) * 2}px`;
    }
    if (value !== lastBlur) {
      html.style.setProperty("--fullscreen-wallpaper-blur", value);
      lastBlur = value;
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
