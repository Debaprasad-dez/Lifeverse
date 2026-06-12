"use client";

import { useMemo } from "react";
import { CanvasTexture, MeshBasicMaterial, PlaneGeometry } from "three";
import InstancedPool, { type PoolInstance } from "@/components/canvas/InstancedPool";

export interface BlobSpec {
  position: [number, number, number];
  radius: number;
}

function makeBlobTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(20,16,34,0.42)");
  g.addColorStop(0.55, "rgba(20,16,34,0.26)");
  g.addColorStop(1, "rgba(20,16,34,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

const geometry = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

interface ContactBlobsProps {
  blobs: BlobSpec[];
}

/**
 * Soft contact-shadow discs under trees and structures — the cheap half
 * of SSAO. One instanced draw; reads as grounded even where the AO pass
 * fades with distance.
 */
export default function ContactBlobs({ blobs }: ContactBlobsProps) {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: makeBlobTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        toneMapped: false,
      }),
    []
  );

  const instances = useMemo(
    (): PoolInstance[] =>
      blobs.map((b) => ({
        position: b.position,
        scale: b.radius,
      })),
    [blobs]
  );

  if (blobs.length === 0) return null;

  return <InstancedPool geometry={geometry} material={material} instances={instances} />;
}
