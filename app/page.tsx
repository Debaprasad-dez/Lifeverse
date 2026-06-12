"use client";

import dynamic from "next/dynamic";
import UIOverlay from "@/components/ui/UIOverlay";

// The world is WebGL-only — never server-rendered.
const WorldCanvas = dynamic(() => import("@/components/canvas/WorldCanvas"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="fixed inset-0">
      <WorldCanvas />
      <UIOverlay />
    </main>
  );
}
