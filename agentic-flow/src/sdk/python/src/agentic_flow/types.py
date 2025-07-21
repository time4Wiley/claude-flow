"""
Type definitions for the Agentic Flow SDK.

Uses Pydantic for data validation and serialization.
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


# Enums
class AgentType(str, Enum):
    """Agent type enumeration."""
    COORDINATOR = "coordinator"
    EXECUTOR = "executor"
    SPECIALIZED = "specialized"


class AgentStatus(str, Enum):
    """Agent status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    INITIALIZING = "initializing"
    ERROR = "error"


class WorkflowStatus(str, Enum):
    """Workflow status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowStepType(str, Enum):
    """Workflow step type enumeration."""
    AGENT = "agent"
    CONDITION = "condition"
    PARALLEL = "parallel"
    SEQUENTIAL = "sequential"


class Priority(str, Enum):
    """Priority level enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GoalStatus(str, Enum):
    """Goal status enumeration."""
    PENDING = "pending"
    ANALYZING = "analyzing"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class MessageType(str, Enum):
    """Message type enumeration."""
    TASK = "task"
    RESULT = "result"
    QUERY = "query"
    RESPONSE = "response"
    EVENT = "event"


# Models
class AgentMetrics(BaseModel):
    """Agent performance metrics."""
    tasks_completed: int = Field(alias="tasksCompleted")
    success_rate: float = Field(alias="successRate")
    average_response_time: float = Field(alias="averageResponseTime")
    last_activity: Optional[datetime] = Field(alias="lastActivity", default=None)
    
    model_config = ConfigDict(populate_by_name=True)


class Agent(BaseModel):
    """Agent model."""
    id: str
    name: str
    type: AgentType
    status: AgentStatus
    capabilities: List[str] = []
    configuration: Optional[Dict[str, Any]] = None
    metrics: AgentMetrics
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    
    model_config = ConfigDict(populate_by_name=True)


class WorkflowStep(BaseModel):
    """Workflow step model."""
    name: str
    type: WorkflowStepType
    action: str
    parameters: Optional[Dict[str, Any]] = None
    dependencies: Optional[List[str]] = None
    
    model_config = ConfigDict(populate_by_name=True)


class Workflow(BaseModel):
    """Workflow model."""
    id: str
    name: str
    description: Optional[str] = None
    status: WorkflowStatus
    steps: List[WorkflowStep]
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    
    model_config = ConfigDict(populate_by_name=True)


class WorkflowExecution(BaseModel):
    """Workflow execution model."""
    id: str
    workflow_id: str = Field(alias="workflowId")
    status: str
    started_at: datetime = Field(alias="startedAt")
    completed_at: Optional[datetime] = Field(alias="completedAt", default=None)
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    
    model_config = ConfigDict(populate_by_name=True)


class Entity(BaseModel):
    """Parsed entity from goal description."""
    type: str
    value: str


class ParsedIntent(BaseModel):
    """Parsed intent from goal description."""
    action: str
    entities: List[Entity]
    constraints: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(populate_by_name=True)


class Subtask(BaseModel):
    """Goal subtask model."""
    id: str
    description: str
    status: str
    assigned_agent: Optional[str] = Field(alias="assignedAgent", default=None)
    
    model_config = ConfigDict(populate_by_name=True)


class Goal(BaseModel):
    """Goal model."""
    id: str
    description: str
    priority: Priority
    status: GoalStatus
    parsed_intent: ParsedIntent = Field(alias="parsedIntent")
    subtasks: List[Subtask] = []
    created_at: datetime = Field(alias="createdAt")
    updated_at: Optional[datetime] = Field(alias="updatedAt", default=None)
    completed_at: Optional[datetime] = Field(alias="completedAt", default=None)
    
    model_config = ConfigDict(populate_by_name=True)


class Message(BaseModel):
    """Message model."""
    id: str
    from_agent: str = Field(alias="from")
    to_agent: str = Field(alias="to")
    type: MessageType
    content: Dict[str, Any]
    priority: Priority
    timestamp: datetime
    delivered_at: Optional[datetime] = Field(alias="deliveredAt", default=None)
    read_at: Optional[datetime] = Field(alias="readAt", default=None)
    
    model_config = ConfigDict(populate_by_name=True)


class WebhookStats(BaseModel):
    """Webhook delivery statistics."""
    total_deliveries: int = Field(alias="totalDeliveries")
    successful_deliveries: int = Field(alias="successfulDeliveries")
    failed_deliveries: int = Field(alias="failedDeliveries")
    average_response_time: float = Field(alias="averageResponseTime")
    
    model_config = ConfigDict(populate_by_name=True)


class Webhook(BaseModel):
    """Webhook model."""
    id: str
    url: str
    events: List[str]
    active: bool
    secret: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    last_triggered: Optional[datetime] = Field(alias="lastTriggered", default=None)
    delivery_stats: WebhookStats = Field(alias="deliveryStats")
    
    model_config = ConfigDict(populate_by_name=True)


class WebhookDelivery(BaseModel):
    """Webhook delivery record."""
    id: str
    webhook_id: str = Field(alias="webhookId")
    event: Dict[str, Any]
    success: bool
    status_code: Optional[int] = Field(alias="statusCode", default=None)
    duration: float
    timestamp: datetime
    response: Optional[Any] = None
    error: Optional[str] = None
    
    model_config = ConfigDict(populate_by_name=True)


class Plugin(BaseModel):
    """Plugin model."""
    id: str
    name: str
    version: str
    description: Optional[str] = None
    enabled: bool
    configuration: Optional[Dict[str, Any]] = None
    capabilities: List[str] = []
    
    model_config = ConfigDict(populate_by_name=True)


# Request/Response models
class CreateAgentRequest(BaseModel):
    """Request model for creating an agent."""
    name: str
    type: AgentType
    capabilities: Optional[List[str]] = None
    configuration: Optional[Dict[str, Any]] = None


class UpdateAgentRequest(BaseModel):
    """Request model for updating an agent."""
    name: Optional[str] = None
    capabilities: Optional[List[str]] = None
    configuration: Optional[Dict[str, Any]] = None


class CreateWorkflowRequest(BaseModel):
    """Request model for creating a workflow."""
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStep]


class CreateGoalRequest(BaseModel):
    """Request model for creating a goal."""
    description: str
    priority: Optional[Priority] = Priority.MEDIUM
    constraints: Optional[Dict[str, Any]] = None


class SendMessageRequest(BaseModel):
    """Request model for sending a message."""
    from_agent: str = Field(alias="from")
    to_agent: str = Field(alias="to")
    type: MessageType
    content: Dict[str, Any]
    priority: Optional[Priority] = Priority.MEDIUM
    
    model_config = ConfigDict(populate_by_name=True)


class CreateWebhookRequest(BaseModel):
    """Request model for creating a webhook."""
    url: str
    events: List[str]
    secret: Optional[str] = None


class InstallPluginRequest(BaseModel):
    """Request model for installing a plugin."""
    source: str
    configuration: Optional[Dict[str, Any]] = None


# Pagination models
class PaginationParams(BaseModel):
    """Pagination parameters."""
    limit: Optional[int] = Field(default=20, ge=1, le=100)
    offset: Optional[int] = Field(default=0, ge=0)


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[Any]
    total_count: int = Field(alias="totalCount")
    next_offset: Optional[int] = Field(alias="nextOffset", default=None)
    
    model_config = ConfigDict(populate_by_name=True)