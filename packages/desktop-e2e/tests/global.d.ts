declare global {
  interface Window {
    curraint: {
      hideChatWindow: () => Promise<void>;
    };
  }
}

export {};
