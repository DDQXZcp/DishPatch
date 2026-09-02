/**
 * The header's primary text scale, shared by the logo, the clock and the
 * connection indicator so that "the same size" stays true by construction
 * rather than by three copies that drift apart.
 *
 * It ramps with the viewport because the logo is the widest thing in the bar
 * and has to give ground on narrow screens.
 */
export const HEADER_TEXT_SIZE =
  "text-theme-sm sm:text-base lg:text-lg xl:text-xl";

/** Status dot, sized to read as a light against HEADER_TEXT_SIZE. */
export const HEADER_DOT_SIZE = "h-2.5 w-2.5 sm:h-3 sm:w-3";
