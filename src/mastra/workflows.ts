import { Workflow } from '@mastra/core';
import { 
  coordinatorMastraAgent, 
  executorMastraAgent,
  researcherAgent,
  architectAgent,
  coderAgent,
  testerAgent,
  reviewerAgent
} from './agents';
import { 
  createTeamTool,
  executeWorkflowTool,
  sendMessageTool,
  getAgentStatusTool,
  createGoalTool,
  monitorSystemTool
} from './tools';

/**
 * Software Development Workflow
 * Orchestrates the complete software development lifecycle using agentic-flow agents
 */
export const softwareDevelopmentWorkflow = new Workflow({
  name: 'softwareDevelopment',
  description: 'Complete software development workflow with research, architecture, coding, testing, and review',
  steps: [
    {
      id: 'create-dev-team',
      type: 'tool',
      tool: createTeamTool,
      input: {
        teamName: 'dev-team-{{timestamp}}',
        goal: '{{requirement}}',
        agentTypes: ['coordinator', 'architect', 'coder', 'tester', 'reviewer'],
        teamSize: 5
      }
    },
    {
      id: 'research-phase',
      type: 'agent',
      agent: researcherAgent,
      prompt: `Research the following requirement and provide insights:
      Requirement: {{requirement}}
      
      Please provide:
      1. Technical feasibility analysis
      2. Similar solutions or patterns
      3. Potential challenges and risks
      4. Recommended technologies or approaches
      5. Timeline estimation`,
      dependsOn: ['create-dev-team']
    },
    {
      id: 'architecture-design',
      type: 'agent',
      agent: architectAgent,
      prompt: `Based on the research findings, create a technical architecture:
      Research: {{outputs.research-phase.response}}
      Requirement: {{requirement}}
      
      Please provide:
      1. System architecture diagram (text description)
      2. Component breakdown
      3. Technology stack recommendations
      4. Database design considerations
      5. API design specifications
      6. Scalability and performance considerations`,
      dependsOn: ['research-phase']
    },
    {
      id: 'create-goal',
      type: 'tool',
      tool: createGoalTool,
      input: {
        description: 'Implement {{requirement}} based on architectural design',
        priority: 'high',
        assignedTeam: '{{outputs.create-dev-team.teamId}}',
        requirements: ['{{outputs.architecture-design.response}}']
      },
      dependsOn: ['architecture-design']
    },
    {
      id: 'implementation',
      type: 'agent',
      agent: coderAgent,
      prompt: `Implement the following requirement based on the architecture:
      Architecture: {{outputs.architecture-design.response}}
      Requirement: {{requirement}}
      
      Please provide:
      1. Main implementation code
      2. Configuration files
      3. Database schemas/migrations
      4. API endpoints
      5. Error handling
      6. Documentation comments`,
      dependsOn: ['create-goal']
    },
    {
      id: 'testing',
      type: 'agent',
      agent: testerAgent,
      prompt: `Create comprehensive tests for the implementation:
      Implementation: {{outputs.implementation.response}}
      Architecture: {{outputs.architecture-design.response}}
      
      Please provide:
      1. Unit tests
      2. Integration tests
      3. End-to-end test scenarios
      4. Performance test considerations
      5. Edge cases and error scenarios
      6. Test data setup`,
      dependsOn: ['implementation']
    },
    {
      id: 'code-review',
      type: 'agent',
      agent: reviewerAgent,
      prompt: `Review the implementation and tests:
      Implementation: {{outputs.implementation.response}}
      Tests: {{outputs.testing.response}}
      Architecture: {{outputs.architecture-design.response}}
      
      Please provide:
      1. Code quality assessment
      2. Architecture adherence review
      3. Security considerations
      4. Performance implications
      5. Maintainability evaluation
      6. Recommendations for improvements`,
      dependsOn: ['testing']
    },
    {
      id: 'notify-completion',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'workflow.completed',
        payload: {
          workflowName: 'softwareDevelopment',
          requirement: '{{requirement}}',
          teamId: '{{outputs.create-dev-team.teamId}}',
          research: '{{outputs.research-phase.response}}',
          architecture: '{{outputs.architecture-design.response}}',
          implementation: '{{outputs.implementation.response}}',
          testing: '{{outputs.testing.response}}',
          review: '{{outputs.code-review.response}}'
        },
        priority: 'high'
      },
      dependsOn: ['code-review']
    }
  ],
});

/**
 * Problem Analysis and Solution Workflow
 * Analyzes complex problems and creates solutions using coordinator and executor agents
 */
export const problemSolutionWorkflow = new Workflow({
  name: 'problemSolution',
  description: 'Analyze problems and create comprehensive solutions',
  steps: [
    {
      id: 'problem-analysis',
      type: 'agent',
      agent: coordinatorMastraAgent,
      prompt: `Analyze the following problem and break it down:
      Problem: {{problem}}
      
      Please provide:
      1. Problem decomposition into sub-problems
      2. Priority ranking of issues
      3. Dependencies between sub-problems
      4. Resource requirements estimation
      5. Recommended team composition
      6. Success criteria definition`,
    },
    {
      id: 'create-solution-team',
      type: 'tool',
      tool: createTeamTool,
      input: {
        teamName: 'solution-team-{{timestamp}}',
        goal: 'Solve: {{problem}}',
        agentTypes: ['coordinator', 'executor', 'researcher', 'specialist'],
        teamSize: 4
      },
      dependsOn: ['problem-analysis']
    },
    {
      id: 'solution-design',
      type: 'agent',
      agent: executorMastraAgent,
      prompt: `Design a comprehensive solution based on the analysis:
      Analysis: {{outputs.problem-analysis.response}}
      Problem: {{problem}}
      Team: {{outputs.create-solution-team.teamId}}
      
      Please provide:
      1. Detailed solution approach
      2. Step-by-step implementation plan
      3. Risk mitigation strategies
      4. Timeline and milestones
      5. Required resources and tools
      6. Success metrics and KPIs`,
      dependsOn: ['create-solution-team']
    },
    {
      id: 'solution-validation',
      type: 'agent',
      agent: reviewerAgent,
      prompt: `Validate the proposed solution:
      Solution: {{outputs.solution-design.response}}
      Original Problem: {{problem}}
      Analysis: {{outputs.problem-analysis.response}}
      
      Please provide:
      1. Solution completeness assessment
      2. Feasibility evaluation
      3. Potential issues identification
      4. Alternative approaches consideration
      5. Recommendations for improvement
      6. Implementation readiness assessment`,
      dependsOn: ['solution-design']
    },
    {
      id: 'monitor-solution',
      type: 'tool',
      tool: monitorSystemTool,
      input: {
        includeAgents: true,
        includeWorkflows: true,
        includeMessages: true
      },
      dependsOn: ['solution-validation']
    },
    {
      id: 'notify-solution-ready',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'solution.ready',
        payload: {
          problem: '{{problem}}',
          analysis: '{{outputs.problem-analysis.response}}',
          solution: '{{outputs.solution-design.response}}',
          validation: '{{outputs.solution-validation.response}}',
          teamId: '{{outputs.create-solution-team.teamId}}',
          systemStatus: '{{outputs.monitor-solution}}'
        },
        priority: 'high'
      },
      dependsOn: ['monitor-solution']
    }
  ],
});

/**
 * Agent Coordination Workflow
 * Demonstrates multi-agent coordination and task distribution
 */
export const agentCoordinationWorkflow = new Workflow({
  name: 'agentCoordination',
  description: 'Coordinate multiple agents for complex task execution',
  steps: [
    {
      id: 'task-decomposition',
      type: 'agent',
      agent: coordinatorMastraAgent,
      prompt: `Decompose the following complex task:
      Task: {{complexTask}}
      
      Break it down into:
      1. Individual subtasks
      2. Dependencies between tasks
      3. Agent role assignments
      4. Execution order and timing
      5. Communication requirements
      6. Success criteria for each subtask`,
    },
    {
      id: 'create-coordination-team',
      type: 'tool',
      tool: createTeamTool,
      input: {
        teamName: 'coord-team-{{timestamp}}',
        goal: '{{complexTask}}',
        agentTypes: ['coordinator', 'executor', 'researcher', 'analyst', 'monitor'],
        teamSize: 5
      },
      dependsOn: ['task-decomposition']
    },
    {
      id: 'parallel-execution-1',
      type: 'parallel',
      steps: [
        {
          id: 'research-subtask',
          type: 'agent',
          agent: researcherAgent,
          prompt: 'Research subtask: {{outputs.task-decomposition.subtask1}}'
        },
        {
          id: 'analysis-subtask',
          type: 'agent',
          agent: coordinatorMastraAgent,
          prompt: 'Analyze subtask: {{outputs.task-decomposition.subtask2}}'
        }
      ],
      dependsOn: ['create-coordination-team']
    },
    {
      id: 'execution-coordination',
      type: 'agent',
      agent: executorMastraAgent,
      prompt: `Coordinate the execution of parallel results:
      Research Results: {{outputs.parallel-execution-1.research-subtask.response}}
      Analysis Results: {{outputs.parallel-execution-1.analysis-subtask.response}}
      Original Task: {{complexTask}}
      Team: {{outputs.create-coordination-team.teamId}}
      
      Provide:
      1. Integrated execution plan
      2. Resource allocation
      3. Timeline coordination
      4. Quality assurance steps
      5. Communication protocol`,
      dependsOn: ['parallel-execution-1']
    },
    {
      id: 'monitor-progress',
      type: 'tool',
      tool: getAgentStatusTool,
      input: {
        teamId: '{{outputs.create-coordination-team.teamId}}',
        includeMetrics: true
      },
      dependsOn: ['execution-coordination']
    },
    {
      id: 'final-coordination',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'coordination.completed',
        payload: {
          complexTask: '{{complexTask}}',
          decomposition: '{{outputs.task-decomposition.response}}',
          coordination: '{{outputs.execution-coordination.response}}',
          teamStatus: '{{outputs.monitor-progress}}',
          teamId: '{{outputs.create-coordination-team.teamId}}'
        },
        priority: 'high'
      },
      dependsOn: ['monitor-progress']
    }
  ],
});

/**
 * System Health and Monitoring Workflow
 * Monitors the agentic-flow system and provides health reports
 */
export const systemMonitoringWorkflow = new Workflow({
  name: 'systemMonitoring',
  description: 'Monitor system health and generate comprehensive reports',
  steps: [
    {
      id: 'initial-health-check',
      type: 'tool',
      tool: monitorSystemTool,
      input: {
        includeAgents: true,
        includeWorkflows: true,
        includeMessages: true
      }
    },
    {
      id: 'agent-status-check',
      type: 'tool',
      tool: getAgentStatusTool,
      input: {
        includeMetrics: true
      },
      dependsOn: ['initial-health-check']
    },
    {
      id: 'health-analysis',
      type: 'agent',
      agent: coordinatorMastraAgent,
      prompt: `Analyze the system health data:
      System Status: {{outputs.initial-health-check}}
      Agent Status: {{outputs.agent-status-check}}
      
      Provide:
      1. Overall system health assessment
      2. Performance bottlenecks identification
      3. Agent utilization analysis
      4. Workflow efficiency evaluation
      5. Recommendations for optimization
      6. Alert conditions and thresholds`,
      dependsOn: ['agent-status-check']
    },
    {
      id: 'generate-health-report',
      type: 'tool',
      tool: sendMessageTool,
      input: {
        type: 'system.health.report',
        payload: {
          timestamp: '{{timestamp}}',
          systemStatus: '{{outputs.initial-health-check}}',
          agentStatus: '{{outputs.agent-status-check}}',
          analysis: '{{outputs.health-analysis.response}}'
        },
        priority: 'medium'
      },
      dependsOn: ['health-analysis']
    }
  ],
});

// Export all workflows
export const mastraWorkflows = {
  softwareDevelopment: softwareDevelopmentWorkflow,
  problemSolution: problemSolutionWorkflow,
  agentCoordination: agentCoordinationWorkflow,
  systemMonitoring: systemMonitoringWorkflow,
};