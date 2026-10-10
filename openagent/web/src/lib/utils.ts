import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Whether a key press belongs to an input method, e.g. the Enter that picks a candidate while typing Chinese.
 * Safari reports that Enter after the composition has ended, so its keyCode 229 is checked too.
 */
export function isComposing(e: {nativeEvent: KeyboardEvent; keyCode: number}) {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}
