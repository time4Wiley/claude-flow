"""Base resource class for API resources."""

from typing import TYPE_CHECKING, Optional, Dict, Any, TypeVar, Generic

if TYPE_CHECKING:
    from ..client import AgenticFlowClient, AsyncAgenticFlowClient

T = TypeVar("T")


class BaseResource:
    """Base class for synchronous API resources."""
    
    def __init__(self, client: "AgenticFlowClient"):
        self._client = client
    
    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make an HTTP request through the client."""
        return self._client.request(
            method=method,
            path=path,
            params=params,
            json=json,
            headers=headers,
            timeout=timeout,
        )


class AsyncBaseResource:
    """Base class for asynchronous API resources."""
    
    def __init__(self, client: "AsyncAgenticFlowClient"):
        self._client = client
    
    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Make an async HTTP request through the client."""
        return await self._client.request(
            method=method,
            path=path,
            params=params,
            json=json,
            headers=headers,
            timeout=timeout,
        )