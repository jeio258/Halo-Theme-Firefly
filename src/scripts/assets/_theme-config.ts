// 兼容转发：#theme-config 的唯一实现已收敛到 src/utils/theme-config.ts
// （缓存挂在 window.__themeConfig，与内联脚本 / Vite 模块共享同一份）。
// 经典脚本历史上从这里取，保留本文件作为稳定的相对路径入口，避免各脚本改 import 路径。
export { getThemeConfig } from "../../utils/theme-config";
