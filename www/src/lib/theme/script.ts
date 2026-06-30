import { THEME_STORAGE_KEY } from "@/lib/theme/context"

export const themeInitScript = `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var stored=localStorage.getItem(key);var preference=stored==="light"||stored==="dark"||stored==="system"?stored:"system";var resolved=preference==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):preference;document.documentElement.classList.toggle("dark",resolved==="dark")}catch(e){}})();`
