export type PoolStatus = "pending" | "running" | "succeeded" | "failed";
export type RunTaskType = "summary" | "report";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type FeedbackValue = "useful" | "useless";

export interface ApiPoolItem {
  id: string;
  knowledge_item_id?: string;
  result_snapshot_id?: string | null;
  source_name?: string | null;
  title?: string | null;
  source_type: string;
  source_value: string;
  cleaning_level?: "basic" | "enhanced" | null;
  current_status: string;
  display_updated_at: string;
  is_deleted?: boolean;
  was_resummarized?: boolean;
  last_failed_category?: string | null;
}

export interface PoolListResponse {
  items: ApiPoolItem[];
  total: number;
}

export interface PoolCreateRequest {
  source_type: "url" | "pdf" | "markdown" | "text";
  source_value: string;
  title?: string | null;
  raw_text?: string | null;
  capture_source?: "manual" | "screenshot_ocr" | null;
  captured_at?: string | null;
  category?: string | null;
  tags?: string[];
}

export interface PoolMetadataSuggestionRequest {
  source_type: "url" | "pdf" | "markdown" | "text";
  source_value: string;
  title?: string | null;
  raw_text?: string | null;
}

export interface PoolMetadataSuggestionResponse {
  category: string;
  tags: string[];
  strategy: string;
}

export interface PoolCommitMetadataRequest {
  category?: string | null;
  tags?: string[];
  cleaned_text?: string | null;
  cleaning_level?: "basic" | "enhanced" | null;
}

export interface PoolCreateResponse {
  item: ApiPoolItem;
}

export type PdfDraftParserName = "auto" | "pymupdf4llm_markdown" | "rapid_ocr";

export interface PdfDraftCreateRequest {
  file_path: string;
  title?: string | null;
}

export interface PdfDraftReparseRequest {
  parser_name: PdfDraftParserName;
}

export interface PdfDraftPreviewPage {
  page_number: number;
  content_type: "markdown" | "text";
  content: string;
}

export interface PdfDraftParseResult {
  id: string;
  parser_name: string;
  status: string;
  raw_text: string;
  markdown_text?: string | null;
  preview_text: string;
  page_count: number;
  char_count: number;
  quality_score: number;
  is_ocr: boolean;
  warnings: string[];
  fallback_from?: string | null;
  fallback_reason?: string | null;
  created_at: string;
}

export interface PdfReparseJob {
  id: string;
  draft_id: string;
  parser_name: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  processed_pages: number;
  total_pages: number;
  latest_available_page: number;
  cancel_requested: boolean;
  preview_result_id?: string | null;
}

export interface PdfDraft {
  id: string;
  file_path: string;
  title?: string | null;
  source_name: string;
  created_at: string;
  updated_at: string;
  saved_parse_result_id?: string | null;
  latest_preview_result_id?: string | null;
  parse_results: PdfDraftParseResult[];
}

export interface PdfDraftEnvelope {
  draft: PdfDraft;
}

export interface PdfDraftReparseResponse {
  draft: PdfDraft;
  job: PdfReparseJob;
}

export interface PdfReparseJobEnvelope {
  job: PdfReparseJob;
}

export interface PdfReparseJobListEnvelope {
  jobs: PdfReparseJob[];
}

export interface PdfDraftPreviewPageEnvelope {
  page: PdfDraftPreviewPage;
}

export interface PdfDraftCommitResponse {
  item: ApiPoolItem;
}

export interface PdfDraftDeleteResponse {
  deleted: boolean;
}

export type WebDraftParserName = "playwright_dom";

export interface WebDraftCreateRequest {
  url: string;
  title?: string | null;
  session_profile_id?: string | null;
}

export interface WebDraftReparseRequest {
  parser_name: WebDraftParserName;
  session_profile_id?: string | null;
}

export interface WebDraftPreviewPage {
  page_number: number;
  content_type: "markdown" | "text";
  content: string;
}

export interface WebDraftParseResult {
  id: string;
  parser_name: WebDraftParserName;
  status: string;
  raw_text: string;
  markdown_text?: string | null;
  preview_text: string;
  section_count: number;
  char_count: number;
  quality_score: number;
  warnings: string[];
  auth_mode: string;
  created_at: string;
}

export interface WebReparseJob {
  id: string;
  draft_id: string;
  parser_name: WebDraftParserName;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  processed_pages: number;
  total_pages: number;
  latest_available_page: number;
  cancel_requested: boolean;
  preview_result_id?: string | null;
}

export interface WebDraft {
  id: string;
  url: string;
  title?: string | null;
  source_name: string;
  session_profile_id?: string | null;
  created_at: string;
  updated_at: string;
  saved_parse_result_id?: string | null;
  latest_preview_result_id?: string | null;
  parse_results: WebDraftParseResult[];
}

export interface WebDraftEnvelope {
  draft: WebDraft;
}

export interface WebDraftReparseResponse {
  draft: WebDraft;
  job: WebReparseJob;
}

export interface WebReparseJobEnvelope {
  job: WebReparseJob;
}

export interface WebReparseJobListEnvelope {
  jobs: WebReparseJob[];
}

export interface WebDraftPreviewPageEnvelope {
  page: WebDraftPreviewPage;
}

export interface WebDraftCommitResponse {
  item: ApiPoolItem;
}

export interface WebDraftDeleteResponse {
  deleted: boolean;
}

export type WebSessionProfileMode = "browser_profile" | "app_session";
export type WebSessionProfileStatus = "ready" | "needs_login" | "invalid";

export interface WebSessionProfile {
  id: string;
  name: string;
  mode: WebSessionProfileMode;
  browser_channel: string;
  profile_path?: string | null;
  managed_profile_path?: string | null;
  login_url?: string | null;
  status: WebSessionProfileStatus;
  status_detail: string;
  created_at: string;
  updated_at: string;
}

export interface WebSessionProfileCreateRequest {
  name: string;
  mode: WebSessionProfileMode;
  browser_channel?: string | null;
  profile_path?: string | null;
  login_url?: string | null;
}

export interface WebSessionProfileUpdateRequest {
  name?: string | null;
  browser_channel?: string | null;
  profile_path?: string | null;
  login_url?: string | null;
}

export interface WebSessionProfileLoginRequest {
  login_url?: string | null;
}

export interface WebSessionProfileEnvelope {
  profile: WebSessionProfile;
}

export interface WebSessionProfileListEnvelope {
  profiles: WebSessionProfile[];
}

export interface WebSessionProfileDeleteResponse {
  deleted: boolean;
}

export interface SummaryPrecheckItem {
  id: string;
  knowledge_item_id?: string;
  title: string;
  source_type: string;
  cleaning_level?: "basic" | "enhanced" | null;
  current_status: string;
}

export interface SummaryPrecheckResponse {
  items: SummaryPrecheckItem[];
  count: number;
  output_dir: string;
  run_hint?: string | null;
  failed_retry_count?: number | null;
}

export interface SummaryRunCreateResponse {
  run_id: string;
  status: RunStatus;
  stage: string;
}

export interface ApiRunSnapshot {
  run_id: string;
  task_type: string;
  status: string;
  stage: string;
  total_items: number;
  succeeded_items: number;
  failed_items: number;
  skipped_items: number;
  current_item_id: string | null;
  current_item_label: string | null;
  error_category: string | null;
  error_message: string | null;
  updated_at: string;
  finished_at?: string | null;
  report_week_key?: string | null;
  linked_report_version_id?: string | null;
  result_snapshots?: RunResultSnapshot[] | null;
}

export interface RunListResponse {
  items: ApiRunSnapshot[];
  total: number;
}

export interface UiRunSnapshot {
  runId: string;
  taskType: string;
  status: string;
  stage: string;
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  skippedItems: number;
  totalProcessed: number;
  progressPercent: number;
  currentItemId: string | null;
  currentItemLabel: string | null;
  errorCategory: string | null;
  errorMessage: string | null;
  updatedAt: string;
  finishedAt: string | null;
  reportWeekKey: string | null;
  linkedReportVersionId: string | null;
  resultSnapshots: RunResultSnapshot[];
}

export interface RunResultSnapshot {
  snapshot_id: string;
  knowledge_item_id: string;
  title: string;
  final_category?: string | null;
  created_at: string;
  markdown_path?: string | null;
  markdown_filename?: string | null;
}

export interface AppConfigPayload {
  app_data_dir?: string | null;
  sqlite_path?: string | null;
  qdrant_path?: string | null;
  output_root?: string | null;
  summary_output_dir?: string | null;
  report_output_dir?: string | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_base_url?: string | null;
  llm_api_key?: string | null;
  llm_configured?: boolean | null;
  embedding_provider?: string | null;
  embedding_model?: string | null;
  embedding_base_url?: string | null;
  embedding_api_key?: string | null;
  embedding_configured?: boolean | null;
  fetch_concurrency?: number | null;
  llm_concurrency?: number | null;
  embedding_concurrency?: number | null;
  quick_capture_hotkey?: string | null;
  quick_capture_screenshot_hotkey?: string | null;
  close_to_tray?: boolean | null;
  quick_capture_always_on_top?: boolean | null;
}

export interface ProviderConnectivityCheckResponse {
  capability: "llm" | "embedding";
  ok: boolean;
  status: "ready" | "failed" | "invalid";
  provider: string | null;
  model: string | null;
  base_url: string | null;
  detail: string;
  error_category?: string | null;
  checked_at: string;
}

export interface ReportPrecheckResponse {
  week_key?: string;
  available_week_keys?: string[];
  existing_versions?: number[];
  next_version?: number;
}

export interface ReportVersionSummary {
  week_key: string;
  version: number;
  generated_at?: string;
}

export interface ReportEvidenceBundle {
  memory_context_items: unknown[];
  citations: unknown[];
  grounded_claims: unknown[];
  summary_segments: unknown[];
  memory_context_count: number;
  evidence_citation_count: number;
  grounded_claim_count: number;
}

export interface ReportSnapshotItem {
  snapshot_id: string;
  title: string;
  final_category: string;
  created_at: string;
  evidence_citation_count: number;
  memory_context_count: number;
  grounded_claim_count: number;
  top_evidence_titles: string[];
  top_grounded_claims: string[];
  evidence_bundle: ReportEvidenceBundle;
}

export interface ReportGroundedItem {
  snapshot_id: string;
  title: string;
  final_category: string;
  claim: string;
  citation_ids: string[];
  evidence_titles: string[];
}

export interface ReportSnapshotPayload {
  category_stats: Record<string, number>;
  source_distribution: Record<string, number>;
  reading_trend: Record<string, number>;
  evidence_citation_total: number;
  grounded_claim_total: number;
  grounded_items: ReportGroundedItem[];
  items: ReportSnapshotItem[];
}

export interface ReportVersionDetail {
  id?: string;
  week_key?: string;
  version?: number;
  markdown_content: string;
  snapshot_payload?: ReportSnapshotPayload;
  markdown_path?: string | null;
  generated_at?: string | null;
}

export interface ResultDetail {
  id: string;
  knowledge_item_id?: string;
  summary_run_id?: string;
  title?: string | null;
  source_type?: string | null;
  source_value?: string | null;
  generated_category?: string | null;
  generated_tags?: string[] | null;
  final_category?: string | null;
  final_tags?: string[] | null;
  summary_text?: string | null;
  viewpoint_text?: string | null;
  controversy_text?: string | null;
  evidence_bundle?: unknown;
  markdown_path?: string | null;
  markdown_filename?: string | null;
  markdown_content?: string | null;
  related_items?: unknown;
  relation_meta?: unknown;
  summary_meta?: unknown;
  summary_metadata?: unknown;
  created_at?: string | null;
  edited_at?: string | null;
}

export interface ActiveParseResultDetail {
  knowledge_item_id: string;
  source_type: string;
  source_value: string;
  title?: string | null;
  canonical_content: string;
  id: string;
  parser_name: string;
  status: string;
  raw_text: string;
  markdown_text?: string | null;
  preview_text: string;
  page_count: number;
  char_count: number;
  quality_score: number;
  is_ocr: boolean;
  warnings: string[];
  fallback_from?: string | null;
  fallback_reason?: string | null;
  created_at: string;
  saved_at?: string | null;
}

export interface ActiveParseResultEnvelope {
  parse_result: ActiveParseResultDetail;
}

export interface RetrievalFilterPayload {
  source_types?: string[] | null;
  created_at_from?: string | null;
  created_at_to?: string | null;
  knowledge_item_ids?: string[] | null;
  keyword?: string | null;
  category?: string | null;
  user_tags?: string[] | null;
  ai_tags?: string[] | null;
}

export interface RetrievalCitation {
  citation_id: string;
  rank: number;
  knowledge_item_id: string;
  chunk_id: string;
  parent_chunk_id: string;
  title: string;
  section_title: string;
  source_type: string;
  source_name: string;
  source_value: string;
  created_at: string;
  snippet: string;
  context_snippet: string;
  expanded_context_snippet: string;
}

export interface QAGroundedItem {
  snapshot_id: string;
  title: string;
  final_category: string;
  claim: string;
  citation_ids: string[];
  evidence_titles: string[];
}

export type QAMode = "answer" | "knowledge_point" | "summary" | "source";

export interface QARewriteMeta {
  rewritten_question: string;
  requires_history: boolean;
  used_history: boolean;
  intent: string;
  risk_flags: string[];
  confidence: number;
  strategy: string;
}

export interface QAVerificationMeta {
  status: "passed" | "failed" | "skipped";
  reason: string;
  supported_terms: number;
  answer_terms: number;
}

export interface QAAnswerRequestPayload {
  question: string;
  session_id?: string;
  mode: QAMode;
  limit?: number;
  filters?: RetrievalFilterPayload;
}

export interface QAAnswerResponse {
  session_id: string;
  mode: QAMode;
  rewritten_question: string;
  rewrite: QARewriteMeta;
  question: string;
  answer: string;
  answer_status: "grounded" | "insufficient_evidence" | "needs_clarification";
  confidence: number;
  applied_filters: RetrievalFilterPayload;
  citations: RetrievalCitation[];
  used_grounded_items: QAGroundedItem[];
  suggested_queries: string[];
  verification?: QAVerificationMeta;
  retry_count?: number;
}

export interface QAConversationMessage {
  message_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  question?: string | null;
  rewritten_question?: string | null;
  rewrite?: QARewriteMeta | null;
  answer_status?: "grounded" | "insufficient_evidence" | "needs_clarification" | null;
  confidence?: number | null;
  applied_filters?: RetrievalFilterPayload | null;
  citations?: RetrievalCitation[];
  used_grounded_items?: QAGroundedItem[];
  suggested_queries?: string[];
  verification?: QAVerificationMeta | null;
  retry_count?: number | null;
}

export interface QASessionSummary {
  session_id: string;
  title: string;
  mode: QAMode;
  created_at: string;
  updated_at: string;
  last_question?: string | null;
  message_count: number;
}

export interface QASessionDetail extends QASessionSummary {
  messages: QAConversationMessage[];
}

export interface QASessionListEnvelope {
  items: QASessionSummary[];
}

export interface ApiErrorShape {
  error_category?: string | null;
  error_message?: string | null;
  detail?: string | Record<string, unknown> | null;
}

export interface PollFallbackInput {
  lastEventAt: number;
  now: number;
  thresholdMs: number;
  currentMode: "idle" | "sse" | "polling";
}
