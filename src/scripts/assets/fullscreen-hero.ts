// 全屏 hero 壁纸特效（data-banner-display=fullscreen + data-fullscreen-layout=hero）：
// 首页 hero 标题视差淡出（对齐 Firefly requestFullscreenTitleParallax：滚动 0.5
// 视口高完全淡出，translateY 记忆化）+ 壁纸模糊斜坡（首页 0→max / 非首页固定 max，
// 对齐 Firefly syncFullscreenBlur）。classic 布局或非全屏时全部复位。
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

  function isHeroFullscreen() {
    const html = document.documentElement;
    return (
      html.getAttribute("data-banner-display") === "fullscreen" &&
      html.getAttribute("data-fullscreen-layout") === "hero"
    );
  }

  function apply() {
    ticking = false;
    const hero = isHeroFullscreen();
    const isHome = document.body.classList.contains("is-home");
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    // 模糊：hero 时首页斜坡 / 非首页固定 max；非 hero 复位 0
    applyBlurRamp(scrollY, hero, isHome);
    const overlay = document.getElementById("banner-overlay");
    if (!overlay) return;
    const active = hero && isHome;
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

  // 全屏 hero 壁纸模糊斜坡：首页 0 → max（300px 滚动到顶），非首页固定 max；
  // max = 面板「模糊度」滑块值（body 的 --transparent-wallpaper-blur，未设 10px）。
  // 2px 量化 + 记忆化，避免模糊逐帧重栅格化（对齐 Firefly syncFullscreenBlur 策略）。
  function applyBlurRamp(scrollY: number, hero: boolean, isHome: boolean) {
    const html = document.documentElement;
    let value = "0px";
    if (hero) {
      const maxRaw = getComputedStyle(document.body)
        .getPropertyValue("--transparent-wallpaper-blur")
        .trim();
      const max = parseFloat(maxRaw) || 10;
      const ratio = isHome ? Math.min(scrollY / BLUR_RAMP_SCROLL, 1) : 1;
      const target = ratio * max;
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
    {
      attributes: true,
      attributeFilter: ["data-banner-display", "data-fullscreen-layout"],
    },
  );
  apply();
})();
