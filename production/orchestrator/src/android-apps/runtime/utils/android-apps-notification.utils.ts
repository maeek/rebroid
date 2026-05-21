export const parseAndroidNotifications = (output: string) => {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /Notification|pkg=|package=/i.test(line))
    .slice(0, 30)
    .map((line) => {
      const packageName =
        line.match(/pkg=([^\s]+)/)?.[1] ??
        line.match(/package=([^\s]+)/)?.[1] ??
        'android';
      const title =
        line.match(/title=([^,]+)/)?.[1]?.trim() ??
        line.match(/tickerText=([^,]+)/)?.[1]?.trim() ??
        packageName;
      const text =
        line.match(/text=([^,]+)/)?.[1]?.trim() ??
        line.match(/content=([^,]+)/)?.[1]?.trim() ??
        line;

      return { packageName, title, text, raw: line };
    });
};
