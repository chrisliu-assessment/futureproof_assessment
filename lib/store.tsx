"use client";

// Shared client state for the form AND the chat helper (next step). Both read
// and write the same QuoteFormState via this store, so either can update it.

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { QuoteFormState, QuoteResult } from "./types";
import type { ValidationErrors } from "./premium";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AppState {
  form: QuoteFormState;
  errors: ValidationErrors; // per-field validation errors
  formError: string | null; // top-level / server error message
  quoteResult: QuoteResult | null;
  submitting: boolean;
  chatMessages: ChatMessage[]; // consumed by the chat helper in the next step
}

export const initialForm: QuoteFormState = {
  address: "",
  squareFootage: null,
  material: null,
  coverage: null,
  deductible: null,
};

export const initialState: AppState = {
  form: initialForm,
  errors: {},
  formError: null,
  quoteResult: null,
  submitting: false,
  chatMessages: [],
};

export type Action =
  | { type: "PATCH_FORM"; patch: Partial<QuoteFormState> }
  | { type: "SET_ERRORS"; errors: ValidationErrors }
  | { type: "SET_FORM_ERROR"; message: string | null }
  | { type: "SET_QUOTE"; quote: QuoteResult | null }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "ADD_CHAT_MESSAGE"; message: ChatMessage }
  | { type: "RESET" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "PATCH_FORM":
      // Any edit invalidates a stale quote / error.
      return {
        ...state,
        form: { ...state.form, ...action.patch },
        quoteResult: null,
        formError: null,
      };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "SET_FORM_ERROR":
      return { ...state, formError: action.message };
    case "SET_QUOTE":
      return { ...state, quoteResult: action.quote };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.submitting };
    case "ADD_CHAT_MESSAGE":
      return { ...state, chatMessages: [...state.chatMessages, action.message] };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function QuoteStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useQuoteStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useQuoteStore must be used within a QuoteStoreProvider");
  }
  return ctx;
}
