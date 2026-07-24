"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type React from "react";

type PanState = {
	pointerId: number;
	startX: number;
	scrollLeft: number;
	moved: boolean;
};

const EDGE_PX = 72;
const MAX_SCROLL_SPEED = 22;

/**
 * Horizontal board navigation for mouse users:
 * - click-drag empty board area to pan left/right
 * - Shift + mouse wheel pans horizontally
 * - While dragging a card, auto-scroll near left/right edges so other stages
 *   (especially to the left) stay reachable
 * Does not intercept HTML5 drag on cards (`[draggable=true]`).
 */
export function useHorizontalBoardScroll<T extends HTMLElement = HTMLDivElement>() {
	const ref = useRef<T | null>(null);
	const panRef = useRef<PanState | null>(null);
	const isCardDraggingRef = useRef(false);
	const lastDragXRef = useRef(0);
	const autoScrollRafRef = useRef<number | null>(null);

	const shouldIgnoreTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return true;
		return Boolean(
			target.closest(
				'[draggable="true"], button, a, input, textarea, select, [role="button"], [data-no-board-pan]',
			),
		);
	};

	const stopAutoScroll = useCallback(() => {
		isCardDraggingRef.current = false;
		if (autoScrollRafRef.current != null) {
			cancelAnimationFrame(autoScrollRafRef.current);
			autoScrollRafRef.current = null;
		}
	}, []);

	const tickAutoScroll = useCallback(() => {
		const el = ref.current;
		if (!el || !isCardDraggingRef.current) {
			autoScrollRafRef.current = null;
			return;
		}

		const rect = el.getBoundingClientRect();
		const x = lastDragXRef.current;

		if (x < rect.left + EDGE_PX) {
			const intensity = Math.min(1, (rect.left + EDGE_PX - x) / EDGE_PX);
			el.scrollLeft -= Math.max(4, Math.ceil(MAX_SCROLL_SPEED * intensity));
		} else if (x > rect.right - EDGE_PX) {
			const intensity = Math.min(1, (x - (rect.right - EDGE_PX)) / EDGE_PX);
			el.scrollLeft += Math.max(4, Math.ceil(MAX_SCROLL_SPEED * intensity));
		}

		autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll);
	}, []);

	const startAutoScroll = useCallback(() => {
		if (autoScrollRafRef.current != null) return;
		autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll);
	}, [tickAutoScroll]);

	const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
		if (e.button !== 0) return;
		if (shouldIgnoreTarget(e.target)) return;
		const el = ref.current;
		if (!el) return;

		panRef.current = {
			pointerId: e.pointerId,
			startX: e.clientX,
			scrollLeft: el.scrollLeft,
			moved: false,
		};
		el.setPointerCapture(e.pointerId);
		el.classList.add("cursor-grabbing");
	}, []);

	const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
		const el = ref.current;
		const pan = panRef.current;
		if (!el || !pan || pan.pointerId !== e.pointerId) return;

		const dx = e.clientX - pan.startX;
		if (Math.abs(dx) > 3) pan.moved = true;
		el.scrollLeft = pan.scrollLeft - dx;
	}, []);

	const endPan = useCallback((e: React.PointerEvent<T>) => {
		const el = ref.current;
		const pan = panRef.current;
		if (!el || !pan || pan.pointerId !== e.pointerId) return;

		panRef.current = null;
		el.classList.remove("cursor-grabbing");
		try {
			el.releasePointerCapture(e.pointerId);
		} catch {
			// ignore if already released
		}
	}, []);

	// Shift + wheel → horizontal pan; HTML5 card-drag → edge auto-scroll
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			if (!e.shiftKey) return;
			if (el.scrollWidth <= el.clientWidth) return;

			const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
			if (delta === 0) return;

			e.preventDefault();
			el.scrollLeft += delta;
		};

		const onDragStart = (e: DragEvent) => {
			const target = e.target;
			if (!(target instanceof Element)) return;
			if (!target.closest('[draggable="true"]')) return;
			isCardDraggingRef.current = true;
			lastDragXRef.current = e.clientX;
			startAutoScroll();
		};

		const onDragOver = (e: DragEvent) => {
			if (!isCardDraggingRef.current) return;
			lastDragXRef.current = e.clientX;
			// Keep the drag session alive over the scroll gutter / empty board chrome
			e.preventDefault();
			startAutoScroll();
		};

		const onDragEnd = () => stopAutoScroll();
		const onDrop = () => stopAutoScroll();

		el.addEventListener("wheel", onWheel, { passive: false });
		el.addEventListener("dragstart", onDragStart);
		el.addEventListener("dragover", onDragOver);
		el.addEventListener("dragend", onDragEnd);
		el.addEventListener("drop", onDrop);
		window.addEventListener("dragend", onDragEnd);
		window.addEventListener("drop", onDrop);

		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("dragstart", onDragStart);
			el.removeEventListener("dragover", onDragOver);
			el.removeEventListener("dragend", onDragEnd);
			el.removeEventListener("drop", onDrop);
			window.removeEventListener("dragend", onDragEnd);
			window.removeEventListener("drop", onDrop);
			stopAutoScroll();
		};
	}, [startAutoScroll, stopAutoScroll]);

	return {
		ref,
		boardScrollProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp: endPan,
			onPointerCancel: endPan,
			className:
				"kanban-board-scroll cursor-grab overflow-x-auto overscroll-x-contain",
		},
	};
}
