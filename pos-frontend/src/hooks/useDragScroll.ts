import { useCallback, useEffect, useState } from "react";

const useDragScroll = () => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const dragThreshold = 8;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;

      if (target.closest("[data-no-drag]")) return;

      isPointerDown = true;
      isDragging = false;
      startX = event.clientX;
      startScrollLeft = element.scrollLeft;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;

      const distance = event.clientX - startX;

      if (!isDragging && Math.abs(distance) >= dragThreshold) {
        isDragging = true;
        element.style.cursor = "grabbing";
        element.style.userSelect = "none";
      }

      if (!isDragging) return;

      event.preventDefault();
      element.scrollLeft = startScrollLeft - distance;
    };

    const handlePointerUp = () => {
      isPointerDown = false;

      element.style.cursor = "grab";
      element.style.removeProperty("user-select");

      // Keep the drag state until the generated click event is processed.
      window.setTimeout(() => {
        isDragging = false;
      }, 0);
    };

    const handleClick = (event: MouseEvent) => {
      if (!isDragging) return;

      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    element.addEventListener("click", handleClick, true);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      element.removeEventListener("click", handleClick, true);
    };
  }, [element]);

  return scrollRef;
};

export default useDragScroll;