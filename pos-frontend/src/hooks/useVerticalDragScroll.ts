import { useCallback, useEffect, useState } from "react";

const useVerticalDragScroll = () => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;

      if (event.pointerType === "touch") return;

      if (
        target.closest(
          "[data-no-drag], button, input, select, textarea, a"
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

      event.preventDefault();

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
  }, [element]);

  return scrollRef;
};

export default useVerticalDragScroll;