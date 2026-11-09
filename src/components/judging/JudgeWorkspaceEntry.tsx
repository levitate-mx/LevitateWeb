import { useEffect } from "react";

export function JudgeWorkspaceEntry() {
  useEffect(() => { window.location.replace("/jueceo/app/"); }, []);
  return <main><a href="/jueceo/app/">Levitate Jueceo</a></main>;
}
