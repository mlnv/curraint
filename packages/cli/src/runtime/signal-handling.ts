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
  session: SignalSession;
};

export function installSigintHandler(options: InstallSigintHandlerOptions): () => void {
  const processLike = options.processLike ?? process;

  const handler = (): void => {
    if (options.session.getState().isSending) {
      void options.session.stopResponse();
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