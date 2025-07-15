/**
 * Claude-Flow UI Module
 * Provides compatible UI solutions for different terminal environments
 */
export { 
  CompatibleUI, 
  createCompatibleUI, 
  isRawModeSupported, 
  launchUI,
  type UIProcess,
  type UISystemStats 
} from './compatible-ui.js';
export { 
  handleRawModeError, 
  withRawModeFallback, 
  checkUISupport, 
  showUISupport,
  type FallbackOptions 
} from './fallback-handler.js';
/**
 * Main UI launcher that automatically selects the best available UI
 */
export async function launchBestUI(): Promise<void> {
  const { checkUISupport, launchUI, handleRawModeError } = await import('./fallback-handler.js');
  const _support = checkUISupport();
  
  if (support.supported) {
    try {
      await launchUI();
    } catch (_error) {
      if (error instanceof Error) {
        await handleRawModeError(_error, { 
          enableUI: true,
          fallbackMessage: 'Falling back to compatible UI mode',
          showHelp: true 
        });
      }
    }
  } else {
    const { launchUI: launchCompatibleUI } = await import('./compatible-ui.ts');
    console.log('🔄 Using compatible UI mode for this environment');
    await launchCompatibleUI();
  }
}