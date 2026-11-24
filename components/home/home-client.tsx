"use client";
import { useEffect, useMemo, useState } from "react";
import { Hero } from "./hero";
import { Closing, Latest, Marquee, Pricing, Stats, Values } from "./sections";
import { PhoneStory } from "./phone-story";
import { SmoothScroll } from "./smooth-scroll";
import { pinsFrom } from "./bay-map";
import { Footer } from "@/components/app/footer";
import { useApp } from "@/components/app/providers";
import { backend } from "@/lib/backend";
import type { DirectoryEntry } from "@/lib/backend/types";
import { decorativePins } from "@/lib/bay";

export function HomeClient() {
  const { session, loading, launched } = useApp();
  const [list, setList] = useState<DirectoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (loading) return;
    let done = false;
    const fallback = setTimeout(() => !done && setReady(true), 1800);
    backend
      .listDirectory()
      .then((r) => {
        setList(r.businesses);
        setLocked(r.locked || r.paywalled);
      })
      .catch(() => {})
      .finally(() => {
        done = true;
        clearTimeout(fallback);
        setReady(true);
      });
    return () => clearTimeout(fallback);
  }, [loading, session?.user?.id, launched]);

  const pins = useMemo(() => (locked ? decorativePins(26) : pinsFrom(list)), [list, locked]);

  return (
    <main>
      <SmoothScroll />
      <Hero businesses={list} ready={ready} locked={locked} />
      <Stats businesses={list} locked={locked} />
      <Latest businesses={list} locked={locked} />
      <PhoneStory pins={pins} />
      <Marquee />
      <Values />
      <Pricing loggedIn={!!session?.user} />
      <Closing businesses={list} locked={locked} />
      <Footer />
    </main>
  );
}
