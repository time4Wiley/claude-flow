"""Agent resource for managing agents."""

import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

from .base import BaseResource, AsyncBaseResource
from ..types import (
    Agent,
    AgentType,
    AgentStatus,
    CreateAgentRequest,
    UpdateAgentRequest,
    PaginationParams,
    PaginatedResponse,
)
from ..exceptions import TimeoutError


class AgentsResource(BaseResource):
    """Synchronous resource for managing agents."""
    
    def create(
        self,
        name: str,
        type: AgentType,
        capabilities: Optional[List[str]] = None,
        configuration: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Agent:
        """
        Create a new agent.
        
        Args:
            name: Name of the agent
            type: Type of agent (coordinator, executor, specialized)
            capabilities: List of agent capabilities
            configuration: Agent configuration options
            **kwargs: Additional request options
        
        Returns:
            The created agent
        
        Example:
            >>> agent = client.agents.create(
            ...     name="Data Processor",
            ...     type=AgentType.EXECUTOR,
            ...     capabilities=["data-processing", "analysis"]
            ... )
        """
        request = CreateAgentRequest(
            name=name,
            type=type,
            capabilities=capabilities,
            configuration=configuration,
        )
        
        data = self._request(
            "POST",
            "/agents",
            json=request.model_dump(exclude_none=True),
            **kwargs
        )
        return Agent.model_validate(data)
    
    def get(self, agent_id: str, **kwargs) -> Agent:
        """
        Get an agent by ID.
        
        Args:
            agent_id: The agent ID
            **kwargs: Additional request options
        
        Returns:
            The agent
        
        Example:
            >>> agent = client.agents.get("agent-123")
        """
        data = self._request("GET", f"/agents/{agent_id}", **kwargs)
        return Agent.model_validate(data)
    
    def list(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        status: Optional[AgentStatus] = None,
        type: Optional[AgentType] = None,
        **kwargs
    ) -> PaginatedResponse:
        """
        List agents with optional filtering.
        
        Args:
            limit: Maximum number of agents to return
            offset: Number of agents to skip
            status: Filter by agent status
            type: Filter by agent type
            **kwargs: Additional request options
        
        Returns:
            Paginated list of agents
        
        Example:
            >>> agents = client.agents.list(
            ...     limit=10,
            ...     status=AgentStatus.ACTIVE,
            ...     type=AgentType.EXECUTOR
            ... )
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        if status:
            params["status"] = status.value
        if type:
            params["type"] = type.value
        
        data = self._request("GET", "/agents", params=params, **kwargs)
        
        # Convert agents to models
        agents = [Agent.model_validate(agent) for agent in data["agents"]]
        
        return PaginatedResponse(
            items=agents,
            total_count=data["totalCount"],
            next_offset=data.get("nextOffset"),
        )
    
    def update(
        self,
        agent_id: str,
        name: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
        configuration: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Agent:
        """
        Update an agent's configuration.
        
        Args:
            agent_id: The agent ID
            name: New name for the agent
            capabilities: Updated capabilities list
            configuration: Updated configuration
            **kwargs: Additional request options
        
        Returns:
            The updated agent
        
        Example:
            >>> agent = client.agents.update(
            ...     "agent-123",
            ...     name="Updated Agent",
            ...     capabilities=["new-capability"]
            ... )
        """
        request = UpdateAgentRequest(
            name=name,
            capabilities=capabilities,
            configuration=configuration,
        )
        
        data = self._request(
            "PATCH",
            f"/agents/{agent_id}",
            json=request.model_dump(exclude_none=True),
            **kwargs
        )
        return Agent.model_validate(data)
    
    def delete(self, agent_id: str, **kwargs) -> None:
        """
        Delete an agent.
        
        Args:
            agent_id: The agent ID
            **kwargs: Additional request options
        
        Example:
            >>> client.agents.delete("agent-123")
        """
        self._request("DELETE", f"/agents/{agent_id}", **kwargs)
    
    def start(self, agent_id: str, **kwargs) -> Agent:
        """
        Start an agent.
        
        Args:
            agent_id: The agent ID
            **kwargs: Additional request options
        
        Returns:
            The started agent
        
        Example:
            >>> agent = client.agents.start("agent-123")
        """
        data = self._request("POST", f"/agents/{agent_id}/start", **kwargs)
        return Agent.model_validate(data)
    
    def stop(self, agent_id: str, **kwargs) -> Agent:
        """
        Stop an agent.
        
        Args:
            agent_id: The agent ID
            **kwargs: Additional request options
        
        Returns:
            The stopped agent
        
        Example:
            >>> agent = client.agents.stop("agent-123")
        """
        data = self._request("POST", f"/agents/{agent_id}/stop", **kwargs)
        return Agent.model_validate(data)
    
    def get_metrics(self, agent_id: str, **kwargs) -> Dict[str, Any]:
        """
        Get agent metrics.
        
        Args:
            agent_id: The agent ID
            **kwargs: Additional request options
        
        Returns:
            Agent metrics data
        
        Example:
            >>> metrics = client.agents.get_metrics("agent-123")
        """
        return self._request("GET", f"/agents/{agent_id}/metrics", **kwargs)
    
    def get_logs(
        self,
        agent_id: str,
        limit: Optional[int] = None,
        since: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get agent logs.
        
        Args:
            agent_id: The agent ID
            limit: Maximum number of log entries
            since: Get logs since this timestamp
            **kwargs: Additional request options
        
        Returns:
            Agent logs
        
        Example:
            >>> logs = client.agents.get_logs(
            ...     "agent-123",
            ...     limit=100,
            ...     since="2024-01-01T00:00:00Z"
            ... )
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if since:
            params["since"] = since
        
        return self._request(
            "GET",
            f"/agents/{agent_id}/logs",
            params=params,
            **kwargs
        )
    
    def wait_for_status(
        self,
        agent_id: str,
        status: AgentStatus,
        timeout: float = 30.0,
        poll_interval: float = 1.0,
    ) -> Agent:
        """
        Wait for an agent to reach a specific status.
        
        Args:
            agent_id: The agent ID
            status: The desired status
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks in seconds
        
        Returns:
            The agent when it reaches the desired status
        
        Raises:
            TimeoutError: If the agent doesn't reach the status within timeout
        
        Example:
            >>> agent = client.agents.wait_for_status(
            ...     "agent-123",
            ...     AgentStatus.ACTIVE,
            ...     timeout=30.0
            ... )
        """
        import time
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            agent = self.get(agent_id)
            if agent.status == status:
                return agent
            time.sleep(poll_interval)
        
        raise TimeoutError(
            f"Timeout waiting for agent {agent_id} to reach status {status.value}"
        )


class AsyncAgentsResource(AsyncBaseResource):
    """Asynchronous resource for managing agents."""
    
    async def create(
        self,
        name: str,
        type: AgentType,
        capabilities: Optional[List[str]] = None,
        configuration: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Agent:
        """Create a new agent (async)."""
        request = CreateAgentRequest(
            name=name,
            type=type,
            capabilities=capabilities,
            configuration=configuration,
        )
        
        data = await self._request(
            "POST",
            "/agents",
            json=request.model_dump(exclude_none=True),
            **kwargs
        )
        return Agent.model_validate(data)
    
    async def get(self, agent_id: str, **kwargs) -> Agent:
        """Get an agent by ID (async)."""
        data = await self._request("GET", f"/agents/{agent_id}", **kwargs)
        return Agent.model_validate(data)
    
    async def list(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        status: Optional[AgentStatus] = None,
        type: Optional[AgentType] = None,
        **kwargs
    ) -> PaginatedResponse:
        """List agents with optional filtering (async)."""
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        if status:
            params["status"] = status.value
        if type:
            params["type"] = type.value
        
        data = await self._request("GET", "/agents", params=params, **kwargs)
        
        # Convert agents to models
        agents = [Agent.model_validate(agent) for agent in data["agents"]]
        
        return PaginatedResponse(
            items=agents,
            total_count=data["totalCount"],
            next_offset=data.get("nextOffset"),
        )
    
    async def update(
        self,
        agent_id: str,
        name: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
        configuration: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Agent:
        """Update an agent's configuration (async)."""
        request = UpdateAgentRequest(
            name=name,
            capabilities=capabilities,
            configuration=configuration,
        )
        
        data = await self._request(
            "PATCH",
            f"/agents/{agent_id}",
            json=request.model_dump(exclude_none=True),
            **kwargs
        )
        return Agent.model_validate(data)
    
    async def delete(self, agent_id: str, **kwargs) -> None:
        """Delete an agent (async)."""
        await self._request("DELETE", f"/agents/{agent_id}", **kwargs)
    
    async def start(self, agent_id: str, **kwargs) -> Agent:
        """Start an agent (async)."""
        data = await self._request("POST", f"/agents/{agent_id}/start", **kwargs)
        return Agent.model_validate(data)
    
    async def stop(self, agent_id: str, **kwargs) -> Agent:
        """Stop an agent (async)."""
        data = await self._request("POST", f"/agents/{agent_id}/stop", **kwargs)
        return Agent.model_validate(data)
    
    async def get_metrics(self, agent_id: str, **kwargs) -> Dict[str, Any]:
        """Get agent metrics (async)."""
        return await self._request("GET", f"/agents/{agent_id}/metrics", **kwargs)
    
    async def get_logs(
        self,
        agent_id: str,
        limit: Optional[int] = None,
        since: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get agent logs (async)."""
        params = {}
        if limit is not None:
            params["limit"] = limit
        if since:
            params["since"] = since
        
        return await self._request(
            "GET",
            f"/agents/{agent_id}/logs",
            params=params,
            **kwargs
        )
    
    async def wait_for_status(
        self,
        agent_id: str,
        status: AgentStatus,
        timeout: float = 30.0,
        poll_interval: float = 1.0,
    ) -> Agent:
        """Wait for an agent to reach a specific status (async)."""
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            agent = await self.get(agent_id)
            if agent.status == status:
                return agent
            await asyncio.sleep(poll_interval)
        
        raise TimeoutError(
            f"Timeout waiting for agent {agent_id} to reach status {status.value}"
        )