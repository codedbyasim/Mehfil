export function capMessage(reason?: string): string {
  if (reason === "no_key") return "Live mode needs a server key. Showing the demo.";
  return "Live try-on isn't available right now. Showing the demo.";
}
