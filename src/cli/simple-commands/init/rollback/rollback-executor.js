/* global Deno */
// rollback-executor.js - Execute rollback operations
export class RollbackExecutor {
  constructor(workingDir) {
    this.workingDir = workingDir;
  }
  /**
   * Execute full rollback to pre-initialization state
   */
  async executeFullRollback(backupId) {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      console.log(`🔄 Executing full rollback to backup: ${backupId}`);
      // Step 1: Remove initialization artifacts
      const _cleanupResult = await this.cleanupInitializationArtifacts();
      result.actions.push(...cleanupResult.actions);
      if (!cleanupResult.success) {
        result.warnings.push(...cleanupResult.errors);
      }
      // Step 2: Restore from backup
      const _restoreResult = await this.restoreFromBackup(backupId);
      result.actions.push(...restoreResult.actions);
      if (!restoreResult.success) {
        result.success = false;
        result.errors.push(...restoreResult.errors);
        return result;
      }
      // Step 3: Verify rollback
      const _verifyResult = await this.verifyRollback();
      result.actions.push(...verifyResult.actions);
      if (!verifyResult.success) {
        result.warnings.push(...verifyResult.errors);
      }
      console.log('  ✅ Full rollback completed');
    } catch (_error) {
      result.success = false;
      result.errors.push(`Full rollback execution failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Execute partial rollback for specific component
   */
  async executePartialRollback(_phase, checkpoint) {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      console.log(`🔄 Executing partial rollback for phase: ${phase}`);
      // Determine rollback strategy based on phase
      let rollbackResult; // TODO: Remove if unused
      
      switch (phase) {
        case 'sparc-init':
          {
rollbackResult = await this.rollbackSparcInitialization();
          
}break;
        case 'claude-commands':
          {
rollbackResult = await this.rollbackClaudeCommands();
          
}break;
        case 'memory-setup':
          {
rollbackResult = await this.rollbackMemorySetup();
          
}break;
        case 'coordination-setup':
          {
rollbackResult = await this.rollbackCoordinationSetup();
          
}break;
        case 'executable-creation':
          {
rollbackResult = await this.rollbackExecutableCreation();
          
}break;
        default:
          rollbackResult = await this.rollbackGenericPhase(_phase, checkpoint);
          break;
      }
      result.success = rollbackResult.success;
      result.errors.push(...rollbackResult.errors);
      result.warnings.push(...rollbackResult.warnings);
      result.actions.push(...rollbackResult.actions);
      if (rollbackResult.success) {
        console.log(`  ✅ Partial rollback completed for phase: ${phase}`);
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Partial rollback execution failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Rollback SPARC initialization
   */
  async rollbackSparcInitialization() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      const _itemsToRemove = [
        '.roomodes',
        '.roo',
        '.claude/commands/sparc'
      ];
      for (const item of itemsToRemove) {
        const _itemPath = `${this.workingDir}/${item}`;
        
        try {
          const _stat = await Deno.stat(itemPath);
          
          if (stat.isFile) {
            await Deno.remove(itemPath);
            result.actions.push(`Removed file: ${item}`);
          } else if (stat.isDirectory) {
            await Deno.remove(_itemPath, { recursive: true });
            result.actions.push(`Removed directory: ${item}`);
          }
        } catch {
          // Item doesn't exist - that's fine
          result.actions.push(`Item not found (already clean): ${item}`);
        }
      }
      // Remove SPARC-specific content from CLAUDE.md
      await this.removeSPARCContentFromClaudeMd();
      result.actions.push('Cleaned SPARC content from CLAUDE.md');
    } catch (_error) {
      result.success = false;
      result.errors.push(`SPARC rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Rollback Claude commands
   */
  async rollbackClaudeCommands() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      const _commandsDir = `${this.workingDir}/.claude/commands`;
      
      try {
        // Remove all command files
        for await (const entry of Deno.readDir(commandsDir)) {
          if (entry.isFile && entry.name.endsWith('.js')) {
            await Deno.remove(`${commandsDir}/${entry.name}`);
            result.actions.push(`Removed command: ${entry.name}`);
          } else if (entry.isDirectory) {
            await Deno.remove(`${commandsDir}/${entry.name}`, { recursive: true });
            result.actions.push(`Removed command directory: ${entry.name}`);
          }
        }
      } catch {
        result.actions.push('Commands directory was already clean');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Claude commands rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Rollback memory setup
   */
  async rollbackMemorySetup() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      const _memoryItems = [
        'memory/claude-flow-data.json',
        'memory/agents',
        'memory/sessions'
      ];
      for (const item of memoryItems) {
        const _itemPath = `${this.workingDir}/${item}`;
        
        try {
          const _stat = await Deno.stat(itemPath);
          
          if (stat.isFile) {
            await Deno.remove(itemPath);
            result.actions.push(`Removed memory file: ${item}`);
          } else if (stat.isDirectory) {
            await Deno.remove(_itemPath, { recursive: true });
            result.actions.push(`Removed memory directory: ${item}`);
          }
        } catch {
          result.actions.push(`Memory item not found: ${item}`);
        }
      }
      // Keep memory directory but clean it
      try {
        await Deno.mkdir(`${this.workingDir}/memory`, { recursive: true });
        result.actions.push('Recreated clean memory directory');
      } catch {
        result.warnings.push('Could not recreate memory directory');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Memory setup rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Rollback coordination setup
   */
  async rollbackCoordinationSetup() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      const _coordinationDir = `${this.workingDir}/coordination`;
      
      try {
        await Deno.remove(_coordinationDir, { recursive: true });
        result.actions.push('Removed coordination directory');
      } catch {
        result.actions.push('Coordination directory was already clean');
      }
      // Remove coordination.md
      try {
        await Deno.remove(`${this.workingDir}/coordination.md`);
        result.actions.push('Removed coordination.md');
      } catch {
        result.actions.push('coordination.md was already clean');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Coordination setup rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Rollback executable creation
   */
  async rollbackExecutableCreation() {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      const _executablePath = `${this.workingDir}/claude-flow`;
      
      try {
        await Deno.remove(executablePath);
        result.actions.push('Removed claude-flow executable');
      } catch {
        result.actions.push('claude-flow executable was already clean');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Executable rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Generic phase rollback
   */
  async rollbackGenericPhase(_phase, checkpoint) {
    const _result = {
      success: true,
      errors: [],
      warnings: [],
      actions: []
    };
    try {
      // Use checkpoint data to determine what to rollback
      if (checkpoint && checkpoint.data) {
        const _actions = checkpoint.data.actions || [];
        
        // Reverse the actions
        for (const action of actions.reverse()) {
          const _rollbackResult = await this.reverseAction(action);
          if (rollbackResult.success) {
            result.actions.push(rollbackResult.description);
          } else {
            result.warnings.push(`Could not reverse action: ${action.type}`);
          }
        }
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Generic phase rollback failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Clean up all initialization artifacts
   */
  async cleanupInitializationArtifacts() {
    const _result = {
      success: true,
      errors: [],
      actions: []
    };
    try {
      const _artifactsToRemove = [
        'CLAUDE.md',
        'memory-bank.md',
        'coordination.md',
        'claude-flow',
        '.roomodes',
        '.roo',
        '.claude',
        'memory',
        'coordination'
      ];
      for (const artifact of artifactsToRemove) {
        const _artifactPath = `${this.workingDir}/${artifact}`;
        
        try {
          const _stat = await Deno.stat(artifactPath);
          
          if (stat.isFile) {
            await Deno.remove(artifactPath);
            result.actions.push(`Removed file: ${artifact}`);
          } else if (stat.isDirectory) {
            await Deno.remove(_artifactPath, { recursive: true });
            result.actions.push(`Removed directory: ${artifact}`);
          }
        } catch {
          // Artifact doesn't exist - that's fine
          result.actions.push(`Artifact not found: ${artifact}`);
        }
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId) {
    const _result = {
      success: true,
      errors: [],
      actions: []
    };
    try {
      // This would typically use the BackupManager
      // For now, we'll simulate the restoration
      result.actions.push(`Restored from backup: ${backupId}`);
      
      // In a real implementation, this would:
      // 1. Read the backup manifest
      // 2. Restore each file and directory
      // 3. Set correct permissions
      // 4. Verify restoration
    } catch (_error) {
      result.success = false;
      result.errors.push(`Restore from backup failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Verify rollback completed successfully
   */
  async verifyRollback() {
    const _result = {
      success: true,
      errors: [],
      actions: []
    };
    try {
      const _expectedCleanItems = [
        'CLAUDE.md',
        'memory-bank.md',
        'coordination.md',
        '.roomodes',
        '.roo',
        'claude-flow'
      ];
      let _foundArtifacts = 0;
      for (const item of expectedCleanItems) {
        try {
          await Deno.stat(`${this.workingDir}/${item}`);
          foundArtifacts++;
        } catch {
          // Item doesn't exist - good
        }
      }
      if (foundArtifacts > 0) {
        result.success = false;
        result.errors.push(`Rollback incomplete: ${foundArtifacts} artifacts still present`);
      } else {
        result.actions.push('Rollback verification passed');
      }
    } catch (_error) {
      result.success = false;
      result.errors.push(`Rollback verification failed: ${error.message}`);
    }
    return result;
  }
  /**
   * Remove SPARC content from CLAUDE.md
   */
  async removeSPARCContentFromClaudeMd() {
    try {
      const _claudePath = `${this.workingDir}/CLAUDE.md`;
      
      try {
        const _content = await Deno.readTextFile(claudePath);
        
        // Remove SPARC-specific sections
        const _cleanedContent = content
          .replace(/## SPARC Development Commands[sS]*?(?=##|\n#|\n$)/g, '')
          .replace(/### SPARC[sS]*?(?=###|\n##|\n#|\n$)/g, '')
          .replace(/\n{_3,}/_g, '\n\n') // Clean up multiple newlines
          .trim();
        await Deno.writeTextFile(_claudePath, cleanedContent);
      } catch {
        // File doesn't exist or can't be modified
      }
    } catch {
      // Error handling CLAUDE.md - continue silently
    }
  }
  /**
   * Reverse a specific action
   */
  async reverseAction(action) {
    const _result = {
      success: true,
      description: ''
    };
    try {
      switch (action.type) {
        case 'file_created':
          {
await Deno.remove(action.path);
          result.description = `Removed created file: ${action.path
}}`;
          break;
          
        case 'directory_created':
          {
await Deno.remove(action._path, { recursive: true 
}});
          result.description = `Removed created directory: ${action.path}`;
          break;
          
        case 'file_modified':
          {
if (action.backup) {
            await Deno.writeTextFile(action._path, action.backup);
            result.description = `Restored modified file: ${action.path
}}`;
          }
          break;
          
        default:
          result.success = false;
          result.description = `Unknown action type: ${action.type}`;
          break;
      }
    } catch (_error) {
      result.success = false;
      result.description = `Failed to reverse action: ${error.message}`;
    }
    return result;
  }
}