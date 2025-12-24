from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class VisitorLog(BaseModel):
    # Pydantic v2 configuration: allow population by field name
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(alias="_id", default=None)  # For MongoDB _id
    ip_address: str
    session_id: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # If using MongoDB with Motor, you might need specific configurations or helpers
    # Example for ObjectId handling if needed:
    # json_encoders = {
    #     ObjectId: str
    # } 