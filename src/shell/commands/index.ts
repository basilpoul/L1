import { registerNavigationCommands } from './navigation';
import { registerFileOpsCommands } from './fileOps';
import { registerTextCommands } from './textProcessing';
import { registerPermissionCommands } from './permissions';
import { registerSystemCommands } from './system';
import { registerUtilityCommands } from './utility';

let registered = false;

export function registerAllCommands() {
  if (registered) return;
  registered = true;
  registerNavigationCommands();
  registerFileOpsCommands();
  registerTextCommands();
  registerPermissionCommands();
  registerSystemCommands();
  registerUtilityCommands();
}
