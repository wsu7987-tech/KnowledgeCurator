export interface PoolEntryFormExpose {
  reset: () => void;
  submit: () => Promise<boolean>;
}
