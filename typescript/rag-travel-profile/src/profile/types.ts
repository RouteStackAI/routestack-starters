export interface UserProfile {
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
  }
  
  export interface RetrievedProfile extends UserProfile {
    score: number;
  }