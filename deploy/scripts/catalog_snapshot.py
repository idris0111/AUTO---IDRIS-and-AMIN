"""Transfer public catalog data only; never copy customers or authentication data."""
import argparse
from datetime import date, datetime
from decimal import Decimal
import enum
import json
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
import app.models  # noqa: E402,F401
from app.database import Base, engine  # noqa: E402
from sqlalchemy import Date, DateTime, Enum, Numeric, Uuid, func, select  # noqa: E402
from sqlalchemy.types import TypeDecorator  # noqa: E402

PUBLIC_TABLES = {
    "brands", "categories", "shipping_zones", "vehicle_makes", "warehouses",
    "articles", "products", "vehicle_models", "oem_numbers",
    "product_cross_references", "product_images", "product_specifications",
    "vehicle_generations", "warehouse_stocks", "vehicle_modifications",
    "engines", "product_compatibilities",
}


def encode(value):
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (uuid.UUID, Decimal)):
        return str(value)
    raise TypeError(type(value).__name__)


def decode(column, value):
    if value is None:
        return None
    kind = column.type
    while isinstance(kind, TypeDecorator):
        kind = kind.impl
    if isinstance(kind, Enum) and kind.enum_class:
        return kind.enum_class(value)
    if isinstance(kind, DateTime):
        return datetime.fromisoformat(value)
    if isinstance(kind, Date):
        return date.fromisoformat(value)
    if isinstance(kind, Uuid):
        return uuid.UUID(value)
    if isinstance(kind, Numeric):
        return Decimal(str(value))
    return value


def export_catalog(destination, connection_engine=engine):
    payload = {"format": 1, "tables": {}}
    with connection_engine.connect() as connection:
        with connection.begin():
            if connection_engine.dialect.name == "sqlite":
                connection.exec_driver_sql("BEGIN")
            for table in Base.metadata.sorted_tables:
                if table.name not in PUBLIC_TABLES:
                    continue
                query = select(table)
                if table.name == "articles":
                    query = query.where(table.c.is_published.is_(True))
                rows = [dict(row) for row in connection.execute(query).mappings()]
                for row in rows:
                    if table.name == "articles":
                        row["author_id"] = None
                        row["views_count"] = 0
                    if table.name == "products":
                        row.update(rating_avg=Decimal("0"), rating_count=0, views_count=0)
                payload["tables"][table.name] = rows
    destination.write_text(json.dumps(payload, default=encode, ensure_ascii=False), encoding="utf-8")
    return {name: len(rows) for name, rows in payload["tables"].items()}


def import_catalog(source, connection_engine=engine):
    payload = json.loads(source.read_text(encoding="utf-8"))
    if payload.get("format") != 1 or set(payload["tables"]) != PUBLIC_TABLES:
        raise ValueError("Unexpected catalog format or tables")
    counts = {}
    with connection_engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name not in PUBLIC_TABLES:
                continue
            if connection.scalar(select(func.count()).select_from(table)):
                raise RuntimeError("Refusing to overwrite existing catalog table: " + table.name)
        for table in Base.metadata.sorted_tables:
            if table.name not in PUBLIC_TABLES:
                continue
            rows = payload["tables"][table.name]
            prepared = [{column.name: decode(column, row[column.name]) for column in table.columns}
                        for row in rows]
            if table.name == "categories":
                pending, prepared = prepared, []
                known = set()
                while pending:
                    ready = [row for row in pending if row["parent_id"] is None or row["parent_id"] in known]
                    if not ready:
                        raise ValueError("Category hierarchy is cyclic or incomplete")
                    for row in ready:
                        known.add(row["id"])
                        prepared.append(row)
                        pending.remove(row)
            for row in prepared:
                connection.execute(table.insert().values(**row))
            actual = connection.scalar(select(func.count()).select_from(table))
            if actual != len(rows):
                raise RuntimeError("Catalog row count mismatch: " + table.name)
            counts[table.name] = actual
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["export", "import"])
    parser.add_argument("file", type=Path)
    arguments = parser.parse_args()
    action = export_catalog if arguments.action == "export" else import_catalog
    print(json.dumps(action(arguments.file), ensure_ascii=False))
