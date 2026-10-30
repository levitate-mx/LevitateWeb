import { useEffect, useState } from "react";
import initialRegistrationPolicy from "../../shared/registration-policy.json";
import { resolveRegistrationPolicy } from "../../shared/registration-policy.js";

type RegistrationPolicy = ReturnType<typeof resolveRegistrationPolicy>;

export function useRegistrationPolicy() {
  const [policy, setPolicy] = useState(() => resolveRegistrationPolicy(initialRegistrationPolicy.pausedVenues));

  useEffect(() => {
    let isCancelled = false;
    let isLoading = false;
    let basePausedVenues: string[] = initialRegistrationPolicy.pausedVenues;
    let temporaryOpening: Parameters<typeof resolveRegistrationPolicy>[2] = initialRegistrationPolicy.temporaryOpening;
    let serverClock: { timestamp: number; receivedAt: number } | null = null;
    let transitionTimeout: number | undefined;
    const currentTime = () => serverClock
      ? serverClock.timestamp + performance.now() - serverClock.receivedAt
      : Date.now();
    const updatePolicy = () => {
      if (isCancelled) return;
      window.clearTimeout(transitionTimeout);
      const now = currentTime();
      const nextPolicy = resolveRegistrationPolicy(basePausedVenues, now, temporaryOpening);
      setPolicy(nextPolicy);
      const nextChangeAt = nextPolicy.nextChangeAt ? Date.parse(nextPolicy.nextChangeAt) : NaN;
      if (Number.isFinite(nextChangeAt) && nextChangeAt > now) {
        transitionTimeout = window.setTimeout(updatePolicy, Math.min(nextChangeAt - now + 1, 2147483647));
      }
    };
    const refreshPolicy = async () => {
      if (isLoading) return;
      isLoading = true;
      const requestedAt = performance.now();
      try {
        const response = await fetch("/api/registration/status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { registrationPolicy?: Partial<RegistrationPolicy> };
        const nextPolicy = payload.registrationPolicy;
        const serverTime = nextPolicy?.serverTime ? Date.parse(nextPolicy.serverTime) : NaN;
        if (!isCancelled && nextPolicy && Array.isArray(nextPolicy.basePausedVenues)
          && nextPolicy.basePausedVenues.every((venue) => typeof venue === "string")
          && Number.isFinite(serverTime)) {
          const receivedAt = performance.now();
          const timestamp = serverTime + receivedAt - requestedAt;
          serverClock = {
            timestamp: serverClock ? Math.max(timestamp, currentTime()) : timestamp,
            receivedAt,
          };
          basePausedVenues = nextPolicy.basePausedVenues;
          temporaryOpening = nextPolicy.temporaryOpening;
          updatePolicy();
        }
      } catch {
        // The local calendar still closes the temporary opening if the refresh fails.
      } finally {
        isLoading = false;
      }
    };
    const handleFocus = () => {
      updatePolicy();
      void refreshPolicy();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handleFocus();
    };

    updatePolicy();
    void refreshPolicy();
    const interval = window.setInterval(handleFocus, 30000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isCancelled = true;
      window.clearTimeout(transitionTimeout);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    policy,
    isVenuePaused: (venue?: string | null) => Boolean(venue && policy.pausedVenues.includes(venue)),
  };
}
