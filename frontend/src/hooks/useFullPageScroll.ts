"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Full-page scroll: intercepts all scroll input and snaps between sections.
 * Sections are identified by `[data-section]` attribute.
 * Uses CSS scroll-behavior: smooth via window.scrollTo and blocks
 * all input until the scroll finishes.
 */
export function useFullPageScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const currentIndex = useRef(0);
  const touchStartY = useRef(0);
  const scrollCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);

  const getSections = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>("[data-section]"));
  }, []);

  // Wait for scroll to actually stop, then unlock
  const waitForScrollEnd = useCallback(() => {
    if (scrollCheckTimer.current) clearTimeout(scrollCheckTimer.current);

    const check = () => {
      if (Math.abs(window.scrollY - lastScrollY.current) < 1) {
        // Scroll has stopped
        isScrolling.current = false;
      } else {
        lastScrollY.current = window.scrollY;
        scrollCheckTimer.current = setTimeout(check, 50);
      }
    };

    lastScrollY.current = window.scrollY;
    scrollCheckTimer.current = setTimeout(check, 100);
  }, []);

  const scrollToSection = useCallback((index: number) => {
    const sections = getSections();
    if (index < 0 || index >= sections.length) return;
    if (isScrolling.current) return;

    isScrolling.current = true;
    currentIndex.current = index;

    const target = sections[index].getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: target, behavior: "smooth" });

    waitForScrollEnd();
  }, [getSections, waitForScrollEnd]);

  // Find which section is closest to viewport top
  const syncCurrentIndex = useCallback(() => {
    const sections = getSections();
    let closest = 0;
    let closestDist = Infinity;
    sections.forEach((s, i) => {
      const dist = Math.abs(s.getBoundingClientRect().top);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    currentIndex.current = closest;
  }, [getSections]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent ALL default scrolling except inside data-scroll-inside
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-scroll-inside]")) return;

      e.preventDefault();

      if (isScrolling.current) return;
      if (Math.abs(e.deltaY) < 20) return;

      syncCurrentIndex();

      if (e.deltaY > 0) {
        scrollToSection(currentIndex.current + 1);
      } else {
        scrollToSection(currentIndex.current - 1);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isScrolling.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        syncCurrentIndex();
        scrollToSection(currentIndex.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        syncCurrentIndex();
        scrollToSection(currentIndex.current - 1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isScrolling.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-scroll-inside]")) return;

      const delta = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 50) return;

      syncCurrentIndex();
      if (delta > 0) {
        scrollToSection(currentIndex.current + 1);
      } else {
        scrollToSection(currentIndex.current - 1);
      }
    };

    // Also prevent manual scrollbar dragging from landing between sections
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (isScrolling.current) return;
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        // Snap to nearest section after any free scroll stops
        syncCurrentIndex();
        const sections = getSections();
        const section = sections[currentIndex.current];
        if (!section) return;
        const dist = Math.abs(section.getBoundingClientRect().top);
        if (dist > 5) {
          scrollToSection(currentIndex.current);
        }
      }, 150);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("scroll", onScroll);
      if (scrollCheckTimer.current) clearTimeout(scrollCheckTimer.current);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
    };
  }, [scrollToSection, syncCurrentIndex, getSections]);

  return containerRef;
}
