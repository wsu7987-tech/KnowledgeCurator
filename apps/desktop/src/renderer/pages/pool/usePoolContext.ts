import { inject } from "vue";

import { poolPageKey } from "./usePoolPage";

export const usePoolContext = () => {
  const pool = inject(poolPageKey);
  if (!pool) {
    throw new Error("Pool page context is missing.");
  }
  return pool;
};
