import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  # Enums
  enum AgentType {
    COORDINATOR
    EXECUTOR
    SPECIALIZED
  }

  enum AgentStatus {
    ACTIVE
    INACTIVE
    INITIALIZING
    ERROR
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum MessageType {
    TASK
    RESULT
    QUERY
    RESPONSE
    EVENT
  }

  enum WorkflowStatus {
    DRAFT
    ACTIVE
    COMPLETED
    FAILED
  }

  enum GoalStatus {
    PENDING
    ANALYZING
    EXECUTING
    COMPLETED
    FAILED
  }

  # Agent types
  type Agent {
    id: ID!
    name: String!
    type: AgentType!
    status: AgentStatus!
    capabilities: [String!]!
    configuration: JSON
    metrics: AgentMetrics!
    createdAt: DateTime!
    updatedAt: DateTime!
    goals: [Goal!]!
    messages(limit: Int = 20, offset: Int = 0): MessageConnection!
  }

  type AgentMetrics {
    tasksCompleted: Int!
    successRate: Float!
    averageResponseTime: Float!
    lastActivity: DateTime
  }

  type AgentConnection {
    edges: [AgentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AgentEdge {
    node: Agent!
    cursor: String!
  }

  # Workflow types
  type Workflow {
    id: ID!
    name: String!
    description: String
    status: WorkflowStatus!
    steps: [WorkflowStep!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    executions(limit: Int = 20): [WorkflowExecution!]!
  }

  type WorkflowStep {
    id: ID!
    name: String!
    type: String!
    action: String!
    parameters: JSON
    dependencies: [String!]!
  }

  type WorkflowExecution {
    id: ID!
    workflow: Workflow!
    status: String!
    startedAt: DateTime!
    completedAt: DateTime
    results: JSON
    error: String
  }

  type WorkflowConnection {
    edges: [WorkflowEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WorkflowEdge {
    node: Workflow!
    cursor: String!
  }

  # Goal types
  type Goal {
    id: ID!
    description: String!
    priority: Priority!
    status: GoalStatus!
    parsedIntent: ParsedIntent!
    subtasks: [Subtask!]!
    assignedAgent: Agent
    createdAt: DateTime!
    updatedAt: DateTime
    completedAt: DateTime
  }

  type ParsedIntent {
    action: String!
    entities: [Entity!]!
    constraints: JSON
  }

  type Entity {
    type: String!
    value: String!
  }

  type Subtask {
    id: ID!
    description: String!
    status: String!
    assignedAgent: Agent
  }

  # Message types
  type Message {
    id: ID!
    from: Agent!
    to: Agent!
    type: MessageType!
    content: JSON!
    priority: Priority!
    timestamp: DateTime!
    deliveredAt: DateTime
    readAt: DateTime
  }

  type MessageConnection {
    edges: [MessageEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type MessageEdge {
    node: Message!
    cursor: String!
  }

  # Webhook types
  type Webhook {
    id: ID!
    url: String!
    events: [String!]!
    active: Boolean!
    secret: String
    createdAt: DateTime!
    lastTriggered: DateTime
    deliveryStats: WebhookStats!
  }

  type WebhookStats {
    totalDeliveries: Int!
    successfulDeliveries: Int!
    failedDeliveries: Int!
    averageResponseTime: Float!
  }

  # Plugin types
  type Plugin {
    id: ID!
    name: String!
    version: String!
    description: String
    enabled: Boolean!
    configuration: JSON
    capabilities: [String!]!
  }

  # Pagination
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input types
  input CreateAgentInput {
    name: String!
    type: AgentType!
    capabilities: [String!]
    configuration: JSON
  }

  input UpdateAgentInput {
    name: String
    capabilities: [String!]
    configuration: JSON
  }

  input CreateWorkflowInput {
    name: String!
    description: String
    steps: [WorkflowStepInput!]!
  }

  input WorkflowStepInput {
    name: String!
    type: String!
    action: String!
    parameters: JSON
    dependencies: [String!]
  }

  input CreateGoalInput {
    description: String!
    priority: Priority
    constraints: JSON
  }

  input SendMessageInput {
    from: ID!
    to: ID!
    type: MessageType!
    content: JSON!
    priority: Priority
  }

  input CreateWebhookInput {
    url: String!
    events: [String!]!
    secret: String
  }

  input InstallPluginInput {
    source: String!
    configuration: JSON
  }

  # Queries
  type Query {
    # Agent queries
    agent(id: ID!): Agent
    agents(
      limit: Int = 20
      offset: Int = 0
      type: AgentType
      status: AgentStatus
    ): AgentConnection!
    
    # Workflow queries
    workflow(id: ID!): Workflow
    workflows(
      limit: Int = 20
      offset: Int = 0
      status: WorkflowStatus
    ): WorkflowConnection!
    
    # Goal queries
    goal(id: ID!): Goal
    goals(
      limit: Int = 20
      offset: Int = 0
      status: GoalStatus
      priority: Priority
      agentId: ID
    ): [Goal!]!
    
    # Message queries
    messages(
      limit: Int = 20
      offset: Int = 0
      agentId: ID
      type: MessageType
    ): MessageConnection!
    
    # Webhook queries
    webhook(id: ID!): Webhook
    webhooks: [Webhook!]!
    
    # Plugin queries
    plugin(id: ID!): Plugin
    plugins(enabled: Boolean): [Plugin!]!
    
    # System queries
    systemHealth: SystemHealth!
    metrics: SystemMetrics!
  }

  # Mutations
  type Mutation {
    # Agent mutations
    createAgent(input: CreateAgentInput!): Agent!
    updateAgent(id: ID!, input: UpdateAgentInput!): Agent!
    deleteAgent(id: ID!): Boolean!
    startAgent(id: ID!): Agent!
    stopAgent(id: ID!): Agent!
    
    # Workflow mutations
    createWorkflow(input: CreateWorkflowInput!): Workflow!
    updateWorkflow(id: ID!, input: CreateWorkflowInput!): Workflow!
    deleteWorkflow(id: ID!): Boolean!
    executeWorkflow(id: ID!, parameters: JSON): WorkflowExecution!
    
    # Goal mutations
    createGoal(input: CreateGoalInput!): Goal!
    assignGoal(goalId: ID!, agentId: ID!): Goal!
    updateGoalStatus(id: ID!, status: GoalStatus!): Goal!
    
    # Message mutations
    sendMessage(input: SendMessageInput!): Message!
    markMessageAsRead(id: ID!): Message!
    
    # Webhook mutations
    createWebhook(input: CreateWebhookInput!): Webhook!
    updateWebhook(id: ID!, input: CreateWebhookInput!): Webhook!
    deleteWebhook(id: ID!): Boolean!
    toggleWebhook(id: ID!, active: Boolean!): Webhook!
    
    # Plugin mutations
    installPlugin(input: InstallPluginInput!): Plugin!
    uninstallPlugin(id: ID!): Boolean!
    togglePlugin(id: ID!, enabled: Boolean!): Plugin!
    updatePluginConfig(id: ID!, configuration: JSON!): Plugin!
  }

  # Subscriptions
  type Subscription {
    # Agent events
    agentStatusChanged(agentId: ID): Agent!
    agentMetricsUpdated(agentId: ID): AgentMetrics!
    
    # Workflow events
    workflowExecutionStarted: WorkflowExecution!
    workflowExecutionCompleted: WorkflowExecution!
    
    # Goal events
    goalCreated: Goal!
    goalStatusChanged(agentId: ID): Goal!
    
    # Message events
    messageReceived(agentId: ID!): Message!
    messageSent(agentId: ID!): Message!
    
    # System events
    systemAlert: SystemAlert!
  }

  # System types
  type SystemHealth {
    status: String!
    uptime: Int!
    version: String!
    checks: [HealthCheck!]!
  }

  type HealthCheck {
    name: String!
    status: String!
    message: String
  }

  type SystemMetrics {
    activeAgents: Int!
    totalWorkflows: Int!
    executingWorkflows: Int!
    pendingGoals: Int!
    messageQueueSize: Int!
    averageResponseTime: Float!
    requestsPerMinute: Float!
  }

  type SystemAlert {
    id: ID!
    level: String!
    message: String!
    timestamp: DateTime!
    details: JSON
  }
`;