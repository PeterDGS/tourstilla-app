from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import jwt
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import pandas as pd
from io import BytesIO
import traceback

load_dotenv()

app = FastAPI(title="Tours Guide App API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "tours_db")
SECRET_KEY = os.getenv("SECRET_KEY", "tours-secret-key-2025")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

security = HTTPBearer()

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "guide"  # admin or guide

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class TourCreate(BaseModel):
    guide_id: str
    guide_name: str
    guide_email: str
    tour_name: str
    location: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    accepted: bool = False

class TourUpdate(BaseModel):
    tour_name: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    accepted: Optional[bool] = None

class TourResponse(BaseModel):
    id: str
    guide_id: str
    guide_name: str
    guide_email: str
    tour_name: str
    location: str
    date: str
    time: str
    accepted: bool

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        user = await db.users.find_one({"_id": ObjectId(payload["user_id"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(user = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return user

# Initialize admin user
@app.on_event("startup")
async def startup():
    admin = await db.users.find_one({"email": "admin@tours.com"})
    if not admin:
        await db.users.insert_one({
            "email": "admin@tours.com",
            "password": hash_password("admin123"),
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.utcnow()
        })
        print("Admin user created: admin@tours.com / admin123")

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "Tours API running"}

# Auth endpoints
@app.post("/api/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    token = create_token(str(user["_id"]), user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.get("/api/auth/me")
async def get_me(user = Depends(get_current_user)):
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }

# Guide management (Admin only)
@app.post("/api/guides", response_model=UserResponse)
async def create_guide(data: UserCreate, admin = Depends(require_admin)):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    result = await db.users.insert_one({
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "name": data.name,
        "role": "guide",
        "created_at": datetime.utcnow()
    })
    
    return UserResponse(
        id=str(result.inserted_id),
        email=data.email.lower(),
        name=data.name,
        role="guide"
    )

@app.get("/api/guides")
async def list_guides(admin = Depends(require_admin)):
    guides = await db.users.find({"role": "guide"}).to_list(100)
    return [{
        "id": str(g["_id"]),
        "email": g["email"],
        "name": g["name"],
        "role": g["role"]
    } for g in guides]

@app.delete("/api/guides/{guide_id}")
async def delete_guide(guide_id: str, admin = Depends(require_admin)):
    result = await db.users.delete_one({"_id": ObjectId(guide_id), "role": "guide"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Guía no encontrado")
    # Also delete their tours
    await db.tours.delete_many({"guide_id": guide_id})
    return {"message": "Guía eliminado"}

@app.put("/api/guides/{guide_id}")
async def update_guide(guide_id: str, data: UserCreate, admin = Depends(require_admin)):
    update_data = {
        "email": data.email.lower(),
        "name": data.name
    }
    if data.password:
        update_data["password"] = hash_password(data.password)
    
    result = await db.users.update_one(
        {"_id": ObjectId(guide_id), "role": "guide"},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guía no encontrado")
    return {"message": "Guía actualizado"}

# Tour management
@app.post("/api/tours", response_model=TourResponse)
async def create_tour(data: TourCreate, admin = Depends(require_admin)):
    tour_data = {
        "guide_id": data.guide_id,
        "guide_name": data.guide_name,
        "guide_email": data.guide_email,
        "tour_name": data.tour_name,
        "location": data.location,
        "date": data.date,
        "time": data.time,
        "accepted": False,
        "created_at": datetime.utcnow()
    }
    result = await db.tours.insert_one(tour_data)
    return TourResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in tour_data.items() if k not in ["created_at", "_id"]}
    )

@app.get("/api/tours")
async def list_all_tours(admin = Depends(require_admin)):
    tours = await db.tours.find().sort("date", 1).to_list(500)
    return [{
        "id": str(t["_id"]),
        "guide_id": t["guide_id"],
        "guide_name": t["guide_name"],
        "guide_email": t["guide_email"],
        "tour_name": t["tour_name"],
        "location": t["location"],
        "date": t["date"],
        "time": t["time"],
        "accepted": t.get("accepted", False)
    } for t in tours]

@app.get("/api/tours/my-tours")
async def get_my_tours(user = Depends(get_current_user)):
    tours = await db.tours.find({"guide_id": str(user["_id"])}).sort("date", 1).to_list(100)
    return [{
        "id": str(t["_id"]),
        "guide_id": t["guide_id"],
        "guide_name": t["guide_name"],
        "guide_email": t["guide_email"],
        "tour_name": t["tour_name"],
        "location": t["location"],
        "date": t["date"],
        "time": t["time"],
        "accepted": t.get("accepted", False)
    } for t in tours]

@app.put("/api/tours/{tour_id}")
async def update_tour(tour_id: str, data: TourUpdate, user = Depends(get_current_user)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    # Guides can only update accepted status
    if user["role"] == "guide":
        if list(update_data.keys()) != ["accepted"]:
            raise HTTPException(status_code=403, detail="Solo puedes actualizar el estado de aceptación")
        result = await db.tours.update_one(
            {"_id": ObjectId(tour_id), "guide_id": str(user["_id"])},
            {"$set": update_data}
        )
    else:
        result = await db.tours.update_one(
            {"_id": ObjectId(tour_id)},
            {"$set": update_data}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tour no encontrado")
    return {"message": "Tour actualizado"}

@app.delete("/api/tours/{tour_id}")
async def delete_tour(tour_id: str, admin = Depends(require_admin)):
    result = await db.tours.delete_one({"_id": ObjectId(tour_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tour no encontrado")
    return {"message": "Tour eliminado"}

# Excel upload
@app.post("/api/tours/upload-excel")
async def upload_excel(file: UploadFile = File(...), admin = Depends(require_admin)):
    try:
        content = await file.read()
        df = pd.read_excel(BytesIO(content))
        
        # Clean column names
        df.columns = df.columns.str.strip()
        
        required_cols = ["EMAIL", "GUIA", "FECHA", "HORA", "TOUR", "LUGAR"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Columnas faltantes: {missing}")
        
        tours_created = 0
        guides_created = 0
        
        for _, row in df.iterrows():
            email = str(row["EMAIL"]).strip().lower()
            name = str(row["GUIA"]).strip()
            
            # Create or find guide
            guide = await db.users.find_one({"email": email})
            if not guide:
                result = await db.users.insert_one({
                    "email": email,
                    "password": hash_password("guide123"),  # Default password
                    "name": name,
                    "role": "guide",
                    "created_at": datetime.utcnow()
                })
                guide_id = str(result.inserted_id)
                guides_created += 1
            else:
                guide_id = str(guide["_id"])
            
            # Parse date and time
            fecha = row["FECHA"]
            if isinstance(fecha, datetime):
                date_str = fecha.strftime("%Y-%m-%d")
            else:
                date_str = str(fecha)[:10]
            
            hora = row["HORA"]
            if isinstance(hora, datetime):
                time_str = hora.strftime("%H:%M")
            elif hasattr(hora, 'hour'):
                time_str = f"{hora.hour:02d}:{hora.minute:02d}"
            else:
                time_str = str(hora)[:5]
            
            tour_name = str(row["TOUR"]).strip()
            location = str(row["LUGAR"]).strip()
            
            # Create tour
            await db.tours.insert_one({
                "guide_id": guide_id,
                "guide_name": name,
                "guide_email": email,
                "tour_name": tour_name,
                "location": location,
                "date": date_str,
                "time": time_str,
                "accepted": False,
                "created_at": datetime.utcnow()
            })
            tours_created += 1
        
        return {
            "message": "Excel procesado correctamente",
            "tours_created": tours_created,
            "guides_created": guides_created
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error procesando Excel: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
