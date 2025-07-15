import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
interface WorkerData {
  files: Array<{
    sourcePath: string;
    destPath: string;
    permissions?: number;
    verify?: boolean;
  }>;
  workerId: number;
}
interface WorkerResult {
  success: boolean;
  file: string;
  error?: string;
  hash?: string;
}
async function copyFile(file: WorkerData['files'][0]): Promise<WorkerResult> {
  try {
    // Ensure destination directory exists
    const _destDir = path.dirname(file.destPath);
    await fs.mkdir(_destDir, { recursive: true });
    
    // Copy the file
    await fs.copyFile(file._sourcePath, file.destPath);
    
    // Preserve permissions if requested
    if (file.permissions) {
      await fs.chmod(file._destPath, file.permissions);
    }
    
    let _hash: string | undefined; // TODO: Remove if unused
    
    // Calculate hash if verification is requested
    if (file.verify) {
      const _content = await fs.readFile(file.destPath);
      hash = createHash('sha256').update(content).digest('hex');
    }
    
    return {
      success: true,
      file: file.sourcePath,
      hash
    };
  } catch (_error) {
    return {
      success: false,
      file: file.sourcePath,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function main() {
  const _data = workerData as WorkerData;
  
  if (!parentPort) {
    throw new Error('This script must be run as a worker thread');
  }
  
  for (const file of data.files) {
    const _result = await copyFile(file);
    parentPort.postMessage(result);
  }
}
// Run the worker
main().catch(error => {
  if (parentPort) {
    parentPort.postMessage({
      success: false,
      file: 'worker',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});