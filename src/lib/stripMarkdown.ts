/** Strip common markdown artefacts for plain-text command bar display. */
export function stripMarkdown(text: string): string {
  let result = text;

  result = result.replace(/\*\*(.+?)\*\*/g, "$1");
  result = result.replace(/__(.+?)__/g, "$1");
  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
  result = result.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1");
  result = result.replace(/`([^`]+)`/g, "$1");

  result = result
    .split("\n")
    .map((line) =>
      line.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, ""),
    )
    .join("\n");

  return result;
}
