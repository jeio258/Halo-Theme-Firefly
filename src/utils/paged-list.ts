/**
 * 「筛选 + 分页」列表的 Thymeleaf 表达式生成（技能页 / 时间轴页共用）。
 *
 * 两页的分页段逐字相同（共 8 条表达式），差异只在：配置组名（skills / timeline）、
 * 筛选参数名（category / type）、各分类计数变量的名字。这里把公共段收成一处，
 * 分类计数由调用方以 `counts` 传入（`变量名: 分类值`），避免再复制一遍分页逻辑。
 *
 * 约定（与 post-list-config.ts 一致）：返回的字符串直接塞进 `th:with`，
 * 首项必须是调用方的 `items=`，因为后续表达式都依赖它。
 */

export interface PagedListOptions {
  /** 配置组名：extendPages.<group>.entries.items / extendPages.<group>.pageSize */
  group: string;
  /** 筛选用的 query 参数名（param.<filterParam>） */
  filterParam: string;
  /**
   * 分类计数变量：`[变量名, items 里的分类字段值]`。
   * 按顺序生成 `<变量名>=${items != null ? #aggregates.sum(items.![<字段> == '<值>' ? 1 : 0]) : 0}`
   */
  counts: [string, string][];
  /** items 元素里承载分类的字段名（category / type） */
  field: string;
  /** pageSize 缺省值 */
  defaultPageSize?: number;
}

/** 完整的 th:with 表达式（含 items、分类计数、分页状态与分页切片） */
export function pagedListThWith(opts: PagedListOptions): string {
  const { group, filterParam, counts, field, defaultPageSize = 10 } = opts;
  const path = `theme.config?.extendPages?.${group}`;

  const countLines = counts.map(
    ([varName, value]) =>
      `${varName}=\${items != null ? #aggregates.sum(items.![${field} == '${value}' ? 1 : 0]) : 0}`,
  );

  // 分类过滤 → 计数变量，逐级嵌套（Thymeleaf 没有循环可用来拼这个三元链）
  const filterChain = counts.reduceRight(
    (acc, [varName, value]) =>
      `#lists.contains(param.${filterParam}, '${value}') ? ${varName} : (${acc})`,
    "totalSize",
  );

  return [
    `items=\${${path}?.entries?.items}`,
    ...countLines,
    `pageSize=\${${path}?.pageSize != null ? #conversions.convert(${path}?.pageSize, 'java.lang.Integer') : ${defaultPageSize}}`,
    `totalSize=\${items != null ? #lists.size(items) : 0}`,
    `filteredCount=\${${filterChain}}`,
    `hasFilter=\${not #lists.isEmpty(param.${filterParam})}`,
    `totalPages=\${not hasFilter and pageSize > 0 ? (totalSize + pageSize - 1) / pageSize : 1}`,
    `rawPage=\${param.page != null and param.page.length > 0 and param.page[0] matches '\\d+' ? #conversions.convert(param.page[0], 'java.lang.Integer') : 1}`,
    `curPage=\${rawPage > totalPages ? totalPages : (rawPage < 1 ? 1 : rawPage)}`,
    `startIndex=\${(curPage - 1) * pageSize}`,
    `endIndex=\${startIndex + pageSize > totalSize ? totalSize : startIndex + pageSize}`,
    `pagedItems=\${not hasFilter and pageSize > 0 and totalSize > 0 ? items.subList(startIndex < 0 ? 0 : startIndex, endIndex > totalSize ? totalSize : endIndex) : items}`,
  ].join(", ");
}

/**
 * 分页导航块的 th:with（技能 / 时间轴页的页内分页，URL 用 ?page=N 并保留筛选参数）。
 *
 * 该块不需要分类计数与分页切片，只算分页状态 + 页码窗口，故与 pagedListThWith 分开：
 * 混在一起会让导航块多算 5 次 aggregates.sum。
 */
export function pagedNavThWith(opts: {
  group: string;
  filterParam: string;
  defaultPageSize?: number;
}): string {
  const { group, filterParam, defaultPageSize = 10 } = opts;
  const path = `theme.config?.extendPages?.${group}`;
  return [
    `items=\${${path}?.entries?.items}`,
    `pageSize=\${${path}?.pageSize != null ? #conversions.convert(${path}?.pageSize, 'java.lang.Integer') : ${defaultPageSize}}`,
    `totalSize=\${items != null ? #lists.size(items) : 0}`,
    `hasFilter=\${not #lists.isEmpty(param.${filterParam})}`,
    `totalPages=\${not hasFilter and pageSize > 0 ? (totalSize + pageSize - 1) / pageSize : 1}`,
    `rawPage=\${param.page != null and param.page.length > 0 and param.page[0] matches '\\d+' ? #conversions.convert(param.page[0], 'java.lang.Integer') : 1}`,
    `curPage=\${rawPage > totalPages ? totalPages : (rawPage < 1 ? 1 : rawPage)}`,
    `sep=\${not #lists.isEmpty(param.${filterParam}) ? '?${filterParam}=' + param.${filterParam}[0] + '&' : '?'}`,
    `windowStart=\${curPage le 3 ? 1 : (curPage ge totalPages - 2 ? (totalPages - 4 gt 1 ? totalPages - 4 : 1) : curPage - 2)}`,
    `windowEnd=\${curPage le 3 ? (totalPages lt 5 ? totalPages : 5) : (curPage ge totalPages - 2 ? totalPages : curPage + 2)}`,
  ].join(", ");
}
