"""
Exception classes for the Agentic Flow SDK.
"""

from typing import Optional, List, Dict, Any


class AgenticFlowError(Exception):
    """Base exception for all Agentic Flow SDK errors."""
    pass


class APIError(AgenticFlowError):
    """API error with status code and error details."""
    
    def __init__(
        self,
        message: str,
        status_code: int,
        code: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details
    
    def __str__(self) -> str:
        parts = [f"{self.status_code}: {super().__str__()}"]
        if self.code:
            parts.append(f"[{self.code}]")
        return " ".join(parts)


class AuthenticationError(AgenticFlowError):
    """Authentication failed."""
    pass


class RateLimitError(AgenticFlowError):
    """Rate limit exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[str] = None):
        super().__init__(message)
        self.retry_after = int(retry_after) if retry_after else None


class ValidationError(AgenticFlowError):
    """Request validation failed."""
    
    def __init__(
        self,
        message: str,
        errors: Optional[Union[List[Dict[str, str]], Any]] = None,
    ):
        super().__init__(message)
        self.errors = errors


class NotFoundError(AgenticFlowError):
    """Resource not found."""
    
    def __init__(self, resource: str, resource_id: Optional[str] = None):
        if resource_id:
            message = f"{resource} with ID '{resource_id}' not found"
        else:
            message = f"{resource} not found"
        super().__init__(message)
        self.resource = resource
        self.resource_id = resource_id


class WebSocketError(AgenticFlowError):
    """WebSocket connection error."""
    pass


class TimeoutError(AgenticFlowError):
    """Request timed out."""
    pass