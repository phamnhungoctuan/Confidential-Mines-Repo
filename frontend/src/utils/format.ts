export function shortAddr(addr: string | null | undefined) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
