/**
 * Swup 钩子就绪助手（单一来源）。
 *
 * swup 实例由 @swup/astro 在 load 之后经 requestIdleCallback + 动态 import 才创建，
 * 各脚本执行时 window.swup 必然为 undefined。直接写 `window.swup?.hooks?.on(...)`
 * 会静默丢失（可选链不报错），表现为「该脚本的换页钩子从不触发」——只靠滚动 /
 * MutationObserver 的兜底勉强工作。统一走这里，避免每处各写一遍
 * 「有则立即绑、无则等 swup:enable」的兜底。
 */

type SwupWindow = Window & { swup?: { hooks?: unknown } };

/**
 * swup 就绪时执行 bind：已就绪立即执行，否则等一次 swup:enable。
 * bind 内部自行取 window.swup.hooks 并注册（各脚本的钩子集合不同）。
 */
export function onSwupReady(bind: () => void): void {
  if ((window as SwupWindow).swup?.hooks) {
    bind();
    return;
  }
  document.addEventListener("swup:enable", bind, { once: true });
}
