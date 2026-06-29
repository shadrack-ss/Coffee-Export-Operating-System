import { createContext, useCallback, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Joyride, { type CallBackProps, STATUS } from "react-joyride";
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
    // Go to Dashboard so page-specific targets (KPI cards) are in the DOM
    navigate("/");
    setKey((k) => k + 1);
    setRun(true);
  }, [navigate]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
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
        showProgress
        showSkipButton
        scrollToFirstStep
        disableScrolling={false}
        callback={handleCallback}
        styles={{
          options: {
            primaryColor: "hsl(var(--primary))",
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: "0.5rem",
            padding: "1.25rem",
            maxWidth: 340,
          },
          tooltipTitle: {
            fontSize: "0.9375rem",
            fontWeight: 600,
            marginBottom: "0.375rem",
          },
          tooltipContent: {
            fontSize: "0.8125rem",
            lineHeight: 1.55,
            padding: 0,
          },
          buttonNext: {
            borderRadius: "0.375rem",
            padding: "0.4rem 0.9rem",
            fontSize: "0.8125rem",
          },
          buttonBack: {
            fontSize: "0.8125rem",
          },
          buttonSkip: {
            fontSize: "0.8125rem",
            color: "hsl(var(--muted-foreground))",
          },
        }}
        locale={{
          back: "Back",
          close: "Close",
          last: "Done",
          next: "Next",
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

/** Returns true if the user has never completed the tour */
export function isTourPending() {
  return !localStorage.getItem(STORAGE_KEY);
}
