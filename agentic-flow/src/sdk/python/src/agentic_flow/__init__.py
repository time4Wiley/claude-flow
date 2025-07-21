"""
Agentic Flow Python SDK

Official Python SDK for interacting with the Agentic Flow API.

Example:
    >>> from agentic_flow import AgenticFlowClient
    >>> 
    >>> client = AgenticFlowClient(api_key="your-api-key")
    >>> 
    >>> # Create an agent
    >>> agent = await client.agents.create(
    ...     name="Data Processor",
    ...     type="executor",
    ...     capabilities=["data-processing", "analysis"]
    ... )
    >>> 
    >>> # Start the agent
    >>> await client.agents.start(agent.id)
"""

from .client import AgenticFlowClient, AsyncAgenticFlowClient
from .exceptions import (
    AgenticFlowError,
    APIError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    NotFoundError,
    WebSocketError,
    TimeoutError,
)
from .types import (
    Agent,
    AgentType,
    AgentStatus,
    Workflow,
    WorkflowStatus,
    Goal,
    GoalStatus,
    Message,
    MessageType,
    Webhook,
    Plugin,
    Priority,
)
from .version import __version__

__all__ = [
    # Clients
    "AgenticFlowClient",
    "AsyncAgenticFlowClient",
    # Exceptions
    "AgenticFlowError",
    "APIError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
    "NotFoundError",
    "WebSocketError",
    "TimeoutError",
    # Types
    "Agent",
    "AgentType",
    "AgentStatus",
    "Workflow",
    "WorkflowStatus",
    "Goal",
    "GoalStatus",
    "Message",
    "MessageType",
    "Webhook",
    "Plugin",
    "Priority",
    # Version
    "__version__",
]