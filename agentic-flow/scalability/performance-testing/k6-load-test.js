import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const agentCreationRate = new Rate('agent_creation_success');
const coordinationLatency = new Trend('coordination_latency');
const messageDeliveryRate = new Rate('message_delivery_success');
const activeAgentsGauge = new Gauge('active_agents');
const workflowExecutionTime = new Trend('workflow_execution_time');
const errorCounter = new Counter('api_errors');

// Test configuration for 10,000 RPS target
export const options = {
  scenarios: {
    // Ramp up to test system limits
    load_test: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 5000,
      stages: [
        { duration: '2m', target: 1000 },   // Warm up to 1k RPS
        { duration: '5m', target: 5000 },   // Ramp to 5k RPS
        { duration: '10m', target: 10000 }, // Target 10k RPS
        { duration: '5m', target: 10000 },  // Sustain 10k RPS
        { duration: '2m', target: 0 },      // Ramp down
      ],
    },
    // Concurrent agent stress test
    agent_stress: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      startTime: '5m',
      exec: 'agentStressTest',
    },
    // Coordination performance test
    coordination_test: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '20m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'coordinationTest',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'], // 99% success rate
    agent_creation_success: ['rate>0.99'],
    message_delivery_success: ['rate>0.99'],
    coordination_latency: ['p(95)<100', 'p(99)<200'],
    workflow_execution_time: ['p(95)<2000', 'p(99)<5000'],
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.agentic-flow.io';
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
const AGENT_TYPES = ['coordinator', 'executor', 'analyzer', 'monitor', 'specialist'];
const CAPABILITIES = [
  'task-execution',
  'data-analysis',
  'coordination',
  'monitoring',
  'decision-making',
  'learning',
  'communication',
];

// Helper function to generate agent data
function generateAgent() {
  return {
    name: `agent-${randomIntBetween(1000, 9999)}`,
    type: randomItem(AGENT_TYPES),
    capabilities: [
      randomItem(CAPABILITIES),
      randomItem(CAPABILITIES),
      randomItem(CAPABILITIES),
    ],
    region: randomItem(REGIONS),
    metadata: {
      version: '1.0.0',
      environment: 'production',
    },
  };
}

// Main load test scenario
export default function () {
  const agent = generateAgent();
  
  // Create agent
  const createRes = http.post(
    `${BASE_URL}/api/v1/agents`,
    JSON.stringify(agent),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Region': agent.region,
      },
      tags: { name: 'CreateAgent' },
    }
  );
  
  const createSuccess = check(createRes, {
    'agent created': (r) => r.status === 201,
    'has agent id': (r) => r.json('id') !== undefined,
  });
  
  agentCreationRate.add(createSuccess);
  
  if (!createSuccess) {
    errorCounter.add(1);
    return;
  }
  
  const agentId = createRes.json('id');
  
  // Update agent state
  sleep(randomIntBetween(1, 3));
  
  const stateRes = http.put(
    `${BASE_URL}/api/v1/agents/${agentId}/state`,
    JSON.stringify({ state: 'active', workload: randomIntBetween(0, 100) }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'UpdateAgentState' },
    }
  );
  
  check(stateRes, {
    'state updated': (r) => r.status === 200,
  });
  
  // Send message
  const messageRes = http.post(
    `${BASE_URL}/api/v1/messages`,
    JSON.stringify({
      from: agentId,
      to: `agent-${randomIntBetween(1, 100)}`,
      type: 'inform',
      content: {
        topic: 'performance-test',
        body: { timestamp: new Date().toISOString() },
      },
      priority: 'normal',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'SendMessage' },
    }
  );
  
  messageDeliveryRate.add(check(messageRes, {
    'message sent': (r) => r.status === 202,
  }));
  
  // Query agents by capability
  sleep(randomIntBetween(1, 2));
  
  const capability = randomItem(CAPABILITIES);
  const queryRes = http.get(
    `${BASE_URL}/api/v1/agents?capability=${capability}`,
    {
      tags: { name: 'QueryAgents' },
    }
  );
  
  check(queryRes, {
    'query successful': (r) => r.status === 200,
    'has results': (r) => r.json('agents') !== undefined,
  });
  
  // Cleanup - deregister agent
  sleep(randomIntBetween(5, 10));
  
  const deleteRes = http.del(
    `${BASE_URL}/api/v1/agents/${agentId}`,
    null,
    {
      tags: { name: 'DeleteAgent' },
    }
  );
  
  check(deleteRes, {
    'agent deleted': (r) => r.status === 204,
  });
}

// Agent stress test - maintain 100+ concurrent agents
export function agentStressTest() {
  const agents = [];
  const targetAgents = 120;
  
  // Create agents
  for (let i = 0; i < targetAgents; i++) {
    const agent = generateAgent();
    const res = http.post(
      `${BASE_URL}/api/v1/agents`,
      JSON.stringify(agent),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    if (res.status === 201) {
      agents.push(res.json('id'));
    }
    
    sleep(0.1); // Slight delay to avoid overwhelming the system
  }
  
  activeAgentsGauge.add(agents.length);
  console.log(`Created ${agents.length} agents`);
  
  // Simulate agent activity for 5 minutes
  const endTime = new Date().getTime() + 5 * 60 * 1000;
  
  while (new Date().getTime() < endTime) {
    // Random agent sends message
    const fromAgent = randomItem(agents);
    const toAgent = randomItem(agents);
    
    http.post(
      `${BASE_URL}/api/v1/messages`,
      JSON.stringify({
        from: fromAgent,
        to: toAgent,
        type: 'query',
        content: {
          topic: 'stress-test',
          body: { load: 'high' },
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    // Update random agent state
    const updateAgent = randomItem(agents);
    http.put(
      `${BASE_URL}/api/v1/agents/${updateAgent}/state`,
      JSON.stringify({ state: 'busy', cpu: randomIntBetween(50, 90) }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    sleep(randomIntBetween(1, 3));
  }
  
  // Cleanup
  agents.forEach((agentId) => {
    http.del(`${BASE_URL}/api/v1/agents/${agentId}`);
  });
}

// Coordination performance test
export function coordinationTest() {
  const startTime = new Date().getTime();
  
  // Create a team
  const teamRes = http.post(
    `${BASE_URL}/api/v1/teams`,
    JSON.stringify({
      name: `team-${randomIntBetween(1000, 9999)}`,
      type: 'dynamic',
      targetSize: 5,
      capabilities: ['task-execution', 'coordination'],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'CreateTeam' },
    }
  );
  
  if (teamRes.status !== 201) {
    errorCounter.add(1);
    return;
  }
  
  const teamId = teamRes.json('id');
  
  // Assign task to team
  const taskRes = http.post(
    `${BASE_URL}/api/v1/teams/${teamId}/tasks`,
    JSON.stringify({
      description: 'Performance test task',
      priority: 'high',
      requiredCapabilities: ['task-execution'],
      deadline: new Date(Date.now() + 60000).toISOString(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'AssignTask' },
    }
  );
  
  check(taskRes, {
    'task assigned': (r) => r.status === 202,
  });
  
  // Measure coordination latency
  const coordTime = new Date().getTime() - startTime;
  coordinationLatency.add(coordTime);
  
  // Create and execute workflow
  const workflowStartTime = new Date().getTime();
  
  const workflowRes = http.post(
    `${BASE_URL}/api/v1/workflows`,
    JSON.stringify({
      name: `workflow-${randomIntBetween(1000, 9999)}`,
      steps: [
        { type: 'agent-action', action: 'analyze' },
        { type: 'agent-action', action: 'process' },
        { type: 'agent-action', action: 'report' },
      ],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'CreateWorkflow' },
    }
  );
  
  if (workflowRes.status === 201) {
    const workflowId = workflowRes.json('id');
    
    // Execute workflow
    const execRes = http.post(
      `${BASE_URL}/api/v1/workflows/${workflowId}/execute`,
      JSON.stringify({ async: false }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'ExecuteWorkflow' },
      }
    );
    
    if (execRes.status === 200) {
      const execTime = new Date().getTime() - workflowStartTime;
      workflowExecutionTime.add(execTime);
    }
  }
  
  // Cleanup
  http.del(`${BASE_URL}/api/v1/teams/${teamId}`);
}