from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DISHES_FILE = DATA_DIR / "dishes.json"
ORDERS_FILE = DATA_DIR / "orders.json"


class FamilyMenuHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == "/api/dishes":
            self.send_json(read_dishes())
            return
        if urlparse(self.path).path == "/api/orders":
            self.send_json(read_orders())
            return

        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/orders":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length) or b"{}")
                order = sanitize_order(payload)
            except (ValueError, json.JSONDecodeError):
                self.send_error(400, "Invalid order payload")
                return

            orders = read_orders()
            orders.append(order)
            write_orders(orders)
            self.send_json(order, status=201)
            return

        if path != "/api/dishes":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            dish = sanitize_dish(payload)
        except (ValueError, json.JSONDecodeError):
            self.send_error(400, "Invalid dish payload")
            return

        dishes = read_dishes()
        dishes.append(dish)
        write_dishes(dishes)
        self.send_json(dish, status=201)

    def do_PUT(self):
        if urlparse(self.path).path != "/api/dishes":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"[]")
            dishes = [sanitize_dish(item) for item in payload]
        except (TypeError, ValueError, json.JSONDecodeError):
            self.send_error(400, "Invalid dishes payload")
            return

        write_dishes(dishes)
        self.send_json(dishes)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def read_dishes():
    if not DISHES_FILE.exists():
        return []

    try:
        return json.loads(DISHES_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_dishes(dishes):
    DATA_DIR.mkdir(exist_ok=True)
    DISHES_FILE.write_text(json.dumps(dishes, ensure_ascii=False, indent=2), encoding="utf-8")


def read_orders():
    if not ORDERS_FILE.exists():
        return []

    try:
        return json.loads(ORDERS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_orders(orders):
    DATA_DIR.mkdir(exist_ok=True)
    ORDERS_FILE.write_text(json.dumps(orders, ensure_ascii=False, indent=2), encoding="utf-8")


def sanitize_dish(payload):
    name = str(payload.get("name", "")).strip()[:16]
    if not name:
        raise ValueError("name is required")

    category = str(payload.get("category", "煮食")).strip()
    if category == "煮食":
        category = "主食"

    if category not in {"主食", "汤羹", "特色菜"}:
        category = "主食"

    return {
        "id": str(payload.get("id", ""))[:48] or f"custom-{len(read_dishes()) + 1}",
        "name": name,
        "category": category,
        "desc": str(payload.get("desc", "")).strip()[:48],
        "image": str(payload.get("image", "")),
    }


def sanitize_order(payload):
    items = payload.get("items", [])
    if not isinstance(items, list) or not items:
        raise ValueError("items are required")

    return {
        "id": str(payload.get("id", ""))[:32],
        "pickupCode": str(payload.get("pickupCode", ""))[:8],
        "createdAt": str(payload.get("createdAt", ""))[:32],
        "createdLabel": str(payload.get("createdLabel", ""))[:32],
        "totalCount": int(payload.get("totalCount", 0)),
        "items": [
            {
                "id": str(item.get("id", ""))[:48],
                "name": str(item.get("name", ""))[:24],
                "category": str(item.get("category", ""))[:12],
                "quantity": int(item.get("quantity", 0)),
                "image": str(item.get("image", "")),
            }
            for item in items
            if int(item.get("quantity", 0)) > 0
        ],
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), FamilyMenuHandler)
    print(f"Serving family menu on http://0.0.0.0:{port}/")
    server.serve_forever()
