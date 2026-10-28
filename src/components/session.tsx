"use client";

import { sessionFromManifest, type DemoManifest } from "@/lib/demo";
import { outfitsFor } from "@/lib/outfits";
import { idbGet, idbSet } from "@/lib/storage";
import type { Presentation, Role, Session, SessionEvent, TimeOfDay } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SessionApi = {
  ready: boolean;
  session: Session | null;
  setSession: (session: Session | null) => void;
  loadDemo: (id: string) => Promise<Session>;
  startLive: (role?: Role) => Session;
};

const SessionContext = createContext<SessionApi | null>(null);

const FUNCTIONS: Array<{ id: "mehndi" | "baraat" | "walima"; name: string; date: string; timeOfDay: TimeOfDay; venue: string }> = [
  { id: "mehndi", name: "Mehndi", date: "2026-11-14", timeOfDay: "evening", venue: "Courtyard" },
  { id: "baraat", name: "Baraat", date: "2026-11-15", timeOfDay: "night", venue: "Wedding hall" },
  { id: "walima", name: "Walima", date: "2026-11-16", timeOfDay: "evening", venue: "Dinner" },
];

export function eventsFor(role: Role, presentation: Presentation): SessionEvent[] {
  return FUNCTIONS.map((item) => {
    const outfit = outfitsFor(presentation, role).find((entry) => entry.functionId === item.id);
    return {
      ...item,
      outfitId: outfit?.id ?? "",
      garmentName: outfit?.name ?? "Outfit",
      garmentHex: outfit?.dominant ?? "#C4A574",
      garmentCategory: outfit?.suggestedCategory ?? "upper_body",
      garmentImage: outfit?.image,
    };
  });
}

export function blankLive(role: Role = "groom"): Session {
  const presentation: Presentation = role === "bride" || role === "guest" ? "woman" : "man";
  return {
    mode: "live",
    placeholder: false,
    role,
    presentation,
    consent: false,
    framing: "chest-up",
    events: eventsFor(role, presentation),
    unitsCharged: 0,
    bag: [],
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    void idbGet<Session>("session").then((stored) => {
      if (cancel) return;
      setSessionState(stored);
      setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void idbSet("session", session);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [session, ready]);

  const setSession = useCallback((next: Session | null) => {
    setSessionState(next);
  }, []);

  const loadDemo = useCallback(async (id: string) => {
    const res = await fetch(`/demo/${id}/manifest.json`);
    if (!res.ok) throw new Error("Missing demo.");
    const manifest = (await res.json()) as DemoManifest;
    const next = sessionFromManifest(manifest);
    setSessionState(next);
    return next;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const demo = new URLSearchParams(window.location.search).get("demo");
    if (!demo) return;
    void loadDemo(demo);
  }, [ready, loadDemo]);

  const startLive = useCallback((role?: Role) => {
    const next = blankLive(role);
    setSessionState(next);
    return next;
  }, []);

  const api = useMemo(
    () => ({ ready, session, setSession, loadDemo, startLive }),
    [ready, session, setSession, loadDemo, startLive],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session missing");
  return value;
}
