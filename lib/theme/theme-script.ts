export const THEME_STORAGE_KEY = "rolnet-theme";

/**
 * Runs synchronously in <head> before first paint. A stored "dark" or "light" wins; with nothing
 * stored the device setting decides. Storage errors fall back to the device setting.
 */
export const themeScript = `(function(){try{var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})();`;
