from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Password Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

# --- Models ---
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class ToggleTaskInput(BaseModel):
    task_id: str
    date: str  # YYYY-MM-DD

# --- Auth Endpoints ---
@api_router.post("/auth/register")
async def register(inp: RegisterInput, response: Response):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(inp.password)
    doc = {"email": email, "password_hash": hashed, "name": inp.name.strip(), "role": "user", "created_at": datetime.now(timezone.utc)}
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)
    at = create_access_token(user_id, email)
    rt = create_refresh_token(user_id)
    set_auth_cookies(response, at, rt)
    return {"id": user_id, "email": email, "name": inp.name.strip(), "role": "user", "access_token": at}

@api_router.post("/auth/login")
async def login(inp: LoginInput, request: Request, response: Response):
    email = inp.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # brute force check
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        locked_until = attempts.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        # increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # clear attempts on success
    await db.login_attempts.delete_many({"identifier": identifier})
    user_id = str(user["_id"])
    at = create_access_token(user_id, email)
    rt = create_refresh_token(user_id)
    set_auth_cookies(response, at, rt)
    return {"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "user"), "access_token": at}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    # Remove _id from response
    user_response = {k: v for k, v in user.items() if k != "_id"}
    return user_response

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        at = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=at, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed", "access_token": at}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# --- Schedule Data (Static from Excel) ---
def get_day_schedule(day_name: str):
    """Return the full daily schedule based on the day of the week."""
    is_sunday = day_name == "Sunday"
    is_thursday = day_name == "Thursday"
    is_friday = day_name == "Friday"
    is_saturday = day_name == "Saturday"
    is_weekend = is_friday or is_saturday or is_sunday

    # Determine shampoo day (alternate days, not sunday)
    from datetime import date
    today = date.today()
    is_shampoo_day = (today.timetuple().tm_yday % 2 == 0) and not is_sunday

    schedule = []

    # 1. Wake Up Block - 5:30 AM
    schedule.append({"id": "wake_up", "time": "05:30", "block": "Wake Up", "title": "Wake Up", "icon": "sunrise", "items": []})

    wake_items = [
        {"id": "wash_face", "text": "Wash Face (Cleanser + Moisturizer)", "daily": True},
        {"id": "water", "text": "Drink 2 Glasses of Water", "daily": True},
        {"id": "black_coffee", "text": "Black Coffee", "daily": True},
    ]
    if not is_sunday:
        wake_items.append({"id": "banana", "text": "1-2 Bananas", "daily": False})
    schedule[0]["items"] = wake_items

    # 2. Gym Block - 6:00 AM
    gym_items = [
        {"id": "stretching", "text": "Stretching - 5 Minutes", "daily": True},
        {"id": "treadmill", "text": "Treadmill - 5 Minutes (Running)", "daily": True},
        {"id": "exercise", "text": "Exercise", "daily": True},
        {"id": "meditation", "text": "Meditation" + (" (Extended)" if is_friday or is_saturday else ""), "daily": True},
    ]
    schedule.append({"id": "gym", "time": "06:00", "block": "Gym & Fitness", "title": "Gym & Fitness", "icon": "dumbbell", "items": gym_items})

    # 3. Morning Routine - 7:30 AM
    morning_items = []
    if not is_sunday:
        morning_items.append({"id": "boil_eggs", "text": "Boil Eggs (6: 2+4) + 1 Potato", "daily": False})
    morning_items.extend([
        {"id": "fresh", "text": "Fresh Up", "daily": True},
        {"id": "brush", "text": "Brush (Superfast!)", "daily": True},
        {"id": "bath", "text": "Bath", "daily": True},
    ])
    if is_shampoo_day:
        morning_items.extend([
            {"id": "shampoo", "text": "Shampoo", "daily": False},
            {"id": "conditioner", "text": "Conditioner", "daily": False},
        ])
    morning_items.extend([
        {"id": "cleanser_morning", "text": "Cleanser", "daily": True},
        {"id": "body_wash", "text": "Body Wash", "daily": True},
        {"id": "soap", "text": "Soap", "daily": True},
    ])
    if not is_sunday and not is_thursday:
        morning_items.append({"id": "sea_salt", "text": "Sea Salt", "daily": False})
    morning_items.extend([
        {"id": "hair_dryer", "text": "Hair Dryer", "daily": True},
        {"id": "clay_wax", "text": "Clay Wax", "daily": True},
        {"id": "moisturizer_morning", "text": "Moisturizer", "daily": True},
        {"id": "sunscreen", "text": "Sunscreen", "daily": True},
    ])
    schedule.append({"id": "morning_routine", "time": "07:30", "block": "Morning Routine", "title": "Morning Routine", "icon": "sparkles", "items": morning_items})

    # 4. Breakfast & Supplements - 9:00 AM
    breakfast_items = []
    if not is_sunday:
        breakfast_items.extend([
            {"id": "eat_eggs", "text": "Eat Eggs + Potato", "daily": False},
            {"id": "creatine", "text": "Creatine", "daily": False},
            {"id": "vitamin_d3", "text": "Vitamin D3", "daily": False},
            {"id": "whey_protein", "text": "Whey Protein", "daily": False},
            {"id": "chia", "text": "Chia Seeds", "daily": False},
        ])
    breakfast_items.extend([
        {"id": "perfume", "text": "Perfume / Deodorant", "daily": True},
        {"id": "clean_clothes", "text": "Clean Clothes", "daily": True},
        {"id": "watch", "text": "Watch", "daily": True},
        {"id": "chain", "text": "Chain", "daily": True},
    ])
    schedule.append({"id": "breakfast", "time": "09:00", "block": "Breakfast & Get Ready", "title": "Breakfast & Get Ready", "icon": "utensils", "items": breakfast_items})

    # 5. Work/Study Block 1 - 10:00 AM
    work1_label = "Work / Study (Mon-Thu)" if not is_weekend else "Work / Study (Fri-Sun)"
    schedule.append({"id": "work1", "time": "10:00", "block": work1_label, "title": work1_label, "icon": "laptop", "items": [
        {"id": "work_session_1", "text": "Focus Work Session 1", "daily": True},
    ]})

    # 6. Lunch - 1:00 PM
    schedule.append({"id": "lunch", "time": "13:00", "block": "Lunch", "title": "Lunch", "icon": "salad", "items": [
        {"id": "lunch_food", "text": "Roti + Sabji + Ghee", "daily": True},
        {"id": "curd", "text": "Curd", "daily": True},
        {"id": "green_tea", "text": "Green Tea", "daily": True},
    ]})

    # 7. Work/Study Block 2 - 2:00 PM
    work2_label = "Work / Study (Mon-Thu)" if not is_weekend else "Work / Study (Fri-Sun)"
    schedule.append({"id": "work2", "time": "14:00", "block": work2_label, "title": work2_label, "icon": "book-open", "items": [
        {"id": "work_session_2", "text": "Focus Work Session 2", "daily": True},
    ]})

    # 8. Diet Snack - 5:00 PM
    schedule.append({"id": "diet", "time": "17:00", "block": "Diet / Snack", "title": "Diet / Snack", "icon": "apple", "items": [
        {"id": "soaked_chana", "text": "Soaked Chana - 20gm", "daily": True},
        {"id": "egg_whites", "text": "4 Egg Whites", "daily": True},
        {"id": "soya_chunks", "text": "Soya Chunks - 50gm", "daily": True},
        {"id": "soaked_soyabeans", "text": "Soaked Soya Beans - 40gm", "daily": True},
        {"id": "jeera", "text": "Jeera", "daily": True},
    ]})

    # 9. Reading/Study - 6:00 PM
    schedule.append({"id": "reading", "time": "18:00", "block": "Reading / Study / Test", "title": "Reading / Study / Test", "icon": "book", "items": [
        {"id": "reading_session", "text": "Reading / Study Session", "daily": True},
    ]})

    # 10. Dinner - 7:00 PM
    schedule.append({"id": "dinner", "time": "19:00", "block": "Dinner", "title": "Dinner", "icon": "moon", "items": [
        {"id": "dinner_food", "text": "Roti + Sabji + Ghee", "daily": True},
        {"id": "milk", "text": "Milk", "daily": True},
    ]})

    # 11. Evening Goals - 8:00 PM
    schedule.append({"id": "evening", "time": "20:00", "block": "Evening Goals", "title": "Evening Goals", "icon": "target", "items": [
        {"id": "goals_review", "text": "Remember Goals / AEON", "daily": True},
        {"id": "no_screens", "text": "No Screens Allowed", "daily": True},
    ]})

    # 12. Bedtime Routine - 10:00 PM
    schedule.append({"id": "bedtime", "time": "22:00", "block": "Bedtime Routine", "title": "Bedtime Routine", "icon": "bed", "items": [
        {"id": "cleanser_night", "text": "Cleanser", "daily": True},
        {"id": "moisturizer_night", "text": "Moisturizer", "daily": True},
        {"id": "mustard_oil", "text": "Mustard Oil", "daily": True},
    ]})

    # 13. Sleep - 11:00 PM
    if is_sunday:
        schedule.append({"id": "sleep", "time": "23:00", "block": "Sleep", "title": "Sleep (Rest Day)", "icon": "cloud-moon", "items": [
            {"id": "sleep_time", "text": "Sleep - Rest & Recover", "daily": True},
        ]})
    else:
        schedule.append({"id": "sleep", "time": "23:00", "block": "Sleep", "title": "Sleep", "icon": "cloud-moon", "items": [
            {"id": "sleep_time", "text": "Sleep", "daily": True},
        ]})

    return schedule


def get_all_task_ids(schedule):
    ids = []
    for block in schedule:
        for item in block["items"]:
            ids.append(item["id"])
    return ids

# --- Schedule Endpoints ---
@api_router.get("/schedule")
async def get_schedule(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    # Use IST (UTC+5:30) for day calculation
    ist_now = now + timedelta(hours=5, minutes=30)
    day_name = ist_now.strftime("%A")
    date_str = ist_now.strftime("%Y-%m-%d")

    schedule = get_day_schedule(day_name)
    all_task_ids = get_all_task_ids(schedule)

    # Get progress for today
    progress = await db.daily_progress.find_one(
        {"user_id": str(user["_id"]), "date": date_str},
        {"_id": 0}
    )
    completed = progress.get("completed_tasks", []) if progress else []

    return {
        "date": date_str,
        "day": day_name,
        "schedule": schedule,
        "completed_tasks": completed,
        "total_tasks": len(all_task_ids),
        "completed_count": len([t for t in completed if t in all_task_ids]),
    }

@api_router.post("/schedule/toggle")
async def toggle_task(inp: ToggleTaskInput, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    date_str = inp.date

    # Get schedule for the date to validate
    from datetime import date as date_type
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    day_name = dt.strftime("%A")
    schedule = get_day_schedule(day_name)
    all_task_ids = get_all_task_ids(schedule)

    progress = await db.daily_progress.find_one({"user_id": user_id, "date": date_str})
    completed = progress.get("completed_tasks", []) if progress else []

    if inp.task_id in completed:
        completed.remove(inp.task_id)
    else:
        completed.append(inp.task_id)

    valid_completed = [t for t in completed if t in all_task_ids]
    percentage = round((len(valid_completed) / len(all_task_ids)) * 100) if all_task_ids else 0

    await db.daily_progress.update_one(
        {"user_id": user_id, "date": date_str},
        {"$set": {
            "completed_tasks": valid_completed,
            "total_tasks": len(all_task_ids),
            "completion_percentage": percentage,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    return {
        "date": date_str,
        "completed_tasks": valid_completed,
        "total_tasks": len(all_task_ids),
        "completed_count": len(valid_completed),
        "completion_percentage": percentage,
    }

# --- History Endpoint ---
@api_router.get("/history")
async def get_history(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    m = month or now.month
    y = year or now.year

    # Get all progress docs for the month
    date_prefix = f"{y}-{m:02d}"
    docs = await db.daily_progress.find(
        {"user_id": str(user["_id"]), "date": {"$regex": f"^{date_prefix}"}},
        {"_id": 0}
    ).to_list(100)

    return {
        "month": m,
        "year": y,
        "days": docs,
    }

# --- Startup ---
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "sachin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "sachin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Sachin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info(f"Admin password updated: {admin_email}")

    # Write test credentials
    cred_path = Path("/app/memory/test_credentials.md")
    cred_path.parent.mkdir(parents=True, exist_ok=True)
    cred_path.write_text(f"""# Test Credentials

## Admin
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh

## Schedule Endpoints
- GET /api/schedule
- POST /api/schedule/toggle

## History Endpoints
- GET /api/history?month=1&year=2026
""")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
