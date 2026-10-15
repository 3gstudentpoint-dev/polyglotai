export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  language?: string;
  timestamp: Date;
  imageUrl?: string;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
