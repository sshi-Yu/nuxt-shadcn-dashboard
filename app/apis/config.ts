/**
 * API 配置
 */
export const API_CONFIG = {
  // 从 swagger.json 读取的 baseURL，可通过环境变量覆盖
  baseURL: 'http://192.168.57.9:8000',
  timeout: 30 * 1000, // 30秒超时
}

/**
 * 获取完整的 API URL
 */
export function getApiUrl(path: string): string {
  // 如果 path 已经包含完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // 确保 baseURL 不以 / 结尾，path 以 / 开头
  const base = API_CONFIG.baseURL.replace(/\/$/, '')
  const url = path.startsWith('/') ? path : `/${path}`
  return `${base}${url}`
}
