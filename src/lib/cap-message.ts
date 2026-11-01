export function capMessage(reason?: string): string {
  if (reason === "no_key") return "Live mode needs a server key. Showing the demo.";
  if (reason === "ip") {
    return "You've already used today's two live try-ons on this connection. The demo is here until that resets at midnight UTC.";
  }
  if (reason === "daily") {
    return "Today's live try-ons are full. The shared daily cap has been reached, so this visit stays on the demo. It resets at midnight UTC.";
  }
  if (reason === "session") return "This week asks for more units than one live run can reserve. Showing the demo.";
  return "Live try-on isn't available right now. Showing the demo.";
}
