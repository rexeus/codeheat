// Owns which program opens a file in the default browser on each platform.

/** The command that hands `file` to the platform's default application. */
export const openCommand = (
  platform: NodeJS.Platform,
  file: string,
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
  if (platform === "darwin") {
    return { command: "open", args: [file] };
  }
  if (platform === "win32") {
    // `start` is a cmd builtin; its first quoted argument is the window title.
    return { command: "cmd", args: ["/c", "start", '""', file] };
  }
  return { command: "xdg-open", args: [file] };
};
