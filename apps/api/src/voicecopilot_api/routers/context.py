"""Context import endpoints."""

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from ..models.schemas import Project
from ..services.file_parser import parse_file
from ..services.project_manager import add_context_file, get_project, update_project

router = APIRouter()


@router.post("/{project_id}/context/files", response_model=Project)
async def upload_context_file(
    project_id: str,
    file: UploadFile = File(...),
    mode: str = Form("append"),
    x_project_token: str | None = Header(default=None, alias="X-Project-Token"),
) -> Project:
    """Upload and parse a context file."""
    if not x_project_token:
        raise HTTPException(status_code=401, detail="Missing project token")
    project = get_project(project_id, token=x_project_token)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    try:
        extracted = parse_file(file.filename or "file", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated_text = project.context_text
    if mode == "replace":
        updated_text = extracted
    else:
        separator = "\n\n" if updated_text else ""
        updated_text = f"{updated_text}{separator}{extracted}"

    add_context_file(project_id, x_project_token, file.filename or "file", content)
    updated_project = update_project(
        project_id,
        x_project_token,
        context_text=updated_text,
    )
    if not updated_project:
        raise HTTPException(status_code=500, detail="Failed to update project")

    return Project(**updated_project.to_dict())
