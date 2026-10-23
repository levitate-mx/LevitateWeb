import { useEffect, useState } from "react";
import initialRegistrationPolicy from "../../shared/registration-policy.json";

type RegistrationPolicy = {
  pausedVenues: string[];
  message: string;
};

const fallbackRegistrationPolicy: RegistrationPolicy = initialRegistrationPolicy;

export function useRegistrationPolicy() {
  const [policy, setPolicy] = useState(fallbackRegistrationPolicy);

  useEffect(() => {
    let isCancelled = false;
    let isLoading = false;
    const refreshPolicy = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const response = await fetch("/api/registration/status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { registrationPolicy?: RegistrationPolicy };
        const nextPolicy = payload.registrationPolicy;
        if (!isCancelled && nextPolicy && Array.isArray(nextPolicy.pausedVenues)
          && nextPolicy.pausedVenues.every((venue) => typeof venue === "string")
          && typeof nextPolicy.message === "string") {
          setPolicy(nextPolicy);
        }
      } catch {
        // Keep the last known policy, with the active closure as the initial fallback.
      } finally {
        isLoading = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshPolicy();
    };

    void refreshPolicy();
    const interval = window.setInterval(() => void refreshPolicy(), 30000);
    window.addEventListener("focus", refreshPolicy);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isCancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshPolicy);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    policy,
    isVenuePaused: (venue?: string | null) => Boolean(venue && policy.pausedVenues.includes(venue)),
  };
}
