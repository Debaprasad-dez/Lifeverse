"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import gsap from "gsap";
import { CAMERA } from "@/lib/constants";
import { clamp } from "@/lib/noise";
import { useCameraStore, type CameraMode } from "@/stores/cameraStore";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { islandCenter, KINGDOM_ORDER } from "@/engine/resolver/layout";
import { reducedMotion } from "@/lib/motion";

const TWO_PI = Math.PI * 2;

interface Spherical {
  radius: number;
  azimuth: number;
  polar: number;
}

const INSPECT_CLAMPS = {
  radius: [5, 18] as const,
  polar: [(15 * Math.PI) / 180, (110 * Math.PI) / 180] as const,
};

function clampsFor(mode: CameraMode): {
  radius: readonly [number, number];
  polar: readonly [number, number];
} {
  if (mode === "INSPECT") return INSPECT_CLAMPS;
  return mode === "ORBIT_ISLAND" ? CAMERA.island : CAMERA.world;
}

const FLIGHT_DEST: Record<
  "island" | "world" | "inspect",
  { radius: number; polar: number; mode: CameraMode }
> = {
  island: { radius: 22, polar: (66 * Math.PI) / 180, mode: "ORBIT_ISLAND" },
  world: { radius: 112, polar: (58 * Math.PI) / 180, mode: "ORBIT_WORLD" },
  inspect: { radius: 9, polar: (72 * Math.PI) / 180, mode: "INSPECT" },
};

/**
 * Custom damped spherical-coordinate controller — NOT stock OrbitControls.
 * Inertia on release, soft spring-back at the limits, GSAP-interruptible
 * FLY_TO along a raised arc with an FOV breathe (Google-Earth feel).
 * All per-frame math lives in refs; React state never ticks per frame.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const sph = useRef<Spherical>({
    radius: CAMERA.initial.radius,
    azimuth: CAMERA.initial.azimuth,
    polar: CAMERA.initial.polar,
  });
  const target = useRef(new Vector3().copy(CAMERA.world.target));
  const modeTarget = useRef(new Vector3().copy(CAMERA.world.target));
  const vel = useRef({ az: 0, pol: 0, zoom: 0 });
  const fov = useRef({ value: CAMERA.fov });
  const drag = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    movedAz: 0,
    movedPol: 0,
    lastT: 0,
    totalPx: 0,
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef({ active: false, dist: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const interruptFlight = useMemo(
    () => (): void => {
      const store = useCameraStore.getState();
      if (store.mode !== "FLY_TO") return;
      timeline.current?.kill();
      timeline.current = null;
      vel.current.az = 0;
      vel.current.pol = 0;
      vel.current.zoom = 0;
      // interrupted inspect flights settle into island orbit, not INSPECT
      const kind = store.flight?.kind;
      store.setMode(kind === "world" ? "ORBIT_WORLD" : "ORBIT_ISLAND");
    },
    []
  );

  // ---- ?island=<id> deep link: open already orbiting that kingdom ----------
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("island");
    if (!id) return;
    const jump = (): boolean => {
      const island = useWorldStore.getState().state?.islands.find((i) => i.id === id);
      if (!island || island.locked) return false;
      const center = islandCenter(island);
      target.current.set(...center);
      modeTarget.current.set(...center);
      sph.current.radius = 26;
      sph.current.polar = (68 * Math.PI) / 180;
      useCameraStore.getState().setMode("ORBIT_ISLAND");
      useCameraStore.setState({ focusedIslandId: island.id });
      useUIStore.getState().openIslandPanel(island.id);
      return true;
    };
    if (jump()) return;
    const unsub = useWorldStore.subscribe((s) => {
      if (s.state && jump()) unsub();
    });
    return unsub;
  }, []);

  // ---- flight choreography -------------------------------------------------
  useEffect(() => {
    const unsub = useCameraStore.subscribe((state, prev) => {
      if (!state.flight || state.flight.seq === prev.flight?.seq) return;
      const req = state.flight;

      timeline.current?.kill();
      const s = sph.current;
      const t = target.current;
      const dest = new Vector3(...req.target);
      modeTarget.current.copy(dest);

      const destSpec = FLIGHT_DEST[req.kind];
      const travel = t.distanceTo(dest) + Math.abs(s.radius - destSpec.radius);
      const snap = reducedMotion();
      const dur = snap
        ? 0.05 // reduced motion: effectively a crossfade, not a flight
        : req.kind === "inspect"
          ? clamp(0.6 + travel / 160, 0.6, 1.3)
          : clamp(0.9 + travel / 110, 0.9, 2.4);
      // pull up & out, glide, then descend — the raised arc
      const peak = Math.max(s.radius, destSpec.radius) + (snap ? 0 : travel * 0.3);

      vel.current.az = 0;
      vel.current.pol = 0;
      vel.current.zoom = 0;

      const tl = gsap.timeline({
        onComplete: () => {
          timeline.current = null;
          useCameraStore.getState().setMode(destSpec.mode);
        },
      });
      tl.to(t, { x: dest.x, y: dest.y, z: dest.z, duration: dur, ease: "power3.inOut" }, 0);
      tl.to(s, { polar: destSpec.polar, duration: dur, ease: "power3.inOut" }, 0);
      tl.to(s, { radius: peak, duration: dur * 0.48, ease: "power2.inOut" }, 0);
      tl.to(s, { radius: destSpec.radius, duration: dur * 0.52, ease: "power3.out" }, dur * 0.48);
      if (!snap) {
        tl.to(fov.current, { value: CAMERA.fovBreathe, duration: dur * 0.45, ease: "sine.in" }, 0);
        tl.to(fov.current, { value: CAMERA.fov, duration: dur * 0.55, ease: "sine.out" }, dur * 0.45);
      }
      timeline.current = tl;
    });
    return () => {
      unsub();
      timeline.current?.kill();
    };
  }, []);

  // ---- inputs ----------------------------------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";

    const onPointerDown = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      interruptFlight();

      if (pointers.current.size === 1) {
        drag.current.active = true;
        drag.current.lastX = e.clientX;
        drag.current.lastY = e.clientY;
        drag.current.movedAz = 0;
        drag.current.movedPol = 0;
        drag.current.lastT = performance.now();
        drag.current.totalPx = 0;
        vel.current.az = 0;
        vel.current.pol = 0;
      } else if (pointers.current.size === 2) {
        drag.current.active = false;
        const [a, b] = [...pointers.current.values()];
        pinch.current.active = true;
        pinch.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      const p = pointers.current.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (pinch.current.active && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current.dist > 0) {
          sph.current.radius *= pinch.current.dist / dist;
        }
        pinch.current.dist = dist;
        return;
      }

      if (drag.current.active) {
        const k = 0.0042;
        drag.current.totalPx +=
          Math.abs(e.clientX - drag.current.lastX) + Math.abs(e.clientY - drag.current.lastY);
        const dAz = -(e.clientX - drag.current.lastX) * k;
        const dPol = -(e.clientY - drag.current.lastY) * k;
        sph.current.azimuth += dAz;
        sph.current.polar += dPol;
        drag.current.movedAz = dAz;
        drag.current.movedPol = dPol;
        drag.current.lastX = e.clientX;
        drag.current.lastY = e.clientY;
        drag.current.lastT = performance.now();
      }
    };

    const onPointerUp = (e: PointerEvent): void => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current.active = false;
      if (pointers.current.size === 0 && drag.current.active) {
        drag.current.active = false;
        useUIStore.getState().setLastDragDistance(drag.current.totalPx);
        // release inertia from the last move, faded by time since it happened
        const age = (performance.now() - drag.current.lastT) / 1000;
        const carry = Math.max(0, 1 - age * 8) * 36;
        vel.current.az = drag.current.movedAz * carry;
        vel.current.pol = drag.current.movedPol * carry;
      }
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      interruptFlight();
      vel.current.zoom += e.deltaY * 0.0011;
    };

    const flyTo = (id: string): void => {
      const island = useWorldStore.getState().state?.islands.find((i) => i.id === id);
      if (island && !island.locked) {
        useCameraStore.getState().flyToIsland(id, islandCenter(island));
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const store = useCameraStore.getState();
      const ui = useUIStore.getState();

      if (e.key === "Escape") {
        // cascade: INSPECT → island orbit → world orbit
        if (store.mode === "INSPECT" && store.focusedIslandId) {
          flyTo(store.focusedIslandId);
        } else if (store.mode === "ORBIT_ISLAND") {
          store.flyToWorld();
        }
        ui.setKbFocus(null);
        return;
      }

      // Tab cycles keyboard focus across unlocked kingdoms; Enter flies
      if (e.key === "Tab") {
        e.preventDefault();
        const order = KINGDOM_ORDER;
        const current = ui.kbFocusIslandId;
        const idx = current ? order.indexOf(current as (typeof order)[number]) : -1;
        const step = e.shiftKey ? -1 : 1;
        const next = order[(idx + step + order.length) % order.length];
        ui.setKbFocus(next);
        return;
      }
      if (e.key === "Enter" && ui.kbFocusIslandId) {
        flyTo(ui.kbFocusIslandId);
        ui.setKbFocus(null);
        return;
      }

      // 1–7 fly straight to each core kingdom
      const digit = Number(e.key);
      if (digit >= 1 && digit <= KINGDOM_ORDER.length) {
        flyTo(KINGDOM_ORDER[digit - 1]);
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gl, interruptFlight]);

  // ---- per-frame integration ---------------------------------------------
  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const s = sph.current;
    const mode = useCameraStore.getState().mode;

    if (mode !== "FLY_TO") {
      const limits = clampsFor(mode);

      s.azimuth = ((s.azimuth + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
      if (!drag.current.active) {
        s.azimuth += vel.current.az * dt;
        s.polar += vel.current.pol * dt;
        // gentle auto-orbit while a structure sheet is open
        if (mode === "INSPECT") s.azimuth += dt * 0.05;
      }
      s.radius *= 1 + vel.current.zoom * dt * 14;

      const decay = Math.exp(-dt * 4.2);
      vel.current.az *= decay;
      vel.current.pol *= decay;
      vel.current.zoom *= Math.exp(-dt * 7.5);

      // soft spring-back instead of hard stops
      const rTo = clamp(s.radius, limits.radius[0], limits.radius[1]);
      const pTo = clamp(s.polar, limits.polar[0], limits.polar[1]);
      s.radius += (rTo - s.radius) * Math.min(1, dt * 9);
      s.polar += (pTo - s.polar) * Math.min(1, dt * 9);

      target.current.lerp(modeTarget.current, Math.min(1, dt * 3.5));
    }

    const sinP = Math.sin(s.polar);
    camera.position.set(
      target.current.x + s.radius * sinP * Math.sin(s.azimuth),
      target.current.y + s.radius * Math.cos(s.polar),
      target.current.z + s.radius * sinP * Math.cos(s.azimuth)
    );
    camera.lookAt(target.current);

    if (camera.fov !== fov.current.value) {
      camera.fov = fov.current.value;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
