import type { FetchOptions, FetchResponse } from 'ofetch'
import type { ApiRes } from './types/common'
import { toast } from 'vue-sonner'
import { getApiUrl } from './config'

// 导出类型供其他模块使用
export type { ApiRes, ListRes, PageData, PageParams, PageRes } from './types/common'

/**
 * HTTP 状态码错误消息映射
 */
const StatusCodeMessage: Record<number, string> = {
  200: '服务器成功返回请求的数据',
  201: '新建或修改数据成功。',
  202: '一个请求已经进入后台排队（异步任务）',
  204: '删除数据成功',
  400: '请求错误(400)',
  401: '未授权，请重新登录(401)',
  403: '拒绝访问(403)',
  404: '请求出错(404)',
  408: '请求超时(408)',
  500: '服务器错误(500)',
  501: '服务未实现(501)',
  502: '网络错误(502)',
  503: '服务不可用(503)',
  504: '网络超时(504)',
}

/**
 * 错误处理函数
 */
function handleError(msg: string) {
  toast.error(msg || '服务器端错误', {
    duration: 5000,
  })
}

/**
 * 获取 Token（保留扩展性，前台目前不需要）
 */
function getToken(): string | null {
  // TODO: 如果需要 token，可以从 localStorage 或 cookie 中获取
  // const token = useCookie('token')
  // return token.value || null
  return null
}

/**
 * 获取 Tenant ID（保留扩展性，前台目前不需要）
 */
function getTenantId(): string | null {
  // TODO: 如果需要 tenant，可以从 store 或 cookie 中获取
  // const tenantStore = useTenantStore()
  // return tenantStore.tenantId || null
  return null
}

/**
 * 请求配置类型
 */
export interface RequestConfig extends Omit<FetchOptions, 'baseURL'> {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  // 是否跳过错误处理（用于特殊场景）
  skipErrorHandler?: boolean
  // 是否跳过响应拦截（用于文件下载等场景）
  skipResponseInterceptor?: boolean
}

/**
 * 创建请求头
 */
function createHeaders(config: RequestConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers as Record<string, string> || {}),
  }

  // 添加 Token（如果存在）
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // 添加 Tenant ID（如果存在）
  const tenantId = getTenantId()
  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId
  }

  return headers
}

/**
 * 处理响应数据
 */
async function handleResponse<T>(response: FetchResponse<any>): Promise<ApiRes<T>> {
  const data = response._data

  // 如果跳过响应拦截，直接返回原始响应
  if (data && typeof data === 'object' && 'skipResponseInterceptor' in data) {
    return data
  }

  // 处理 blob 响应（文件下载）
  if (response.headers.get('content-type')?.includes('application/octet-stream') || data instanceof Blob) {
    // 检查是否是错误响应（JSON blob）
    if (data instanceof Blob && data.type?.startsWith('application/json')) {
      const text = await data.text()
      try {
        const errorData = JSON.parse(text)
        if (!errorData.success) {
          handleError(errorData.msg || '下载失败')
          throw new Error(errorData.msg || '下载失败')
        }
      }
      catch {
        // 解析失败，继续处理
      }
    }
    // 返回 blob 数据
    return {
      success: true,
      code: 200,
      msg: 'success',
      data: data as T,
    } as ApiRes<T>
  }

  // 处理标准 JSON 响应
  if (data && typeof data === 'object' && 'success' in data) {
    const apiRes = data as ApiRes<T>

    // 如果请求失败
    if (!apiRes.success) {
      // 401 错误处理（保留扩展性）
      if (apiRes.code === '401' || apiRes.code === 401) {
        // TODO: 如果需要登录，可以在这里处理跳转
        // const router = useRouter()
        // router.push('/login')
        handleError(apiRes.msg || '未授权，请重新登录')
      }
      else {
        handleError(apiRes.msg || '请求失败')
      }
      throw new Error(apiRes.msg || '请求失败')
    }

    return apiRes
  }

  // 如果响应格式不符合预期，包装为标准格式
  return {
    success: true,
    code: 200,
    msg: 'success',
    data: data as T,
  } as ApiRes<T>
}

/**
 * 统一请求方法
 */
export async function request<T = any>(config: RequestConfig): Promise<ApiRes<T>> {
  const { url, method = 'GET', skipErrorHandler = false, skipResponseInterceptor = false, ...restConfig } = config

  try {
    const fullUrl = getApiUrl(url)
    const headers = createHeaders(config)

    const response = await $fetch.raw<T>(fullUrl, {
      method,
      headers,
      ...restConfig,
    })

    if (skipResponseInterceptor) {
      return {
        success: true,
        code: 200,
        msg: 'success',
        data: response._data as T,
      } as ApiRes<T>
    }

    return await handleResponse<T>(response)
  }
  catch (error: any) {
    // 网络错误或其他错误
    if (!skipErrorHandler) {
      if (error.response) {
        const status = error.response.status
        const errorMsg = StatusCodeMessage[status] || '服务器暂时未响应，请刷新页面并重试。若无法解决，请联系管理员'
        handleError(errorMsg)
      }
      else if (error.message) {
        // 如果是我们抛出的错误（已处理过），不再重复提示
        if (!error.message.includes('请求失败') && !error.message.includes('下载失败')) {
          handleError(error.message || '网络连接失败，请检查您的网络')
        }
      }
      else {
        handleError('网络连接失败，请检查您的网络')
      }
    }

    throw error
  }
}

/**
 * GET 请求
 */
export function get<T = any>(url: string, params?: Record<string, any>, config?: Omit<RequestConfig, 'url' | 'method' | 'params'>): Promise<ApiRes<T>> {
  return request<T>({
    url,
    method: 'GET',
    params,
    ...config,
  })
}

/**
 * POST 请求
 */
export function post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<ApiRes<T>> {
  return request<T>({
    url,
    method: 'POST',
    body: data,
    ...config,
  })
}

/**
 * PUT 请求
 */
export function put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<ApiRes<T>> {
  return request<T>({
    url,
    method: 'PUT',
    body: data,
    ...config,
  })
}

/**
 * PATCH 请求
 */
export function patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'url' | 'method' | 'body'>): Promise<ApiRes<T>> {
  return request<T>({
    url,
    method: 'PATCH',
    body: data,
    ...config,
  })
}

/**
 * DELETE 请求
 */
export function del<T = any>(url: string, params?: Record<string, any>, config?: Omit<RequestConfig, 'url' | 'method' | 'params'>): Promise<ApiRes<T>> {
  return request<T>({
    url,
    method: 'DELETE',
    params,
    ...config,
  })
}

/**
 * 文件下载
 */
export async function download(url: string, params?: Record<string, any>, filename?: string): Promise<void> {
  try {
    const response = await request<Blob>({
      url,
      method: 'GET',
      params,
      responseType: 'blob',
      skipResponseInterceptor: true,
    })

    if (response.success && response.data instanceof Blob) {
      const blob = response.data
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    }
  }
  catch (error) {
    console.error('文件下载失败:', error)
    throw error
  }
}
