import { inject } from "vue";

import { qaCenterKey } from "./useQaCenter";

export const useQaCenterContext = () => {
  const qa = inject(qaCenterKey);
  if (!qa) {
    throw new Error("QA center context is missing.");
  }
  return qa;
};
