export function promptOffsetWidth(value: string) {
  return value.length
}
export function displaySlice(value: string, start = 0, end = value.length) {
  return value.slice(start, end)
}
export function displayCharAt(value: string, offset: number) {
  return value[offset]
}
export function mentionTriggerIndex(value: string, offset = value.length) {
  const text = displaySlice(value, 0, offset)
  const index = text.lastIndexOf("@")
  if (index === -1) return
  const before = index === 0 ? undefined : text[index - 1]
  const query = text.slice(index)
  if ((before === undefined || /\s/.test(before)) && !/\s/.test(query)) {
    return text.slice(0, index).length
  }
}
