import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Joyride, STATUS, type EventData } from "react-joyride";
import { TOUR_STEPS } from "./steps";

const STORAGE_KEY = "ceos_tour_done";

interface TourCtx {
  startTour: () => void;
}

const Ctx = createContext<TourCtx>({ startTour: () => {} });

export function TourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [run, setRun] = useState(false);
  const [key, setKey] = useState(0);

  const startTour = useCallback(() => {
    navigate("/");
    setKey((k) => k + 1);
    setRun(true);
  }, [navigate]);

  // Auto-start for new users — small delay lets the app finish its initial render
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(startTour, 800);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEvent = useCallback((data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }, []);

  return (
    <Ctx.Provider value={{ startTour }}>
      <Joyride
        key={key}
        steps={TOUR_STEPS}
        run={run}
        continuous
        scrollToFirstStep
        onEvent={handleEvent}
        options={{
          buttons: ["back", "primary", "skip"],
          showProgress: true,
          skipBeacon: true,
          primaryColor: "#2d5bbf",
          zIndex: 10000,
        }}
        locale={{
          back: "Back",
          close: "Close",
          last: "Done",
          next: "Next →",
          skip: "Skip tour",
        }}
      />
      {children}
    </Ctx.Provider>
  );
}

export function useTour() {
  return useContext(Ctx);
}

export function isTourPending() {
  return !localStorage.getItem(STORAGE_KEY);
}
