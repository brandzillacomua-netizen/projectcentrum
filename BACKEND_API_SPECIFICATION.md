# CENTRUM MES: Backend API Specification (v1.1)

This document provides a comprehensive technical specification for the REST API of the CENTRUM Manufacturing Execution System. It is intended for the backend development team to implement a consistent and robust JSON-based interface.

## 1. Core Principles
- **Base URL**: `/api/v1`
- **Format**: All requests and responses MUST be in `application/json`.
- **Authentication**: JWT-based. Header: `Authorization: Bearer <token>`.
- **Naming Convention**: `snake_case` for all JSON keys.
- **Date Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`).

---

## 2. Authentication & Users

### 2.1 Login
`POST /auth/login`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "secure_password"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbG...",
    "user": {
      "id": "uuid",
      "full_name": "John Doe",
      "roles": ["admin", "foreman"]
    }
  }
  ```

### 2.2 Current User Profile
`GET /auth/me`
- **Response (200 OK)**: User object with permissions and department info.

---

## 3. Nomenclature & BOM

### 3.1 Get Nomenclature List
`GET /nomenclature?type=material&q=search_term`
- **Returns**: Array of nomenclature items (Base info + current stock).

### 3.2 Upsert Nomenclature
`POST /nomenclature`
- **Request Body**:
  ```json
  {
    "id": "uuid", // Optional for update
    "name": "Side Panel A4",
    "type": "part",
    "material_type": "Steel 2mm",
    "cnc_program": "P123_LASER_CUT",
    "units_per_sheet": 12,
    "time_per_unit": 45,
    "consumption_per_sheet": 1.0
  }
  ```

### 3.3 Manage BOM (Bill of Materials)
`POST /nomenclature/:id/bom`
- **Request Body**:
  ```json
  {
    "bom_items": [
      { "child_id": "uuid", "quantity_per_parent": 2 },
      { "child_id": "uuid", "quantity_per_parent": 1 }
    ]
  }
  ```

---

## 4. Orders & Production Tasks (Naryads)

### 4.1 Create Customer Order
`POST /orders`
- **Request Body**:
  ```json
  {
    "order_num": "ORD-2024-001",
    "customer": "Client Name",
    "deadline": "2024-06-01",
    "items": [
      { "nomenclature_id": "uuid", "quantity": 100 }
    ]
  }
  ```

### 4.2 Create Production Task (Naryad)
`POST /production/tasks`
- **Request Body**:
  ```json
  {
    "order_id": "uuid",
    "machine_name": "Laser 1"
  }
  ```
- **Note**: This initializes the manufacturing process for an order.

### 4.3 Task Approvals (Workflow)
Tasks require multi-level approval before they can be released to the shop floor.
- `PATCH /production/tasks/:id/approve-engineer`: Technical validation.
- `PATCH /production/tasks/:id/approve-warehouse`: Material availability validation.
- `PATCH /production/tasks/:id/approve-director`: Final priority approval.

---

## 5. Work Cards (Shop Floor Execution)

### 5.1 Generate Work Cards (Batch)
`POST /production/work-cards/batch`
- **Request Body**:
  ```json
  {
    "task_id": "uuid",
    "order_id": "uuid",
    "nomenclature_id": "uuid",
    "action": "CREATE_WORK_CARDS_BATCH",
    "cards": [
      {
        "operation": "Cutting",
        "machine": "Laser 1",
        "estimated_time": 300,
        "quantity": 10,
        "buffer_qty": 0,
        "card_info": "1/5"
      }
    ]
  }
  ```

### 5.2 Operator: Start Operation
`PATCH /production/work-cards/:id/start`
- **Request Body**:
  ```json
  {
    "operator_name": "Ivanov I.",
    "machine_id": "uuid",
    "machine_name": "Laser 1",
    "stage_name": "Cutting",
    "manager_name": "Petrov P.",
    "shift_name": "Shift 1"
  }
  ```

### 5.3 Operator/Master: Complete & Send to Buffer
`POST /production/work-cards/:id/complete`
- **Request Body**:
  ```json
  {
    "scrap_data": {
      "nomenclature_uuid": 2
    },
    "cutters_used": 1 // Optional, specific to cutting stage
  }
  ```
- **Backend Action**: 
  1. Move card to `at-buffer` status.
  2. Record scrap/defects.
  3. Deduct materials from inventory (if applicable).
  4. Update Buffer Zone balances.

---

## 6. Warehouse & Inventory

### 6.1 Reserve Resources for Task
`POST /warehouse/reserve`
- **Request Body**:
  ```json
  {
    "order_id": "uuid",
    "task_id": "uuid",
    "action": "RESERVE_RESOURCES",
    "items": [
      { "request_id": "uuid", "inventory_id": "uuid", "quantity": 50 }
    ]
  }
  ```

### 6.2 Purchase Request
`POST /warehouse/purchase-requests`
- **Request Body**:
  ```json
  {
    "order_id": "uuid",
    "order_num": "ORD-123",
    "request_items": [
      {
        "inventory_id": "uuid",
        "needed_amount": 10,
        "missing_amount": 5
      }
    ]
  }
  ```

---

## 7. Machine Monitoring

### 7.1 Upsert Machine
`POST /machines`
- **Request Body**:
  ```json
  {
    "name": "Laser CNC-01",
    "type": "Laser",
    "sheet_capacity": 5,
    "status": "active"
  }
  ```

### 7.2 Get Real-time Status
`GET /machines/status`
- **Returns**: List of machines with current task, operator, and uptime.

---

## 8. Data Dictionary (Key Enums)

| Field | Possible Values |
|-------|-----------------|
| `task_status` | `pending`, `in-progress`, `completed`, `cancelled` |
| `card_status` | `new`, `in-progress`, `at-buffer`, `completed` |
| `order_status`| `draft`, `active`, `shipped`, `closed` |
| `stage_name`  | `Розкрій`, `Пресування`, `Галтовка`, `Фарбування`, `Збирання` |

---

## 9. Error Codes
- `400 Bad Request`: Validation failed.
- `401 Unauthorized`: Missing or invalid token.
- `403 Forbidden`: Insufficient permissions for action.
- `404 Not Found`: Entity not found.
- `409 Conflict`: Business logic violation (e.g., starting a task that is already in progress).
