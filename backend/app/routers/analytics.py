from typing import Annotated
from typing import Literal
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.database import get_db
from app.dependencies import require_permission
from app.models.user import User
from app.schemas.analytics import AnalyticsDashboardResponse
from app.services import analytics as analytics_service
from app.schemas.analytics_report import AnalyticsReport
from app.services.analytics_report import get_report

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics & BI"])


@router.get('/report', response_model=AnalyticsReport)
def analytics_report(
    start_date: date,
    end_date: date,
    grain: Literal['day', 'week', 'month'] = 'day',
    timezone: Literal['UTC', 'Asia/Dushanbe', 'Asia/Tashkent'] = 'Asia/Dushanbe',
    category_id: UUID | None = None,
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_STATISTICS))] = None,
    db: Session = Depends(get_db),
) -> AnalyticsReport:
    if start_date < date(1900, 1, 1) or end_date > date(2200, 12, 31):
        raise HTTPException(status_code=422, detail='Допустимые даты: 1900–2200 годы.')
    if not 0 <= (end_date - start_date).days < 366:
        raise HTTPException(status_code=422, detail='Период должен составлять от 1 до 366 дней.')
    return get_report(db, start_date, end_date, grain, timezone, category_id)


@router.get("/dashboard", response_model=AnalyticsDashboardResponse)
def get_analytics_dashboard(
    days: int = Query(default=7, ge=1, le=90),
    current_user: Annotated[User, Depends(require_permission(Permission.VIEW_STATISTICS))] = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
) -> AnalyticsDashboardResponse:
    """Return comprehensive e-commerce BI metrics and charts."""
    return analytics_service.get_analytics_dashboard(db, days=days)

