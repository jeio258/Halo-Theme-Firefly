// 沉浸式阅读（自 Firefly immersive-reading-utils 迁移，2026-09-23）
// 适配 Ethereal：
//  - 配置来源：#theme-config JSON 的 post.immersiveReading（getThemeConfig 同契约）
//  - 沉浸目录：复用 Ethereal 的 <table-of-contents> Web Component（自动扫描正文 #content），
//    不移植 Firefly 的 TOCManager
//  - i18n：window.__etherealI18n(key, fallback)（Layout.astro 注入）
//  - 文章页判定：#post-container 存在（Ethereal 无 isPostPage 工具）
import { getThemeConfig } from "./_theme-config";

type ImmersiveReadingConfig = {
  enable: boolean;
  defaultOn: boolean;
  tocEnabled: boolean;
  tocPosition: "left" | "right";
};

const DEFAULT_CONFIG: ImmersiveReadingConfig = {
  enable: true,
  defaultOn: false,
  tocEnabled: true,
  tocPosition: "left",
};

function resolveConfig(): ImmersiveReadingConfig {
  const themeConfig = getThemeConfig() as {
    post?: { immersiveReading?: Partial<ImmersiveReadingConfig> };
  } | null;
  return {
    ...DEFAULT_CONFIG,
    ...(themeConfig?.post?.immersiveReading ?? {}),
  };
}

function t(key: string, fallback: string): string {
  const fn = (
    window as unknown as {
      __etherealI18n?: (k: string, fb: string) => string;
    }
  ).__etherealI18n;
  return fn ? fn(key, fallback) : fallback;
}

type IRState = {
  btn: HTMLElement | null;
  tocBtn: HTMLElement | null;
  toc: HTMLElement | null;
  prevScroll: number;
  isImmersive: boolean;
};

const w = window as unknown as {
  ImmersiveReading?: IRState;
  __immersiveReadingInit?: boolean;
  toggleImmersiveReading?: () => void;
  toggleImmersiveTOC?: () => void;
};

const state: IRState = w.ImmersiveReading ?? {
  btn: null,
  tocBtn: null,
  toc: null,
  prevScroll: 0,
  isImmersive: false,
};
w.ImmersiveReading = state;

/** 内联 !important 强制主面板贴顶到 1rem（优先于一切壁纸布局规则） */
function clampContentTop() {
  const panel = document.querySelector<HTMLElement>("#main-panel-wrapper");
  if (!panel) return;
  panel.style.setProperty("top", "1rem", "important");
  panel.style.setProperty("min-height", "calc(100vh - 1rem)", "important");
  panel.style.setProperty("--content-top", "1rem", "important");
}

function clearContentTop() {
  const panel = document.querySelector<HTMLElement>("#main-panel-wrapper");
  if (!panel) return;
  panel.style.removeProperty("top");
  panel.style.removeProperty("min-height");
  panel.style.removeProperty("--content-top");
}

function isDesktop() {
  return window.innerWidth >= 1024;
}

function isPostPage() {
  return !!document.getElementById("post-container");
}

/** 目录抽屉开合（沉浸态内）；table-of-contents 元素由 Web Component 自动刷新 */
function setupImmersiveTOC() {
  const cfg = resolveConfig();
  if (cfg.tocEnabled !== false && state.toc) {
    state.tocBtn?.classList.remove("hide");
    state.toc.classList.add("open");
    state.tocBtn?.classList.add("toggled");
    state.tocBtn?.setAttribute("title", t("common.collapse", "Collapse"));
    document.body.classList.add("immersive-toc-open");
  } else {
    state.tocBtn?.classList.add("hide");
    state.toc?.classList.remove("open");
    state.tocBtn?.classList.remove("toggled");
    state.tocBtn?.setAttribute("title", t("common.expand", "Expand"));
    document.body.classList.remove("immersive-toc-open");
  }
}

function enterImmersiveReading() {
  if (state.isImmersive) return;
  if (!isPostPage() || !isDesktop()) return;
  state.isImmersive = true;
  state.prevScroll = window.scrollY;

  document.body.classList.add("immersive-reading");
  clampContentTop();
  const cfg = resolveConfig();
  document.body.classList.toggle(
    "immersive-toc-right",
    cfg.tocPosition === "right",
  );
  state.toc?.setAttribute("data-position", cfg.tocPosition);

  state.btn?.classList.remove("hide");
  state.btn?.classList.add("toggled");
  state.btn?.setAttribute(
    "title",
    t("post.exitImmersiveReading", "Exit immersive reading"),
  );

  setupImmersiveTOC();

  window.scrollTo({ top: 0, behavior: "instant" });

  document.dispatchEvent(
    new CustomEvent("immersiveReadingChange", { detail: { on: true } }),
  );
}

function exitImmersiveReading() {
  if (!state.isImmersive) return;
  state.isImmersive = false;

  document.body.classList.remove("immersive-reading");
  document.body.classList.remove("immersive-toc-right");
  document.body.classList.remove("immersive-toc-open");
  clearContentTop();

  state.btn?.classList.remove("toggled");
  state.btn?.setAttribute(
    "title",
    t("post.enterImmersiveReading", "Enter immersive reading"),
  );
  state.tocBtn?.classList.add("hide");
  state.tocBtn?.classList.remove("toggled");
  state.tocBtn?.setAttribute("title", t("common.expand", "Expand"));
  state.toc?.classList.remove("open");

  updateImmersiveReadingVisibility();

  window.scrollTo({ top: state.prevScroll || 0, behavior: "instant" });

  document.dispatchEvent(
    new CustomEvent("immersiveReadingChange", { detail: { on: false } }),
  );
}

function toggleImmersiveReading() {
  if (state.isImmersive) exitImmersiveReading();
  else enterImmersiveReading();
}

function toggleImmersiveTOC() {
  if (!state.isImmersive || !state.toc) return;
  const isOpen = state.toc.classList.contains("open");
  state.toc.classList.toggle("open", !isOpen);
  document.body.classList.toggle("immersive-toc-open", !isOpen);
  state.tocBtn?.classList.toggle("toggled", !isOpen);
  state.tocBtn?.setAttribute(
    "title",
    !isOpen ? t("common.collapse", "Collapse") : t("common.expand", "Expand"),
  );
}

function updateImmersiveReadingVisibility() {
  if (!state.btn) return;
  const enabled = resolveConfig().enable !== false;

  if (!enabled || !isPostPage() || !isDesktop()) {
    if (state.isImmersive) exitImmersiveReading();
    state.btn.classList.add("hide");
    state.tocBtn?.classList.add("hide");
    return;
  }
  state.btn.classList.remove("hide");
}

function initImmersiveReading() {
  state.btn = document.getElementById("immersive-reading-btn");
  state.tocBtn = document.getElementById("immersive-toc-toggle-btn");
  state.toc = document.getElementById("immersive-toc");
  updateImmersiveReadingVisibility();

  // 跨 Swup 切到另一篇文章仍处沉浸态时，重建目录（抽屉内 table-of-contents
  // 是 Web Component，换页重建 DOM 后自动 refresh 扫描新正文，此处仅重开抽屉）
  if (state.isImmersive) setupImmersiveTOC();

  const cfg = resolveConfig();
  if (cfg.enable !== false && cfg.defaultOn && isPostPage()) {
    enterImmersiveReading();
  }

  if (!w.__immersiveReadingInit) {
    w.__immersiveReadingInit = true;

    // 按钮点击：直接绑定（按钮在 Swup 容器外常驻）
    state.btn?.addEventListener("click", toggleImmersiveReading);
    state.tocBtn?.addEventListener("click", toggleImmersiveTOC);

    // 视口变化：离开桌面端时隐藏按钮并退出沉浸态
    window.addEventListener("resize", updateImmersiveReadingVisibility);

    // Esc 退出沉浸阅读
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") exitImmersiveReading();
    });
  }
}

// 入口：页面加载 + Swup 换页后重绑定（SwupScriptsPlugin 会重执行本脚本，
// 幂等守卫防重复注册监听器）
(function setup() {
  initImmersiveReading();
})();

w.toggleImmersiveReading = toggleImmersiveReading;
w.toggleImmersiveTOC = toggleImmersiveTOC;
