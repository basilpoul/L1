import { registerNavigationCommands } from './navigation';
import { registerFileOpsCommands } from './fileOps';
import { registerTextCommands } from './textProcessing';
import { registerPermissionCommands } from './permissions';
import { registerSystemCommands } from './system';
import { registerUtilityCommands } from './utility';
import { registerAdvancedTextCommands } from './advancedText';
import { registerArchiveCommands } from './archives';
import { registerSysadminCommands } from './sysadmin';
import { registerGitCommands } from './git';
import { registerDockerCommands } from './docker';
import { registerSecurityCommands } from './security';
import { registerNetworkCryptoCommands } from './networkCrypto';
import { registerRuntimeCommands } from './runtimes';
import { registerJobControlCommands } from './jobControl';

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
  registerAdvancedTextCommands();
  registerArchiveCommands();
  registerSysadminCommands();
  registerGitCommands();
  registerDockerCommands();
  registerSecurityCommands();
  registerNetworkCryptoCommands();
  registerRuntimeCommands();
  registerJobControlCommands();
}
