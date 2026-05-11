export interface TripRequest {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    adults: number;
  }
  
  export interface AgentResult {
    summary: string;
    raw?: unknown;
  }
  
  export interface ToolExecutionContext {
    hotel: {
      token?: string;
      correlationId?: string;
      hotels?: any[];
      rooms?: any[];
      selectedHotel?: {
        hotelId?: string;
        hotelName?: string;
        hotelImage?: string;
      };
      selectedRoom?: {
        roomName?: string;
        roomId?: string;
        recommendationId?: string;
        publishedRate?: number;
      };
    };
  
    flight: {
      sessionId?: string;
      correlationId?: string;
      searchFilterObj?: Record<string, unknown>;
      flights?: any[];
      selectedFlight?: {
        fareSourceCode?: string;
      };
    };

    car: {
      correlationId?: string;
      cars?: any[];
      searchArgs?: Record<string, any>;
  
      selectedCar?: {
        fareCode?: string;
        car?: any;
      };
    };
  }