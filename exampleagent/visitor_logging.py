import uuid
from datetime import datetime
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
from models.visitor_log import VisitorLog


def log_visitor(db, log_data: VisitorLog):
    """Persists a visitor log entry to MongoDB."""
    try:
        # Prepare data for insertion, remove any explicit '_id' key
        data = log_data.model_dump(by_alias=True)
        data.pop("_id", None)
        db.visitor_logs.insert_one(data)
    except Exception as e:
        # Just log the error but continue - don't disrupt user experience for analytics
        print(f"Error logging visitor: {e}")

class VisitorLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = datetime.utcnow()
        session_id = request.cookies.get("visitor_session_id")
        new_session = False
        if not session_id:
            session_id = str(uuid.uuid4())
            new_session = True

        # Avoid logging requests to static files or specific paths if desired
        path = request.url.path
        if path.startswith("/static") or path.startswith("/docs") or path.startswith("/openapi.json") or path.startswith("/admin/analytics"): # Avoid logging analytics requests
             response = await call_next(request)
             return response

        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Only log visitor on the first request in a new session
        if new_session:
            log_entry = VisitorLog(
                ip_address=ip_address,
                session_id=session_id,
                user_agent=user_agent,
                timestamp=start_time
            )
            db = request.app.state.db
            # Synchronously log the visitor, excluding None id
            log_visitor(db, log_entry)

        response = await call_next(request)

        if new_session:
            response.set_cookie(
                key="visitor_session_id",
                value=session_id,
                max_age=365 * 24 * 60 * 60,  # 1 year
                httponly=True,
                samesite="lax", # Or 'strict' or 'none' depending on needs
                # secure=True, # Enable in production with HTTPS
            )

        return response 