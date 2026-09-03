import { useMemo } from "react";
import { estimateJob } from "@/lib/estimator";
import { useEstimatorStore } from "@/lib/estimator-store";
import { effectiveOpPercent } from "@/lib/op";

export function useJobEstimate() {
  const rooms = useEstimatorStore((s) => s.rooms);
  const laborRate = useEstimatorStore((s) => s.laborRate);
  const opEnabled = useEstimatorStore((s) => s.opEnabled);
  return useMemo(
    () => estimateJob(rooms, effectiveOpPercent(laborRate, opEnabled)),
    [rooms, laborRate, opEnabled],
  );
}
