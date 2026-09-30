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
    // Not `cmd /c start`: cmd reparses the path, so `&` or `%VAR%` in a
    // directory name would run commands. rundll32 takes the path verbatim.
    return {
      command: "rundll32.exe",
      args: ["url.dll,FileProtocolHandler", file],
    };
  }
  return { command: "xdg-open", args: [file] };
};
