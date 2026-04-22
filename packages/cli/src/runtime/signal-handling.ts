import type readline from 'node:readline/promises';

type SignalProcess = {
  on: (event: 'SIGINT', listener: () => void) => void;
  off: (event: 'SIGINT', listener: () => void) => void;
  exit: (code?: number) => never;
};

type SignalSession = {
  getState: () => { isSending: boolean };
  stopResponse: () => Promise<void>;
};

type SignalOutput = {
  write: (text: string) => void;
};

type InstallSigintHandlerOptions = {
  processLike?: SignalProcess;
  output: SignalOutput;
  rl: Pick<readline.Interface, 'close'>;
  getSession?: () => SignalSession;
  session?: SignalSession;
};

export function installSigintHandler(options: InstallSigintHandlerOptions): () => void {
  const processLike = options.processLike ?? process;
  const getSession = (): SignalSession => options.getSession?.() ?? options.session!;

  const handler = (): void => {
    const session = getSession();
    if (session.getState().isSending) {
      session.stopResponse().catch((error) => {
        console.error('Failed to stop active response after SIGINT.', error);
      });
      return;
    }

    options.output.write('\n');
    options.rl.close();
    processLike.exit(0);
  };

  processLike.on('SIGINT', handler);
  return () => {
    processLike.off('SIGINT', handler);
  };
}