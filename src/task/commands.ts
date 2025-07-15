// Task command creators
import type { TaskCommandContext } from './types.js';
export function createTaskCreateCommand(_context: TaskCommandContext) {
  return {
    name: 'create',
    description: 'Create a new task',
    execute: async (args: unknown) => {
      try {
        const _task = await context.taskEngine.createTask(args);
        context.logger?.info('Task created successfully', { taskId: task.id });
        return task;
      } catch (_error) {
        context.logger?.error('Failed to create task', error);
        throw error;
      }
    }
  };
}
export function createTaskListCommand(_context: TaskCommandContext) {
  return {
    name: 'list',
    description: 'List all tasks',
    execute: async (filter?: _any, sort?: _any, limit?: _number, offset?: number) => {
      try {
        const _result = await context.taskEngine.listTasks(_filter, _sort, _limit, offset);
        context.logger?.info('Tasks listed successfully', { count: result.tasks.length });
        return result;
      } catch (_error) {
        context.logger?.error('Failed to list tasks', error);
        throw error;
      }
    }
  };
}
export function createTaskStatusCommand(_context: TaskCommandContext) {
  return {
    name: 'status',
    description: 'Get task status',
    execute: async (taskId: string) => {
      try {
        const _status = await context.taskEngine.getTaskStatus(taskId);
        if (!status) {
          throw new Error(`Task ${taskId} not found`);
        }
        context.logger?.info('Task status retrieved', { taskId });
        return status;
      } catch (_error) {
        context.logger?.error('Failed to get task status', error);
        throw error;
      }
    }
  };
}
export function createTaskCancelCommand(_context: TaskCommandContext) {
  return {
    name: 'cancel',
    description: 'Cancel a task',
    execute: async (taskId: _string, reason: string = 'User requested', rollback: boolean = true) => {
      try {
        await context.taskEngine.cancelTask(_taskId, _reason, rollback);
        context.logger?.info('Task cancelled successfully', { _taskId, reason });
        return { success: true, taskId, reason };
      } catch (_error) {
        context.logger?.error('Failed to cancel task', error);
        throw error;
      }
    }
  };
}
export function createTaskWorkflowCommand(_context: TaskCommandContext) {
  return {
    name: 'workflow',
    description: 'Manage task workflows',
    execute: async (action: 'create' | 'execute' | 'list' | 'get', ...args: unknown[]) => {
      try {
        switch (action) {
          case 'create': {
            const [workflowData] = args;
            const _createdWorkflow = await context.taskEngine.createWorkflow(workflowData);
            context.logger?.info('Workflow created successfully', { workflowId: createdWorkflow.id });
            return createdWorkflow;
          }
          case 'execute': {
            const [workflowToExecute] = args;
            await context.taskEngine.executeWorkflow(workflowToExecute);
            context.logger?.info('Workflow execution started', { workflowId: workflowToExecute.id });
            return { success: true, workflowId: workflowToExecute.id };
          }
          case 'list':
            {
context.logger?.info('Workflow list requested');
            
}return { workflows: [] }; // Would need additional implementation
          case 'get': {
            const [workflowId] = args;
            context.logger?.info('Workflow details requested', { workflowId });
            return { workflowId }; // Would need additional implementation
          }
          default:
            throw new Error(`Unknown workflow action: ${action}`);
        }
      } catch (_error) {
        context.logger?.error('Workflow operation failed', error);
        throw error;
      }
    }
  };
}