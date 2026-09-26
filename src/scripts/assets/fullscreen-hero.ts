// 全屏壁纸（沉浸）特效 —— 1:1 移植自 Firefly src/utils/fullscreen-wallpaper-utils.ts
// 函数名/算法/参数/守卫顺序与原文件一致，仅下列平台契约差异（Dom 映射，逻辑不变）：
//   1. #banner-overlay-container → #banner-overlay（Ethereal 标题/元信息容器）
//   2. html[data-wallpaper-mode]  → html[data-banner-display]（Ethereal 壁纸模式属性）
//   3. is-home 判定：Firefly 用 URL 路径（静态站恒为 "/"）；Ethereal 用 body.is-home
//      （Halo 多路由：index/文章/瞬间等，路径不可靠）
//   4. 模糊 max 源：Firefly 读 wrapper 的 --overlay-blur（面板滑块直写 wrapper）；
//      Ethereal 面板滑块写 body 的 --transparent-wallpaper-blur（首帧脚本同值初始化）
//   5. 模糊写入变量：Firefly 写 wrapper --fullscreen-blur；Ethereal 写 html
//      --fullscreen-wallpaper-blur（components.css 消费，#banner img filter）
//   6. 滑块监听：Firefly MutationObserver 观察 wrapper style；Ethereal 面板滑块
//      派发 wallpaperParamsChanged 事件（等价语义：滑块变化 → 失效缓存 + 重同步）
//   7. 壁纸模式切换事件：Firefly wallpaperModeChange；Ethereal bannerModeChange
//   8. Swup 换页：Firefly 静态站模块初始化一次；Ethereal 经典脚本被
//      SwupScriptsPlugin 按页重执行，__fullscreenHeroBound 守卫防重复绑定，
//      swup v4 content:replace 钩子换页后重算
//   9. 未设模糊值回退：Firefly 未设 → 0（不模糊）；Ethereal 面板默认 10px
//      （--transparent-wallpaper-blur 未设置时回退 10px，显式 0 原样生效）
//   10. isBlurRampEnabled 设备开关：Firefly 读 backgroundWallpaper.fullscreen.blurRamp
//      （bool 或 {desktop,mobile}，未配置默认开启）；Ethereal 尚未引入该设置项，
//      源恒为 undefined → 与 Firefly「未配置默认开启」等价（结构保留，接设置只换源）
//   11. Firefly 导出 syncFullscreenStateAfterInit 供其 layout-init 调用；Ethereal 无
//      该消费者（初始同步已在 initFullscreenWallpaper 尾部完成），故不移植
(() => {
  if (typeof window === "undefined" || window.__fullscreenHeroBound) return;
  window.__fullscreenHeroBound = true;

  const TITLE_FADE_RATIO = 0.5; // 滚动到半个视口高度后标题完全淡出
  const BLUR_RAMP_SCROLL = 300; // px，首页下滑该距离后壁纸模糊达到配置的最大值（期间从 0 连续渐变）
  const BLUR_QUANTIZE_STEP = 2; // px，模糊值量化步长，避免每帧都触发全屏 blur 重栅格化
  let parallaxTicking = false;
  let cachedMaxBlur: number | null = null; // 缓存的模糊 max 解析值（仅在加载/滑块变化时刷新）
  let lastWrittenBlur = ""; // 上次实际写入的 --fullscreen-wallpaper-blur，值未变则跳过写入
  // 标题视差记忆化：上次写入的 transform/opacity，值未变则跳过，避免滚动已越淡出区/顶部静止时每帧重写合成层属性
  let lastTitleTransform = "";
  let lastTitleOpacity = "";

  /** 仅当 transform/opacity 实际变化时才写入，减少对含标题文字的合成层的无谓逐帧更新 */
  function setTitleParallaxStyle(
    overlay: HTMLElement,
    transform: string,
    opacity: string,
  ): void {
    if (transform === lastTitleTransform && opacity === lastTitleOpacity)
      return;
    lastTitleTransform = transform;
    lastTitleOpacity = opacity;
    overlay.style.transform = transform;
    overlay.style.opacity = opacity;
  }

  function isHeroFullscreenLayout(): boolean {
    return (
      document.documentElement.getAttribute("data-fullscreen-layout") === "hero"
    );
  }

  const isHome = () => document.body.classList.contains("is-home");

  // 首页标题随滚动平滑上移并渐变消失（首屏完整显示，下滑淡出；壁纸保持 fixed）
  function updateFullscreenTitleParallax(): void {
    const html = document.documentElement;
    const overlay = document.getElementById("banner-overlay");
    if (!overlay) return;
    // 非全屏或页面过渡中：复位（让 transition-swup-fade 的 CSS 生效）
    if (
      html.getAttribute("data-banner-display") !== "fullscreen" ||
      !isHeroFullscreenLayout() ||
      html.classList.contains("is-animating") ||
      html.classList.contains("is-changing")
    ) {
      setTitleParallaxStyle(overlay, "", "");
      return;
    }
    // 仅首页使用 hero 标题；非首页与 overlay 一致（无标题覆盖层）
    if (!isHome()) {
      setTitleParallaxStyle(overlay, "", "");
      return;
    }
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    // 标题随滚动上移，同时透明度渐变到 0（渐变消失，不弹跳）
    const fadeScroll = window.innerHeight * TITLE_FADE_RATIO;
    const ratio = Math.min(scrollY / fadeScroll, 1);
    setTitleParallaxStyle(
      overlay,
      `translateY(${-scrollY}px)`,
      String(1 - ratio),
    );
  }

  function requestFullscreenTitleParallax(): void {
    if (!parallaxTicking) {
      parallaxTicking = true;
      requestAnimationFrame(() => {
        parallaxTicking = false;
        updateFullscreenTitleParallax();
        syncFullscreenBlur();
      });
    }
  }

  // 非首页全屏壁纸模式：强制隐藏标题覆盖层（与 overlay 一致），
  // 处理运行时切换 / Swup 导航后 banner 渲染的覆盖层残留（内联 !important，不依赖 CSS 是否已刷新）
  function syncFullscreenOverlays(): void {
    const mode = document.documentElement.getAttribute("data-banner-display");
    const overlays = document.querySelectorAll(
      "#banner-overlay, #banner-page-title-overlay",
    );
    overlays.forEach((el) => {
      const element = el as HTMLElement;
      if (mode === "fullscreen" && isHeroFullscreenLayout() && !isHome()) {
        element.style.setProperty("display", "none", "important");
      } else {
        element.style.removeProperty("display");
      }
    });
  }

  // 全屏壁纸模糊：首页从 0 随滚动连续渐变到配置的最大值，非首页固定为最大值（与 overlay 一致）
  // 通过 --fullscreen-wallpaper-blur 变量驱动，图片 CSS 恒为 blur(var(--fullscreen-wallpaper-blur))
  // 性能：maxBlur 缓存（避免每帧 getComputedStyle）+ 2px 量化（值未变跳过写入），避免全屏 blur 逐帧重栅格化
  function syncFullscreenBlur(): void {
    const html = document.documentElement;
    if (
      html.getAttribute("data-banner-display") !== "fullscreen" ||
      !isHeroFullscreenLayout()
    ) {
      setBlurIfChanged("0px");
      return;
    }
    // 按设备开关决定全屏模式是否启用模糊（关闭则该设备上首页与非首页都保持清晰）
    if (!isBlurRampEnabled()) {
      setBlurIfChanged("0px");
      return;
    }
    // 读取当前生效的模糊配置（跟随设置面板滑块 / --transparent-wallpaper-blur），已缓存，仅加载/滑块变化时重读
    const safeMax = cachedMaxBlur ?? readMaxBlur();
    if (!isHome()) {
      setBlurIfChanged(`${safeMax}px`);
      return;
    }
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const ratio = Math.min(scrollY / BLUR_RAMP_SCROLL, 1);
    setBlurIfChanged(`${quantizeBlur(ratio * safeMax)}px`);
  }

  // 全屏壁纸模式的模糊渐变是否启用：按当前视口设备读取 fullscreen.blurRamp 配置
  // （支持布尔或 { desktop, mobile }，未配置默认开启）。Ethereal 未引入该设置项：
  // 源恒为 undefined → 等价 Firefly 未配置默认开启（映射表第 10 条）
  function isBlurRampEnabled(): boolean {
    const enable: boolean | { desktop: boolean; mobile: boolean } | undefined =
      undefined as boolean | { desktop: boolean; mobile: boolean } | undefined;
    if (typeof enable === "boolean") return enable;
    if (!enable) return true;
    return window.innerWidth < 1024 ? enable.mobile : enable.desktop;
  }

  function readMaxBlur(): number {
    const maxBlur = Number.parseFloat(
      window
        .getComputedStyle(document.body)
        .getPropertyValue("--transparent-wallpaper-blur"),
    );
    // 显式 0 = 不模糊原样生效；仅未设置回退 10px（Ethereal 面板默认值，映射表第 9 条）
    const safeMax = Number.isFinite(maxBlur) && maxBlur >= 0 ? maxBlur : 10;
    cachedMaxBlur = safeMax;
    return safeMax;
  }

  function quantizeBlur(value: number): number {
    return Math.floor(value / BLUR_QUANTIZE_STEP) * BLUR_QUANTIZE_STEP;
  }

  function setBlurIfChanged(value: string): void {
    if (value === lastWrittenBlur) return;
    lastWrittenBlur = value;
    document.documentElement.style.setProperty(
      "--fullscreen-wallpaper-blur",
      value,
    );
  }

  /** 注册监听并做初始同步（原 Firefly 由 layout-init 调用；Ethereal 模块尾部内联执行） */
  function initFullscreenWallpaper(): void {
    window.addEventListener("scroll", requestFullscreenTitleParallax, {
      passive: true,
    });
    window.addEventListener("bannerModeChange", () => {
      requestAnimationFrame(updateFullscreenTitleParallax);
      syncFullscreenBlur();
    });
    window.addEventListener("fullscreenLayoutChange", () => {
      requestAnimationFrame(updateFullscreenTitleParallax);
      syncFullscreenBlur();
      syncFullscreenOverlays();
    });
    window.addEventListener("bannerModeChange", syncFullscreenOverlays);
    // 面板模糊滑块变化（= Firefly MutationObserver 观察 --overlay-blur 的等价事件）：
    // 失效缓存并重同步，否则非首页模糊只在滚动/切页时才更新，滑块表现为失效
    window.addEventListener("wallpaperParamsChanged", () => {
      cachedMaxBlur = null;
      syncFullscreenBlur();
    });
    // Swup v4 换页重算（Firefly 静态站模块一次初始化；Ethereal 脚本被换页重执行，
    // 换页后 data 属性/body 类变化需重新同步）
    document.addEventListener("swup:enable", () => {
      const swup = (
        window as unknown as {
          swup?: { hooks?: { on(hook: string, fn: () => void): void } };
        }
      ).swup;
      swup?.hooks?.on("content:replace", requestFullscreenTitleParallax);
    });
    updateFullscreenTitleParallax(); // 初始加载（浏览器可能恢复滚动位置）
    syncFullscreenOverlays(); // 初始加载时同步非首页覆盖层状态
    syncFullscreenBlur(); // 初始加载时同步壁纸模糊状态
  }

  initFullscreenWallpaper();
})();
