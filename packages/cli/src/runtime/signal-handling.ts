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

type SigintSessionSource =
  | {
      getSession: () => SignalSession;
      session?: never;
    }
  | {
      session: SignalSession;
      getSession?: never;
    };

type InstallSigintHandlerOptions = SigintSessionSource & {
  processLike?: SignalProcess;
  output: SignalOutput;
  rl: Pick<readline.Interface, 'close'>;
  onExit?: () => Promise<void> | void;
};

export function installSigintHandler(options: InstallSigintHandlerOptions): () => void {
  const processLike = options.processLike ?? process;
  const getSession = (): SignalSession => {
    if ('getSession' in options) {
      return options.getSession();
    }

    return options.session;
  };

  const exitGracefully = async (): Promise<void> => {
    options.output.write('\n');

    try {
      if (options.onExit) {
        await options.onExit();
      } else {
        options.rl.close();
      }
    } catch (error) {
      console.error('Failed to run SIGINT cleanup.', error);
    }

    processLike.exit(0);
  };

  const handler = (): void => {
    const session = getSession();
    if (session.getState().isSending) {
      session.stopResponse().catch((error) => {
        console.error('Failed to stop active response after SIGINT.', error);
      });
      return;
    }

    void exitGracefully();
  };

  processLike.on('SIGINT', handler);
  return () => {
    processLike.off('SIGINT', handler);
  };
}