import { registerAllCommands } from '../shell/commands';

let isRegistered = false;

export function useShellInit() {
  if (!isRegistered) {
    registerAllCommands();
    isRegistered = true;
  }
}
