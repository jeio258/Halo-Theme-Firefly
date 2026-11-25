/**
 * 从 DOM 中读取主题配置 JSON（#theme-config）。
 *
 * 缓存挂在 `window.__themeConfig` 上，而不是模块级变量——配置同时被三类消费者读取：
 *   1. Vite 打包的模块（profile-status / external-link-redirect，本文件）；
 *   2. esbuild 单独打包的经典脚本（banner-carousel / wave / post-like 等）；
 *   3. 组件内联脚本（WelcomePopup）。
 * 用模块级缓存会让 1 与 2/3 各持一份：内联脚本先解析后，本文件仍会再 parse 一次；
 * 更严重的是 setThemeConfig() 只更新模块缓存，经典脚本读到的仍是旧配置，
 * 「改完配置无需刷新」的语义因此对经典脚本失效。统一挂 window 才能三者共享。
 *
 * 缓存永不清除（null 也是有效缓存值，表示解析失败/无配置），与既有行为一致。
 */
// 配置是运行期 JSON，深层字段按各消费方自行断言；用 any 保持既有调用方的深层取值链
// （如 config?.post?.actionBar?.rewardSetting）不必逐层断言。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThemeConfigRaw = Record<string, any>;
type ThemeConfigCache = ThemeConfigRaw | null | undefined;

export function getThemeConfig(): ThemeConfigRaw | null {
  const w = window as unknown as { __themeConfig?: ThemeConfigCache };
  if (w.__themeConfig !== undefined) return w.__themeConfig ?? null;

  let config: ThemeConfigRaw | null = null;
  try {
    const el = document.getElementById("theme-config");
    if (el?.textContent) config = JSON.parse(el.textContent);
  } catch {
    config = null;
  }
  w.__themeConfig = config;
  return config;
}

/**
 * 写入配置缓存（前端改配置后同步，实现同会话内的「热更新」）。
 * 必须写 window 上的同一份缓存，否则经典脚本与内联脚本读不到新值。
 */
export function setThemeConfig(config: ThemeConfigRaw): void {
  (window as unknown as { __themeConfig?: ThemeConfigCache }).__themeConfig =
    config;
}
