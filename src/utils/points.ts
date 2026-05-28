export function getMessageCost(messageCount: number): number {
  if (messageCount < 10) return 5;
  if (messageCount < 25) return 8;
  if (messageCount < 50) return 12;
  return 20;
}
