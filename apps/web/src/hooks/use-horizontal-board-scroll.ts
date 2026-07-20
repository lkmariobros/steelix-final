"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type React from "react";

type DragState = {
	pointerId: number;
	startX: number;
	scrollLeft: number;
	moved: boolean;
};

/**
 * Horizontal board navigation for mouse users:
 * - click-drag empty board area to pan left/right
 * - Shift + mouse wheel pans horizontally
 * Normal wheel scroll stays vertical (page/column).
 * Does not intercept HTML5 drag on cards (`[draggable=true]`).
 */
export function useHorizontalBoardScroll<T extends HTMLElement = HTMLDivElement>() {
	const ref = useRef<T | null>(null);
	const dragRef = useRef<DragState | null>(null);

	const shouldIgnoreTarget = (target: EventTarget | null) => {
		if (!(target instanceof Element)) return true;
		return Boolean(
			target.closest(
				'[draggable="true"], button, a, input, textarea, select, [role="button"], [data-no-board-pan]',
			),
		);
	};

	const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
		if (e.button !== 0) return;
		if (shouldIgnoreTarget(e.target)) return;
		const el = ref.current;
		if (!el) return;

		dragRef.current = {
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
		const drag = dragRef.current;
		if (!el || !drag || drag.pointerId !== e.pointerId) return;

		const dx = e.clientX - drag.startX;
		if (Math.abs(dx) > 3) drag.moved = true;
		el.scrollLeft = drag.scrollLeft - dx;
	}, []);

	const endDrag = useCallback((e: React.PointerEvent<T>) => {
		const el = ref.current;
		const drag = dragRef.current;
		if (!el || !drag || drag.pointerId !== e.pointerId) return;

		dragRef.current = null;
		el.classList.remove("cursor-grabbing");
		try {
			el.releasePointerCapture(e.pointerId);
		} catch {
			// ignore if already released
		}
	}, []);

	// Shift + wheel → horizontal pan only (normal wheel stays vertical)
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

		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, []);

	return {
		ref,
		boardScrollProps: {
			onPointerDown,
			onPointerMove,
			onPointerUp: endDrag,
			onPointerCancel: endDrag,
			className:
				"kanban-board-scroll cursor-grab overflow-x-auto overscroll-x-contain",
		},
	};
}
