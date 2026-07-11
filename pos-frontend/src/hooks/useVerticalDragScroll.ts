import { useEffect, useRef } from "react";

const useVerticalDragScroll = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) return;

    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;

      // Quantity controls are inside data-no-drag.
      if (
        target.closest(
          "[data-no-drag], input, select, textarea, a"
        )
      ) {
        return;
      }

      isDragging = true;
      startY = event.clientY;
      startScrollTop = element.scrollTop;

      element.setPointerCapture(event.pointerId);
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) return;

      const distance = event.clientY - startY;
      element.scrollTop = startScrollTop - distance;
    };

    const stopDragging = (event: PointerEvent) => {
      if (!isDragging) return;

      isDragging = false;

      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }

      element.style.cursor = "grab";
      element.style.removeProperty("user-select");
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", stopDragging);
    element.addEventListener("pointercancel", stopDragging);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", stopDragging);
      element.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  return scrollRef;
};

export default useVerticalDragScroll;