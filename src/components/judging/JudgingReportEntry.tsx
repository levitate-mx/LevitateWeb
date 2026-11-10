import { useEffect } from "react";
import { judgingReportPath, judgingRelevePath } from "../admin/registrationAccess";

function JudgingModuleEntry({ destination, label }: { destination: string; label: string }) {
  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);

  return <main aria-busy="true"><a href={destination}>{label}</a></main>;
}

export function JudgingReportEntry() {
  return <JudgingModuleEntry destination={judgingReportPath} label="Abrir dictamen de jueceo" />;
}

export function JudgingReleveEntry() {
  return <JudgingModuleEntry destination={judgingRelevePath} label="Abrir votación Relevé" />;
}
