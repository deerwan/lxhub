import { ElMessage } from 'element-plus'

export async function copyText(text: string): Promise<void> {
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    ok = false
  }
  if (!ok) {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      ok = true
    } catch {
      ok = false
    }
    ta.remove()
  }
  if (ok) ElMessage.success('已复制到剪贴板')
  else ElMessage.error('复制失败，请手动选择')
}