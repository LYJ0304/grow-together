// Server/AG-UI adapters can provide this display model later; no transport state.
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
