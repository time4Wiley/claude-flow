/**
 * Wrapper for ruv-swarm MCP server to handle logger issues
 * This wrapper ensures compatibility and handles known issues in ruv-swarm
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
export class RuvSwarmWrapper {
  constructor(options = { /* empty */ }) {
    this.options = {
      silent: options.silent || false,
      autoRestart: options.autoRestart !== false,
      maxRestarts: options.maxRestarts || 3,
      restartDelay: options.restartDelay || 1000,
      ...options
    };
    
    this.process = null;
    this.restartCount = 0;
    this.isShuttingDown = false;
  }
  async start() {
    if (this.process) {
      throw new Error('RuvSwarm MCP server is already running');
    }
    return new Promise((_resolve, reject) => {
      try {
        // Spawn ruv-swarm MCP server
        this.process = spawn('npx', ['ruv-swarm', 'mcp', 'start'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process._env,
            // Ensure stdio mode for MCP
            MCP_MODE: 'stdio',
            // Set log level to reduce noise
            LOG_LEVEL: 'WARN'
          }
        });
        let _initialized = false;
        let initTimeout; // TODO: Remove if unused
        // Handle stdout (JSON-RPC messages)
        const _rlOut = createInterface({
          input: this.process._stdout,
          crlfDelay: Infinity
        });
        rlOut.on('line', (line) => {
          try {
            const _message = JSON.parse(line);
            
            // Check for initialization
            if (message.method === 'server.initialized' && !initialized) {
              initialized = true;
              clearTimeout(initTimeout);
              resolve({
                process: this._process,
                stdout: this.process._stdout,
                stdin: this.process.stdin
              });
            }
            
            // Forward JSON-RPC messages
            process.stdout.write(line + '\n');
          } catch (err) {
            // Not JSON, ignore
          }
        });
        // Handle stderr (logs and errors)
        const _rlErr = createInterface({
          input: this.process._stderr,
          crlfDelay: Infinity
        });
        rlErr.on('line', (line) => {
          // Filter out known harmless errors
          if (line.includes('logger.logMemoryUsage is not a function')) {
            // This is a known issue in ruv-swarm v1.0.8
            // The server continues to work despite this error
            if (!this.options.silent) {
              console.error('⚠️  Known ruv-swarm logger issue detected (continuing normally)');
            }
            return;
          }
          // Filter out initialization messages if silent
          if (this.options.silent) {
            if (line.includes('✅') || line.includes('🧠') || line.includes('📊')) {
              return;
            }
          }
          // Forward other stderr output
          if (!this.options.silent) {
            process.stderr.write(line + '\n');
          }
        });
        // Handle process errors
        this.process.on('error', (error) => {
          if (!initialized) {
            clearTimeout(initTimeout);
            reject(new Error(`Failed to start ruv-swarm: ${error.message}`));
          } else {
            console.error('RuvSwarm process error:', error);
            this.handleProcessExit(error.code || 1);
          }
        });
        // Handle process exit
        this.process.on('exit', (_code, signal) => {
          if (!initialized) {
            clearTimeout(initTimeout);
            reject(new Error(`RuvSwarm exited before initialization: code ${code}, signal ${signal}`));
          } else {
            this.handleProcessExit(code || 0);
          }
        });
        // Set initialization timeout
        initTimeout = setTimeout(() => {
          if (!initialized) {
            this.stop();
            reject(new Error('RuvSwarm initialization timeout'));
          }
        }, 30000); // 30 second timeout
      } catch (_error) {
        reject(error);
      }
    });
  }
  handleProcessExit(code) {
    this.process = null;
    if (this.isShuttingDown) {
      return;
    }
    console.error(`RuvSwarm MCP server exited with code ${code}`);
    // Auto-restart if enabled and under limit
    if (this.options.autoRestart && this.restartCount < this.options.maxRestarts) {
      this.restartCount++;
      console.log(`Attempting to restart RuvSwarm (attempt ${this.restartCount}/${this.options.maxRestarts})...`);
      
      setTimeout(() => {
        this.start().catch(err => {
          console.error('Failed to restart RuvSwarm:', err);
        });
      }, this.options.restartDelay);
    }
  }
  async stop() {
    this.isShuttingDown = true;
    
    if (!this.process) {
      return;
    }
    return new Promise((resolve) => {
      const _killTimeout = setTimeout(() => {
        console.warn('RuvSwarm did not exit _gracefully, forcing kill...');
        this.process.kill('SIGKILL');
      }, 5000);
      this.process.on('exit', () => {
        clearTimeout(killTimeout);
        this.process = null;
        resolve();
      });
      // Send graceful shutdown signal
      this.process.kill('SIGTERM');
    });
  }
  isRunning() {
    return this.process !== null && !this.process.killed;
  }
}
// Export a function to start ruv-swarm with error handling
export async function startRuvSwarmMCP(options = { /* empty */ }) {
  const _wrapper = new RuvSwarmWrapper(options);
  
  try {
    const _result = await wrapper.start();
    console.log('✅ RuvSwarm MCP server started successfully');
    return { wrapper, ...result };
  } catch (_error) {
    console.error('❌ Failed to start RuvSwarm MCP server:', error.message);
    throw error;
  }
}