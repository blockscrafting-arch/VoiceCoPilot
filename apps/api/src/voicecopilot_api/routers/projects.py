"""Projects API endpoints."""

from fastapi import APIRouter, Header, HTTPException

from ..models.schemas import (
    Project,
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectUpdateRequest,
)
from ..services.project_manager import (
    create_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter()


def _get_token(x_project_token: str | None) -> str:
    if not x_project_token:
        raise HTTPException(status_code=401, detail="Missing project token")
    return x_project_token


@router.get("/", response_model=ProjectListResponse)
def list_projects_endpoint(
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> ProjectListResponse:
    """List all projects."""
    token = _get_token(x_project_token)
    projects = [Project(**project.to_dict()) for project in list_projects(token)]
    return ProjectListResponse(projects=projects)


@router.post("/", response_model=Project)
def create_project_endpoint(
    payload: ProjectCreateRequest,
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> Project:
    """Create a new project."""
    project = create_project(payload.name, token=x_project_token)
    return Project(**project.to_dict(include_token=True))


@router.get("/{project_id}", response_model=Project)
def get_project_endpoint(
    project_id: str,
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> Project:
    """Get a project by id."""
    token = _get_token(x_project_token)
    project = get_project(project_id, token=token)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project.to_dict())


@router.patch("/{project_id}", response_model=Project)
def update_project_endpoint(
    project_id: str,
    payload: ProjectUpdateRequest,
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> Project:
    """Update project metadata."""
    token = _get_token(x_project_token)
    project = update_project(
        project_id,
        token,
        name=payload.name,
        context_text=payload.context_text,
        llm_model=payload.llm_model,
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project.to_dict())
