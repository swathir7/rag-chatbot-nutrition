// types/chat.ts

export type Citation = {
  document_name: string;
  publisher: string;
  year: number;
  url: string;
  section: string;
};

export type Claim = {
  claim_text: string;
  source: Citation | null; // null for M1 messages
};

export type ChatResponse = {
  answer: string;
  claims: Claim[];
};

export type ApiResponse = {
  session_id: string;
} & ChatResponse;

// Used by frontend UI
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  claims?: Claim[];
};
