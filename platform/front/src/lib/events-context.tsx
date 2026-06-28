"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Event } from "@ft-root/shared";
import { api } from "./api";

interface EventsContextValue {
  events: Event[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const EventsContext = createContext<EventsContextValue>({
  events: [],
  loading: true,
  refresh: async () => {},
});

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Event[]>("/events");
      setEvents(data);
    } catch {
      setEvents([]);
    }
  }, []);

  // /events is a public endpoint — fetch unconditionally so the home page
  // can show events to visitors as well.
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <EventsContext.Provider value={{ events, loading, refresh }}>
      {children}
    </EventsContext.Provider>
  );
}

export const useEvents = () => useContext(EventsContext);

// Now ⊂ [startsAt, endsAt]
export function isEventActive(e: Event, now = Date.now()): boolean {
  return Date.parse(e.startsAt) <= now && now <= Date.parse(e.endsAt);
}
