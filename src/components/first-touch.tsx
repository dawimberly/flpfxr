import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/lead-attribution";

export function FirstTouch() {
  useEffect(() => { captureFirstTouch(); }, []);
  return null;
}
