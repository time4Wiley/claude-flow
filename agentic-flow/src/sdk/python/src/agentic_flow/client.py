"""
Agentic Flow API Client

Provides both synchronous and asynchronous clients for the Agentic Flow API.
"""

import os
from typing import Optional, Dict, Any, Union
from datetime import datetime
import httpx
from httpx import Timeout

from .resources.agents import AgentsResource, AsyncAgentsResource
from .resources.workflows import WorkflowsResource, AsyncWorkflowsResource
from .resources.goals import GoalsResource, AsyncGoalsResource
from .resources.messages import MessagesResource, AsyncMessagesResource
from .resources.webhooks import WebhooksResource, AsyncWebhooksResource
from .resources.plugins import PluginsResource, AsyncPluginsResource
from .exceptions import (
    APIError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
)
from .websocket import WebSocketClient
from .version import __version__


class BaseClient:
    """Base client class with common functionality."""
    
    DEFAULT_BASE_URL = "https://api.agenticflow.dev/v1"
    DEFAULT_TIMEOUT = 30.0
    DEFAULT_MAX_RETRIES = 3
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        # Get API key from environment if not provided
        if not api_key and not access_token:
            api_key = os.environ.get("AGENTIC_FLOW_API_KEY")
            if not api_key:
                raise AuthenticationError(
                    "API key or access token is required. "
                    "Pass api_key parameter or set AGENTIC_FLOW_API_KEY environment variable."
                )
        
        self.api_key = api_key
        self.access_token = access_token
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout or self.DEFAULT_TIMEOUT
        self.max_retries = max_retries or self.DEFAULT_MAX_RETRIES
        
        # Build default headers
        self.headers = {
            "User-Agent": f"agentic-flow-python/{__version__}",
            "Content-Type": "application/json",
            **(headers or {}),
        }
        
        # Add authentication
        if api_key:
            self.headers["X-API-Key"] = api_key
        elif access_token:
            self.headers["Authorization"] = f"Bearer {access_token}"
    
    def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Handle API response and raise appropriate exceptions."""
        if response.status_code == 204:
            return {}
        
        try:
            data = response.json()
        except Exception:
            data = {"message": response.text}
        
        if response.status_code >= 200 and response.status_code < 300:
            return data
        
        # Handle errors
        error_message = data.get("message", "Unknown error")
        error_code = data.get("error", "unknown_error")
        details = data.get("details")
        
        if response.status_code == 401:
            raise AuthenticationError(error_message)
        elif response.status_code == 429:
            retry_after = response.headers.get("X-RateLimit-Reset")
            raise RateLimitError(error_message, retry_after=retry_after)
        elif response.status_code == 400:
            raise ValidationError(error_message, errors=details)
        else:
            raise APIError(
                error_message,
                status_code=response.status_code,
                code=error_code,
                details=details,
            )


class AgenticFlowClient(BaseClient):
    """
    Synchronous client for the Agentic Flow API.
    
    Example:
        >>> client = AgenticFlowClient(api_key="your-api-key")
        >>> agent = client.agents.create(name="My Agent", type="executor")
        >>> print(agent.id)
    """
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Create HTTP client
        self.http = httpx.Client(
            base_url=self.base_url,
            headers=self.headers,
            timeout=Timeout(self.timeout),
        )
        
        # Initialize resources
        self.agents = AgentsResource(self)
        self.workflows = WorkflowsResource(self)
        self.goals = GoalsResource(self)
        self.messages = MessagesResource(self)
        self.webhooks = WebhooksResource(self)
        self.plugins = PluginsResource(self)
    
    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make a synchronous HTTP request."""
        response = self.http.request(
            method=method,
            url=path,
            params=params,
            json=json,
            headers=headers,
            timeout=timeout or self.timeout,
        )
        return self._handle_response(response)
    
    def get_health(self) -> Dict[str, Any]:
        """Get API health status."""
        response = self.http.get("/health")
        return response.json()
    
    def close(self):
        """Close the HTTP client."""
        self.http.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class AsyncAgenticFlowClient(BaseClient):
    """
    Asynchronous client for the Agentic Flow API.
    
    Example:
        >>> async with AsyncAgenticFlowClient(api_key="your-api-key") as client:
        ...     agent = await client.agents.create(name="My Agent", type="executor")
        ...     print(agent.id)
    """
    
    def __init__(self, enable_websocket: bool = True, **kwargs):
        super().__init__(**kwargs)
        
        # Create async HTTP client
        self.http = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self.headers,
            timeout=Timeout(self.timeout),
        )
        
        # Initialize resources
        self.agents = AsyncAgentsResource(self)
        self.workflows = AsyncWorkflowsResource(self)
        self.goals = AsyncGoalsResource(self)
        self.messages = AsyncMessagesResource(self)
        self.webhooks = AsyncWebhooksResource(self)
        self.plugins = AsyncPluginsResource(self)
        
        # WebSocket client
        self.enable_websocket = enable_websocket
        self.websocket: Optional[WebSocketClient] = None
        if enable_websocket:
            ws_url = self.base_url.replace("http", "ws") + "/ws"
            self.websocket = WebSocketClient(
                url=ws_url,
                headers={"X-API-Key": self.api_key} if self.api_key else {},
            )
    
    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make an asynchronous HTTP request."""
        response = await self.http.request(
            method=method,
            url=path,
            params=params,
            json=json,
            headers=headers,
            timeout=timeout or self.timeout,
        )
        return self._handle_response(response)
    
    async def get_health(self) -> Dict[str, Any]:
        """Get API health status."""
        response = await self.http.get("/health")
        return response.json()
    
    async def connect_websocket(self):
        """Connect to WebSocket for real-time events."""
        if self.websocket:
            await self.websocket.connect()
    
    async def close(self):
        """Close the HTTP client and WebSocket connection."""
        await self.http.aclose()
        if self.websocket:
            await self.websocket.close()
    
    async def __aenter__(self):
        if self.websocket:
            await self.connect_websocket()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()