from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, Request, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, bcrypt, jwt
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def hash_password(p):
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p, h):
    return bcrypt.checkpw(p.encode(), h.encode())

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def create_access_token(uid, email):
    return jwt.encode({"sub": uid, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(uid):
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            token = ah[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        r = {k: v for k, v in user.items() if k != "_id"}
        r["_id"] = str(user["_id"])
        r.pop("password_hash", None)
        return r
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def set_cookies(resp, at, rt):
    resp.set_cookie("access_token", at, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    resp.set_cookie("refresh_token", rt, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class ToggleTaskInput(BaseModel):
    task_id: str
    date: str

class SetTaskTimeInput(BaseModel):
    task_id: str
    date: str
    actual_time: str

# AUTH ENDPOINTS
@api_router.post("/auth/register")
async def register(inp: RegisterInput, response: Response):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    h = hash_password(inp.password)
    result = await db.users.insert_one({"email": email, "password_hash": h, "name": inp.name.strip(), "role": "user", "created_at": datetime.now(timezone.utc)})
    uid = str(result.inserted_id)
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    set_cookies(response, at, rt)
    return {"id": uid, "email": email, "name": inp.name.strip(), "role": "user", "access_token": at}

@api_router.post("/auth/login")
async def login(inp: LoginInput, request: Request, response: Response):
    email = inp.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5:
        lu = att.get("locked_until")
        if lu and datetime.now(timezone.utc) < lu:
            raise HTTPException(429, "Too many attempts. Try in 15 min.")
        else:
            await db.login_attempts.delete_one({"identifier": ident})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_many({"identifier": ident})
    uid = str(user["_id"])
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    set_cookies(response, at, rt)
    return {"id": uid, "email": email, "name": user.get("name", ""), "role": user.get("role", "user"), "access_token": at}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    # Exclude _id from response (use id instead)
    result = {k: v for k, v in user.items() if k != "_id"}
    result["id"] = user["_id"]
    return result

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        at = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", at, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
        return {"message": "Token refreshed", "access_token": at}
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")

# SCHEDULE - Corrected timings from Excel
def get_day_schedule(day_name, date_obj=None):
    is_sun = day_name == "Sunday"
    is_thu = day_name == "Thursday"
    is_fri = day_name == "Friday"
    is_sat = day_name == "Saturday"
    is_work = day_name in ["Monday", "Tuesday", "Wednesday", "Thursday"]
    if date_obj:
        is_shampoo = (date_obj.timetuple().tm_yday % 2 == 0) and not is_sun
    else:
        from datetime import date
        is_shampoo = (date.today().timetuple().tm_yday % 2 == 0) and not is_sun

    s = []

    # 1. Wake Up 5:30-6:00
    wi = [
        {"id": "wash_face", "text": "Wash Face (Cleanser + Moisturizer)"},
        {"id": "water", "text": "Drink 2 Glasses of Water"},
        {"id": "black_coffee", "text": "Black Coffee"},
    ]
    if not is_sun:
        wi.append({"id": "banana", "text": "1-2 Bananas"})
    s.append({"id": "wake_up", "time": "05:30", "end_time": "06:00", "block": "Wake Up", "title": "Wake Up", "icon": "sunrise", "items": wi})

    # 2. Gym & Fitness 6:00-8:10
    gi = [
        {"id": "stretching", "text": "Stretching - 5 Minutes"},
        {"id": "treadmill", "text": "Treadmill - 5 Minutes (Running)"},
        {"id": "exercise", "text": "Exercise"},
        {"id": "meditation", "text": "Meditation" + (" (Extended)" if is_fri or is_sat else "")},
    ]
    s.append({"id": "gym", "time": "06:00", "end_time": "08:10", "block": "Gym & Fitness", "title": "Gym & Fitness", "icon": "dumbbell", "items": gi})

    # 3. Morning Routine 8:10-9:30 (ONE block: hygiene + diet + get ready)
    mi = []
    if not is_sun:
        mi.append({"id": "boil_eggs", "text": "Boil Eggs * 6(2+4) + 1 Potato"})
    mi.append({"id": "fresh", "text": "Fresh"})
    mi.append({"id": "brush", "text": "Brush"})
    mi.append({"id": "bath", "text": "Bath"})
    if is_shampoo:
        mi.append({"id": "shampoo", "text": "Shampoo"})
        mi.append({"id": "conditioner", "text": "Conditioner"})
    mi.append({"id": "cleanser_morning", "text": "Cleanser"})
    mi.append({"id": "body_wash", "text": "Body Wash"})
    mi.append({"id": "soap", "text": "Soap"})
    if not is_sun and not is_thu:
        mi.append({"id": "sea_salt", "text": "Sea Salt"})
    mi.append({"id": "hair_dryer", "text": "Hair Dryer"})
    mi.append({"id": "clay_wax", "text": "Clay Wax"})
    mi.append({"id": "moisturizer_morning", "text": "Moisturizer"})
    mi.append({"id": "sunscreen", "text": "Sunscreen"})
    if not is_sun:
        mi.append({"id": "eat_eggs", "text": "Eat - Eggs, Potato"})
        mi.append({"id": "creatine", "text": "Creatine"})
        mi.append({"id": "vitamin_d3", "text": "Vitamin D3"})
        mi.append({"id": "whey_protein", "text": "Whey Protein"})
        mi.append({"id": "chia", "text": "Chia Seeds"})
    mi.append({"id": "perfume", "text": "Perfume / Deodorant"})
    mi.append({"id": "clean_clothes", "text": "Clean Clothes"})
    mi.append({"id": "watch_item", "text": "Watch"})
    mi.append({"id": "chain", "text": "Chain"})
    s.append({"id": "morning_routine", "time": "08:10", "end_time": "09:30", "block": "Morning Routine", "title": "Morning Routine", "icon": "sparkles", "items": mi})

    # 4. Work/Study Session 1: 9:30-15:00
    if is_work:
        s.append({"id": "work1", "time": "09:30", "end_time": "15:00", "block": "Work Session 1", "title": "Work Session 1", "icon": "laptop", "items": [{"id": "work_session_1", "text": "Work Session 1 (Mon-Thu)"}]})
    else:
        s.append({"id": "work1", "time": "09:30", "end_time": "15:00", "block": "Study Session 1", "title": "Study Session 1", "icon": "book-open", "items": [{"id": "study_session_1", "text": "Study Session 1 (Fri-Sun)"}]})

    # 5. Lunch 15:00-15:30
    s.append({"id": "lunch", "time": "15:00", "end_time": "15:30", "block": "Lunch", "title": "Lunch", "icon": "salad", "items": [
        {"id": "lunch_food", "text": "Roti + Sabji + Ghee"},
        {"id": "curd", "text": "Curd"},
        {"id": "green_tea", "text": "Green Tea"},
    ]})

    # 6. Work/Study Session 2: 15:30-18:00
    if is_work:
        s.append({"id": "work2", "time": "15:30", "end_time": "18:00", "block": "Work Session 2", "title": "Work Session 2", "icon": "laptop", "items": [{"id": "work_session_2", "text": "Work Session 2 (Mon-Thu)"}]})
    else:
        s.append({"id": "work2", "time": "15:30", "end_time": "18:00", "block": "Study Session 2", "title": "Study Session 2", "icon": "book-open", "items": [{"id": "study_session_2", "text": "Study Session 2 (Fri-Sun)"}]})

    # 7. Diet & Snack 18:00-19:00
    s.append({"id": "diet", "time": "18:00", "end_time": "19:00", "block": "Diet & Snack", "title": "Diet & Snack", "icon": "apple", "items": [
        {"id": "soaked_chana", "text": "Soaked Chana - 20gm"},
        {"id": "egg_whites", "text": "4 Egg Whites"},
        {"id": "soya_chunks", "text": "Soya Chunks - 50gm"},
        {"id": "soaked_soyabeans", "text": "Soaked Soya Beans - 40gm"},
        {"id": "jeera", "text": "Jeera"},
    ]})

    # 8. Reading / Study / Test 19:00-20:55
    s.append({"id": "reading", "time": "19:00", "end_time": "20:55", "block": "Reading / Study / Test", "title": "Reading / Study / Test", "icon": "book", "items": [
        {"id": "reading_session", "text": "Reading / Study Session"},
    ]})

    # 9. Dinner 21:00-21:15
    s.append({"id": "dinner", "time": "21:00", "end_time": "21:15", "block": "Dinner", "title": "Dinner", "icon": "moon", "items": [
        {"id": "dinner_food", "text": "Roti + Sabji + Ghee"},
        {"id": "milk", "text": "Milk"},
    ]})

    # 10. Bedtime Routine 21:15-22:00
    s.append({"id": "bedtime", "time": "21:15", "end_time": "22:00", "block": "Bedtime Routine", "title": "Bedtime Routine", "icon": "bed", "items": [
        {"id": "goals_review", "text": "Remember Goals / AEON"},
        {"id": "no_screens", "text": "No Screens Allowed"},
        {"id": "cleanser_night", "text": "Cleanser"},
        {"id": "moisturizer_night", "text": "Moisturizer"},
        {"id": "mustard_oil", "text": "Mustard Oil"},
    ]})

    # 11. Sleep 22:00
    s.append({"id": "sleep", "time": "22:00", "end_time": "05:30", "block": "Sleep", "title": "Sleep", "icon": "cloud-moon", "items": [
        {"id": "sleep_time", "text": "Sleep - Rest & Recover" if is_sun else "Sleep"},
    ]})

    return s

def get_all_task_ids(schedule):
    return [item["id"] for block in schedule for item in block["items"]]

# SCHEDULE ENDPOINTS
@api_router.get("/schedule")
async def get_schedule(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    ds = now.strftime("%Y-%m-%d")
    sch = get_day_schedule(now.strftime("%A"), now.date())
    ids = get_all_task_ids(sch)
    p = await db.daily_progress.find_one({"user_id": str(user["_id"]), "date": ds}, {"_id": 0})
    comp = p.get("completed_tasks", []) if p else []
    tms = p.get("task_timings", {}) if p else {}
    return {
        "date": ds, "day": now.strftime("%A"), "schedule": sch,
        "completed_tasks": comp, "task_timings": tms,
        "total_tasks": len(ids),
        "completed_count": len([t for t in comp if t in ids]),
    }

@api_router.post("/schedule/toggle")
async def toggle_task(inp: ToggleTaskInput, request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    dt = datetime.strptime(inp.date, "%Y-%m-%d")
    sch = get_day_schedule(dt.strftime("%A"), dt.date())
    ids = get_all_task_ids(sch)
    p = await db.daily_progress.find_one({"user_id": uid, "date": inp.date})
    comp = p.get("completed_tasks", []) if p else []
    if inp.task_id in comp:
        comp.remove(inp.task_id)
    else:
        comp.append(inp.task_id)
    v = [t for t in comp if t in ids]
    pct = round((len(v) / len(ids)) * 100) if ids else 0
    await db.daily_progress.update_one(
        {"user_id": uid, "date": inp.date},
        {"$set": {"completed_tasks": v, "total_tasks": len(ids), "completion_percentage": pct, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"date": inp.date, "completed_tasks": v, "total_tasks": len(ids), "completed_count": len(v), "completion_percentage": pct}

@api_router.post("/schedule/set-time")
async def set_task_time(inp: SetTaskTimeInput, request: Request):
    user = await get_current_user(request)
    await db.daily_progress.update_one(
        {"user_id": str(user["_id"]), "date": inp.date},
        {"$set": {f"task_timings.{inp.task_id}": inp.actual_time, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"status": "ok", "task_id": inp.task_id, "actual_time": inp.actual_time}

# HISTORY
@api_router.get("/history")
async def get_history(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    m = month or now.month
    y = year or now.year
    docs = await db.daily_progress.find(
        {"user_id": str(user["_id"]), "date": {"$regex": f"^{y}-{m:02d}"}},
        {"_id": 0},
    ).to_list(100)
    return {"month": m, "year": y, "days": docs}

@api_router.get("/history/day/{date_str}")
async def get_day_detail(date_str: str, request: Request):
    user = await get_current_user(request)
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    sch = get_day_schedule(dt.strftime("%A"), dt.date())
    ids = get_all_task_ids(sch)
    p = await db.daily_progress.find_one({"user_id": str(user["_id"]), "date": date_str}, {"_id": 0})
    comp = p.get("completed_tasks", []) if p else []
    tms = p.get("task_timings", {}) if p else {}
    tm = {}
    for b in sch:
        for it in b["items"]:
            tm[it["id"]] = {"text": it["text"], "block": b["title"], "scheduled_time": b["time"]}
    inc = [{"id": t, **tm[t]} for t in ids if t not in comp and t in tm]
    cd = []
    for t in comp:
        if t in tm:
            d = {"id": t, **tm[t]}
            if t in tms:
                d["actual_time"] = tms[t]
            cd.append(d)
    return {
        "date": date_str, "day": dt.strftime("%A"), "schedule": sch,
        "completed_tasks": comp,
        "incomplete_tasks": [t["id"] for t in inc],
        "incomplete_details": inc,
        "completed_details": cd,
        "task_timings": tms,
        "total_tasks": len(ids),
        "completed_count": len(comp),
        "completion_percentage": p.get("completion_percentage", 0) if p else 0,
    }

# ANALYTICS
@api_router.get("/analytics")
async def get_analytics(request: Request, days: int = 30):
    user = await get_current_user(request)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    all_docs = await db.daily_progress.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    docs = [d for d in all_docs if d.get("date", "") >= start]
    if not docs:
        return {"total_days_tracked": 0, "avg_completion": 0, "perfect_days": 0, "most_missed_tasks": [], "best_tasks": [], "delay_insights": [], "streak": 0, "period_days": days}
    total = len(docs)
    avg_comp = round(sum(d.get("completion_percentage", 0) for d in docs) / total)
    perfect = len([d for d in docs if d.get("completion_percentage", 0) >= 100])
    missed_c = {}
    completed_c = {}
    delay_data = {}
    task_names = {}
    for doc in docs:
        ds = doc.get("date", "")
        try:
            dtt = datetime.strptime(ds, "%Y-%m-%d")
            sch = get_day_schedule(dtt.strftime("%A"), dtt.date())
            task_ids = get_all_task_ids(sch)
            comp = doc.get("completed_tasks", [])
            tms = doc.get("task_timings", {})
            sched_map = {}
            for b in sch:
                for it in b["items"]:
                    sched_map[it["id"]] = {"time": b["time"], "text": it["text"]}
                    task_names[it["id"]] = it["text"]
            for t in task_ids:
                if t not in comp:
                    missed_c[t] = missed_c.get(t, 0) + 1
                else:
                    completed_c[t] = completed_c.get(t, 0) + 1
                if t in tms and t in sched_map:
                    try:
                        ah, am = map(int, tms[t].split(":"))
                        sh, smn = map(int, sched_map[t]["time"].split(":"))
                        delay = (ah * 60 + am) - (sh * 60 + smn)
                        if t not in delay_data:
                            delay_data[t] = {"text": sched_map[t]["text"], "delays": [], "scheduled": sched_map[t]["time"]}
                        delay_data[t]["delays"].append(delay)
                    except Exception:
                        pass
        except Exception:
            continue
    missed = sorted(missed_c.items(), key=lambda x: x[1], reverse=True)[:10]
    missed_out = [{"id": t, "text": task_names.get(t, t), "missed_count": c, "total_days": total} for t, c in missed]
    best = sorted(completed_c.items(), key=lambda x: x[1], reverse=True)[:10]
    best_out = [{"id": t, "text": task_names.get(t, t), "completed_count": c, "total_days": total} for t, c in best]
    delay_out = []
    for t, d in delay_data.items():
        if d["delays"]:
            ad = round(sum(d["delays"]) / len(d["delays"]))
            if ad > 0:
                delay_out.append({"id": t, "text": d["text"], "avg_delay_minutes": ad, "scheduled_time": d["scheduled"], "times_tracked": len(d["delays"])})
    delay_out.sort(key=lambda x: x["avg_delay_minutes"], reverse=True)
    streak = 0
    check = now.date()
    while True:
        ds = check.strftime("%Y-%m-%d")
        f = next((d for d in all_docs if d.get("date") == ds), None)
        if f and f.get("completion_percentage", 0) > 0:
            streak += 1
            check -= timedelta(days=1)
        else:
            break
    return {
        "total_days_tracked": total, "avg_completion": avg_comp, "perfect_days": perfect,
        "most_missed_tasks": missed_out, "best_tasks": best_out,
        "delay_insights": delay_out, "streak": streak, "period_days": days,
    }

# STARTUP
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    ae = os.environ.get("ADMIN_EMAIL", "sachin@example.com")
    ap = os.environ.get("ADMIN_PASSWORD", "sachin123")
    ex = await db.users.find_one({"email": ae})
    if not ex:
        await db.users.insert_one({"email": ae, "password_hash": hash_password(ap), "name": "Sachin", "role": "admin", "created_at": datetime.now(timezone.utc)})
        logger.info(f"Admin seeded: {ae}")
    elif not verify_password(ap, ex["password_hash"]):
        await db.users.update_one({"email": ae}, {"$set": {"password_hash": hash_password(ap)}})
    Path("/app/memory").mkdir(parents=True, exist_ok=True)
    Path("/app/memory/test_credentials.md").write_text(f"# Test Credentials\n- Email: {ae}\n- Password: {ap}\n")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
