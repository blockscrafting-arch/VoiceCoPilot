"""Suggestions API endpoints."""

from fastapi import APIRouter, Header, HTTPException

from ..logging_config import get_logger
from ..models.schemas import SuggestionRequest, SuggestionResponse
from ..services.project_manager import get_project
from ..services.llm_provider import LLMProvider

router = APIRouter()
logger = get_logger(__name__)

# Shared LLM provider instance
llm_provider = LLMProvider()


@router.post("/generate", response_model=SuggestionResponse)
async def generate_suggestions(
    request: SuggestionRequest,
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> SuggestionResponse:
    """Generate conversation suggestions based on context.

    Args:
        request: Request containing conversation history and context.

    Returns:
        Generated suggestions for what to say next.

    Raises:
        HTTPException: If LLM request fails.
    """
    try:
        model_override = None
        if request.project_id and x_project_token:
            project = get_project(request.project_id, token=x_project_token)
            if project:
                model_override = project.llm_model

        suggestions = await llm_provider.generate_suggestions(
            history=request.history,
            context=request.context,
            model_override=model_override,
        )
        return SuggestionResponse(suggestions=suggestions)
    except Exception as e:
        logger.exception("Failed to generate suggestions", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate suggestions")
