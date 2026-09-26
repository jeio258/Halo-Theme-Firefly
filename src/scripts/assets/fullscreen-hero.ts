// 全屏 hero 壁纸特效（1:1 对标 Firefly fullscreen-wallpaper-utils.ts）：
// - 壁纸模糊：首页随下滑 0→max 连续渐变（300px 到顶），非首页固定 max；
//   max = 面板「背景模糊度」滑块值（body --transparent-wallpaper-blur，显式 0 = 不模糊原样生效，未设置默认 10px）。
// - 首页标题视差：随滚动上移并 0.5 视口高完全淡出（对齐 Firefly updateFullscreenTitleParallax）。
// 仅「全屏 + hero 布局」生效；classic / 非全屏 复位。
// 结构：scroll + 面板事件（bannerModeChange / fullscreenLayoutChange /
// wallpaperParamsChanged）+ Swup 换页钩子（v4 走 hooks，非 v3 的 swup:contentReplaced），
// 无散落的属性/style MutationObserver（对齐 Firefly 的事件驱动，消除补丁堆叠）。
(() => {
  if (typeof window === "undefined" || window.__fullscreenHeroBound) return;
  window.__fullscreenHeroBound = true;

  const TITLE_FADE_RATIO = 0.5; // 首页下滑 0.5 视口高标题完全淡出
  const BLUR_RAMP_SCROLL = 300; // 首页下滑该距离后壁纸模糊达最大值（对齐 Firefly）
  const BLUR_QUANTIZE_STEP = 2; // 2px 量化，避免全屏 blur 逐帧重栅格化
  const html = document.documentElement;
  const body = document.body;

  let ticking = false;
  let lastBlur = "";
  let lastTransform = "";
  let lastOpacity = "";
  let classicHintShown = false;

  function isHeroFullscreen() {
    return (
      html.getAttribute("data-banner-display") === "fullscreen" &&
      html.getAttribute("data-fullscreen-layout") === "hero"
    );
  }
  const isHome = () => body.classList.contains("is-home");

  // 面板滑块值（body 计算值）；显式 0 原样生效（不模糊），仅未设置 → 10px
  function readMaxBlur(): number {
    const raw = getComputedStyle(body)
      .getPropertyValue("--transparent-wallpaper-blur")
      .trim();
    const max = parseFloat(raw);
    return Number.isFinite(max) && max >= 0 ? max : 10;
  }

  function setBlurIfChanged(value: string) {
    if (value === lastBlur) return;
    lastBlur = value;
    html.style.setProperty("--fullscreen-wallpaper-blur", value);
  }

  // 壁纸模糊：首页 0→max（随下滑），非首页固定 max（对齐 Firefly syncFullscreenBlur）
  function syncBlur() {
    if (!isHeroFullscreen()) {
      setBlurIfChanged("0px");
      // R1 可诊断（不改 1:1 行为，仅一次性提示）：全屏经典布局天生不模糊
      if (
        !classicHintShown &&
        html.getAttribute("data-banner-display") === "fullscreen" &&
        html.getAttribute("data-fullscreen-layout") === "classic"
      ) {
        classicHintShown = true;
        console.info(
          "[Ethereal] 全屏=经典布局，不应用壁纸模糊；面板切「沉浸」(hero) 后模糊才生效。",
        );
      }
      return;
    }
    const max = readMaxBlur();
    if (!isHome()) {
      setBlurIfChanged(`${max}px`);
      return;
    }
    const scrollY = window.pageYOffset || html.scrollTop;
    const ratio = Math.min(scrollY / BLUR_RAMP_SCROLL, 1);
    setBlurIfChanged(
      `${Math.floor((ratio * max) / BLUR_QUANTIZE_STEP) * BLUR_QUANTIZE_STEP}px`,
    );
  }

  // 首页标题视差淡出（对齐 Firefly）：仅首页 hero，越界/非首页复位
  function updateParallax() {
    const overlay = document.getElementById("banner-overlay");
    if (!overlay) return;
    if (!(isHeroFullscreen() && isHome())) {
      if (lastTransform !== "" || lastOpacity !== "") {
        lastTransform = "";
        lastOpacity = "";
        overlay.style.transform = "";
        overlay.style.opacity = "";
      }
      return;
    }
    const scrollY = window.pageYOffset || html.scrollTop;
    const fade = window.innerHeight * TITLE_FADE_RATIO;
    const ratio = Math.min(scrollY / fade, 1);
    const transform = scrollY > 0 ? `translateY(${-scrollY}px)` : "";
    const opacity = ratio >= 1 ? "0" : String(1 - ratio);
    if (transform !== lastTransform || opacity !== lastOpacity) {
      lastTransform = transform;
      lastOpacity = opacity;
      overlay.style.transform = transform;
      overlay.style.opacity = opacity;
    }
  }

  function frame() {
    ticking = false;
    updateParallax();
    syncBlur();
  }
  function request() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }

  // 事件驱动重算（对齐 Firefly：面板事件 + 换页钩子 + 滚动），无宽范围 MutationObserver
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("bannerModeChange", request);
  window.addEventListener("fullscreenLayoutChange", request);
  window.addEventListener("wallpaperParamsChanged", request);
  // Swup v4 换页（首页↔非首页 is-home 变化）重算；v4 走 hooks（同 navbar.ts 的 swup:enable 约定），
  // 而非 v3 的 document "swup:contentReplaced"（v4 从未分发，旧监听是死代码）
  document.addEventListener("swup:enable", () => {
    const swup = (
      window as unknown as {
        swup?: { hooks?: { on(hook: string, fn: () => void): void } };
      }
    ).swup;
    swup?.hooks?.on("content:replace", request);
  });

  frame(); // 初始（首帧脚本已置好 data-banner-display / data-fullscreen-layout）
})();
