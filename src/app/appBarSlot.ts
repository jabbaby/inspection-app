import { createContext } from "react";

/**
 * The top bar's element in the shell. Screens fill it with <AppBar>, so the
 * bar stays at the top of the window while the screen below scrolls.
 */
export const AppBarSlot = createContext<HTMLElement | null>(null);
