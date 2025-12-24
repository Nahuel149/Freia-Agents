print("--- backend/main.py execution started ---")
import os
from fastapi import FastAPI, HTTPException, status, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv
from datetime import datetime
import logging
import smtplib
import ssl
from email.message import EmailMessage

# Import the middleware
from core.middleware.visitor_logging import VisitorLoggingMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Global Server Ready Flag ---
_server_ready = False

# Load environment variables FIRST
load_dotenv(dotenv_path='.env.development')

# Hide logs in production mode
env = os.getenv("ENV", "development")
if env.lower() == "production":
    logging.disable(logging.CRITICAL)

# Import necessary functions after loading env vars
from dependencies import close_mongo_connection

# Now import local modules that might use env vars
from routers import chat as chat_router
from routers import subscriptions as subscriptions_router
from routers import contact as contact_router
from routers import auth as auth_router # Import auth router
from routers import admin as admin_router # Import admin router
from routers import admin_analytics as admin_analytics_router # Import admin analytics router

# Load environment variables from .env.development (REMOVED FROM HERE)
# load_dotenv(dotenv_path='.env.development')

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "SmartWifi") # Default DB name
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "contact") # Default Collection name

if not MONGODB_URI:
    logger.error("MONGODB_URI not found in environment variables.")
    raise ValueError("MONGODB_URI must be set in the environment")

# --- FastAPI Application Instance ---
app = FastAPI()

# --- Add Visitor Logging Middleware ---
# Add this *before* CORS if you want CORS headers applied to its responses,
# or *after* if you want it to run before CORS checks.
# Generally, logging/monitoring middleware comes early.
app.add_middleware(VisitorLoggingMiddleware)

# --- CORS Middleware ---
# Allow requests from typical Vite development server port and potentially others
origins = [
    "http://localhost",
    "http://localhost:8080", # Port used by http-server / previous gulp serve
    "http://localhost:5173", # Default Vite dev port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://localhost:3000", # Add default React dev port
    # Deployed frontend domains for production
    "https://smartwifiaccess.com",
    "https://smartwifiaccess.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Important for passing auth headers/cookies
    allow_methods=["*"], # Allow all methods or specify needed ones (GET, POST, OPTIONS)
    allow_headers=["*"], # Allow all headers, including Authorization
)

# --- MongoDB Connection ---
# ... existing connection logic ...
# Making db and contact_collection global for simplicity in this plan
# In a larger app, dependency injection (e.g., Depends) is preferred for accessing DB
try:
    client = MongoClient(MONGODB_URI)
    client.admin.command('ping')
    db = client[DATABASE_NAME]
    contact_collection = db[COLLECTION_NAME]
    
    # Create indexes for visitor_logs collection
    logger.info("Creating indexes for visitor analytics...")
    db.visitor_logs.create_index("timestamp")
    db.visitor_logs.create_index("ip_address") 
    db.visitor_logs.create_index("session_id")
    
    logger.info(f"Successfully connected to MongoDB database: {DATABASE_NAME}, collection: {COLLECTION_NAME}")
    # Attach db to app state for use in middleware
    app.state.db = db
except ConnectionFailure as e:
    logger.error(f"MongoDB connection failed: {e}")
    raise SystemExit(f"Could not connect to MongoDB: {e}")
except Exception as e:
    logger.error(f"An error occurred during MongoDB initialization: {e}")
    raise SystemExit(f"An error occurred during MongoDB initialization: {e}")

# --- Include Routers ---
# (Health check router added *before* other API routers if possible, though order might not strictly matter here)

# --- Health Check Endpoint ---
health_router = APIRouter()

@health_router.get("/api/health", tags=["Health"])
async def health_check():
    if _server_ready:
        return JSONResponse(content={"status": "ready"}, status_code=status.HTTP_200_OK)
    else:
        # Service is still starting up
        return JSONResponse(content={"status": "starting"}, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

app.include_router(health_router) # Include health check router

# --- Include Application Routers ---
app.include_router(chat_router.router)
app.include_router(subscriptions_router.router)
app.include_router(contact_router.router) # Include the new contact router
app.include_router(auth_router.router)   # Add the auth router
app.include_router(admin_router.router) # Add the admin router
app.include_router(admin_analytics_router.router) # Add the admin analytics router

# --- API Endpoint ---
# @app.post("/api/contact", status_code=status.HTTP_201_CREATED)
# async def submit_contact_form(contact_data: ContactForm):
#    ...

# --- Root Endpoint for Testing ---
@app.get("/")
async def read_root():
    return {"message": "Smart Wifi Access Backend API is running!"}

# --- Set Server Ready Flag (Simple method) ---
# This line executes *after* all synchronous setup (imports, router includes) is done.
_server_ready = True
print("--- backend/main.py execution finished, server marked as ready ---")

# --- Cleanup on Shutdown (Optional but good practice) ---
# ... existing endpoint ... 